import {
  completeUploadSessionSchema,
  createUploadSessionSchema,
  type CompleteUploadSessionInput,
  type CreateUploadSessionInput,
  type UploadSession,
} from "@music-city/shared";

import { createId } from "../../services/id.service.js";
import { env } from "../../config/env.js";
import { muxService } from "../../services/mux.service.js";
import { storageService } from "../../services/storage.service.js";
import { tracksService } from "../tracks/tracks.service.js";
import { uploadsRepository } from "./uploads.repository.js";

const expiresInMinutes = (minutes: number) =>
  new Date(Date.now() + minutes * 60 * 1000).toISOString();

const sanitizeFileName = (fileName: string) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, "-");

export const uploadsService = {
  async createSession(input: CreateUploadSessionInput) {
    const parsed = createUploadSessionSchema.parse(input);
    const id = createId("upl");
    const track = await tracksService.getTrackForUpload(parsed.trackId);

    if (!track) {
      throw new Error("Track not found");
    }

    let session: UploadSession;

    if (parsed.purpose === "audio" && muxService.isEnabled()) {
      const upload = await muxService.createDirectUpload({
        trackId: parsed.trackId,
        title: track.title,
        artistId: track.artistId,
      });
      const uploadUrl = upload.url;

      if (!uploadUrl) {
        throw new Error("Mux did not return an upload URL");
      }

      session = {
        id,
        trackId: parsed.trackId,
        purpose: parsed.purpose,
        fileName: parsed.fileName,
        contentType: parsed.contentType,
        sizeBytes: parsed.sizeBytes,
        remoteUploadId: upload.id,
        uploadUrl,
        method: "PUT",
        headers: {},
        provider: "mux",
        expiresAt: expiresInMinutes(30),
      };
    } else {
      const storagePrefix =
        parsed.purpose === "cover" ? "covers" : "masters";
      const storageKey = `${storagePrefix}/${parsed.trackId}/${id}-${sanitizeFileName(
        parsed.fileName,
      )}`;
      const target = storageService.createUploadTarget(storageKey);
      session = {
        id,
        trackId: parsed.trackId,
        purpose: parsed.purpose,
        fileName: parsed.fileName,
        contentType: parsed.contentType,
        sizeBytes: parsed.sizeBytes,
        storageKey,
        directUploadUrl: target.uploadUrl,
        uploadUrl: `${env.APP_BASE_URL}/api/v1/uploads/sessions/${id}/content`,
        method: target.method,
        headers: target.headers,
        provider: target.provider,
        expiresAt: expiresInMinutes(15),
      };
    }

    return uploadsRepository.upsert(session);
  },

  getSession(id: string) {
    return uploadsRepository.findById(id);
  },

  async requireActiveSession(id: string) {
    const session = await uploadsRepository.findById(id);

    if (!session) {
      throw new Error("Upload session not found");
    }

    if (Date.parse(session.expiresAt) <= Date.now()) {
      throw new Error("Upload session has expired");
    }

    return session;
  },

  async completeSession(input: CompleteUploadSessionInput) {
    const parsed = completeUploadSessionSchema.parse(input);
    const session = await uploadsRepository.findById(parsed.uploadSessionId);

    if (!session) {
      throw new Error("Upload session not found");
    }

    if (
      session.provider === "local" &&
      session.storageKey &&
      !storageService.localObjectExists(session.storageKey)
    ) {
      throw new Error("Uploaded file is missing");
    }

    if (session.purpose === "cover") {
      if (!session.storageKey) {
        throw new Error("Upload storage key is missing");
      }

      return tracksService.attachCoverArt(session.trackId, {
        coverStorageKey: session.storageKey,
      });
    }

    if (session.provider === "mux") {
      const track = await tracksService.attachMuxUpload(session.trackId, {
        muxUploadId: session.remoteUploadId ?? session.id,
        sourceFileName: session.fileName,
        sourceContentType: session.contentType,
        sourceSizeBytes: session.sizeBytes,
      });

      return track;
    }

    if (!session.storageKey) {
      throw new Error("Upload storage key is missing");
    }

    const storageKey = session.storageKey;
    const fileName = storageKey.split("/").pop() ?? storageKey;
    const fallbackMetadata =
      session.contentType && session.sizeBytes
        ? null
        : await storageService.getObjectMetadata(storageKey, fileName);
    const track = await tracksService.attachMaster(session.trackId, {
      masterStorageKey: storageKey,
      sourceFileName: fileName,
      sourceContentType:
        session.contentType || fallbackMetadata?.contentType || "application/octet-stream",
      sourceSizeBytes:
        session.sizeBytes || fallbackMetadata?.sizeBytes || 0,
    });

    if (env.MEDIA_PROVIDER === "mux") {
      return tracksService.markProcessing(track.id);
    }

    return tracksService.markPlaybackReady(track.id, {
      runtime: "Ready",
      streamMediaUrl: storageService.getDownloadUrl(track.masterStorageKey!),
      streamManifestUrl: `/api/v1/playback/tracks/${track.id}/manifest.m3u8`,
    });
  },
};
