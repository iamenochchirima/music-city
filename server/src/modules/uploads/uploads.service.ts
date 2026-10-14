import { tracksRepository } from "../tracks/tracks.repository.js";
import { databaseService } from "../../services/database.service.js";
import {
  completeUploadSessionSchema,
  createUploadSessionSchema,
  type CompleteUploadSessionInput,
  type CreateUploadSessionInput,
  type UploadSession,
  uploadMaxBytes,
} from "@music-city/shared";

import { createId } from "../../services/id.service.js";
import { env } from "../../config/env.js";
import { muxService } from "../../services/mux.service.js";
import { storageService } from "../../services/storage.service.js";
import { HttpError } from "../../utils/http-error.js";
import { releasesService } from "../releases/releases.service.js";
import { tracksService } from "../tracks/tracks.service.js";
import { uploadsRepository } from "./uploads.repository.js";

const expiresInMinutes = (minutes: number) =>
  new Date(Date.now() + minutes * 60 * 1000).toISOString();

const sanitizeFileName = (fileName: string) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, "-");

const detectedContentType = (body: Buffer) => {
  if (
    body
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png";
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff)
    return "image/jpeg";
  if (
    body.subarray(0, 4).toString("ascii") === "RIFF" &&
    body.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";
  if (body.subarray(0, 4).toString("ascii") === "fLaC") return "audio/flac";
  if (
    body.subarray(0, 4).toString("ascii") === "RIFF" &&
    body.subarray(8, 12).toString("ascii") === "WAVE"
  )
    return "audio/wav";
  if (body.subarray(4, 8).toString("ascii") === "ftyp") return "audio/mp4";
  if (
    body.subarray(0, 3).toString("ascii") === "ID3" ||
    (body[0] === 0xff && (body[1] & 0xe0) === 0xe0)
  )
    return "audio/mpeg";
  return null;
};

const contentTypesMatch = (declared: string, detected: string) => {
  const aliases: Record<string, string[]> = {
    "audio/mpeg": ["audio/mpeg", "audio/mp3", "audio/x-mp3"],
    "audio/wav": ["audio/wav", "audio/x-wav", "audio/wave"],
    "audio/mp4": ["audio/mp4", "audio/m4a", "audio/x-m4a"],
    "audio/flac": ["audio/flac", "audio/x-flac"],
    "image/jpeg": ["image/jpeg", "image/jpg"],
    "image/png": ["image/png"],
    "image/webp": ["image/webp"],
  };
  return aliases[detected]?.includes(declared.toLowerCase()) ?? false;
};

export const uploadsService = {
  validatePayload(
    session: UploadSession,
    received: { sizeBytes: number; sample: Buffer },
  ) {
    if (received.sizeBytes !== session.sizeBytes) {
      throw new HttpError(
        400,
        "Uploaded file size does not match the upload session",
      );
    }
    if (received.sizeBytes > uploadMaxBytes(session.purpose)) {
      throw new HttpError(413, "Uploaded file exceeds the allowed size");
    }
    const detected = detectedContentType(received.sample);
    if (!detected || !contentTypesMatch(session.contentType, detected)) {
      throw new HttpError(
        400,
        "Uploaded file type does not match the upload session",
      );
    }
  },

  async createSession(input: CreateUploadSessionInput) {
    const parsed = createUploadSessionSchema.parse(input);
    const id = createId("upl");
    const track = parsed.trackId
      ? await tracksService.getTrackForUpload(parsed.trackId)
      : null;
    const release = parsed.releaseId
      ? await releasesService.getReleaseForUpload(parsed.releaseId)
      : null;

    if (parsed.trackId && !track) {
      throw new Error("Track not found");
    }

    if (parsed.releaseId && !release) {
      throw new Error("Release not found");
    }

    let session: UploadSession;

    if (
      parsed.purpose === "audio" &&
      muxService.isEnabled() &&
      env.STORAGE_PROVIDER !== "s3"
    ) {
      const upload = await muxService.createDirectUpload({
        trackId: parsed.trackId!,
        title: track!.title,
        artistId: track!.artistId,
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
      const storagePrefix = parsed.purpose === "cover" ? "covers" : "masters";
      const ownerPath = parsed.releaseId
        ? `releases/${parsed.releaseId}`
        : `tracks/${parsed.trackId}`;
      const storageKey = `${storagePrefix}/${ownerPath}/${id}-${sanitizeFileName(parsed.fileName)}`;
      const target = storageService.createUploadTarget(storageKey);
      session = {
        id,
        trackId: parsed.trackId,
        releaseId: parsed.releaseId,
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

  async cancelSession(id: string) {
    const session = await uploadsRepository.findById(id);

    if (!session) {
      return;
    }

    if (session.provider === "mux" && session.remoteUploadId) {
      await muxService
        .cancelUpload(session.remoteUploadId)
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);

          if (
            !message.toLowerCase().includes("404") &&
            !message.toLowerCase().includes("not found")
          ) {
            throw error;
          }
        });
    }

    if (session.storageKey) {
      await storageService.deleteObject(session.storageKey);
    }

    await uploadsRepository.delete(id);
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

    let storedMetadata: Awaited<
      ReturnType<typeof storageService.getStoredObjectMetadata>
    > | null = null;
    if (
      (session.provider === "local" || session.provider === "s3") &&
      session.storageKey
    ) {
      try {
        storedMetadata = await storageService.getStoredObjectMetadata(
          session.storageKey,
          session.fileName,
        );
      } catch {
        await storageService
          .deleteObject(session.storageKey)
          .catch(() => undefined);
        throw new HttpError(
          400,
          "Uploaded file is missing or could not be verified",
        );
      }
      if (
        storedMetadata.sizeBytes !== session.sizeBytes ||
        storedMetadata.sizeBytes > uploadMaxBytes(session.purpose) ||
        !contentTypesMatch(session.contentType, storedMetadata.contentType)
      ) {
        await storageService.deleteObject(session.storageKey);
        throw new HttpError(
          400,
          "Uploaded file does not match the upload session",
        );
      }
    }

    if (session.purpose === "cover") {
      if (!session.storageKey) {
        throw new Error("Upload storage key is missing");
      }

      if (session.releaseId) {
        const release = await releasesService.attachCoverArt(
          session.releaseId,
          {
            coverStorageKey: session.storageKey,
          },
        );

        return { release };
      }

      if (!session.trackId) {
        throw new Error("Upload track is missing");
      }

      const track = await tracksService.attachCoverArt(session.trackId, {
        coverStorageKey: session.storageKey,
      });

      return { track };
    }

    if (session.provider === "mux") {
      if (!session.trackId) {
        throw new Error("Upload track is missing");
      }

      const track = await tracksService.attachMuxUpload(session.trackId, {
        muxUploadId: session.remoteUploadId ?? session.id,
        sourceFileName: session.fileName,
        sourceContentType: session.contentType,
        sourceSizeBytes: session.sizeBytes,
      });

      return { track };
    }

    if (!session.storageKey) {
      throw new Error("Upload storage key is missing");
    }

    if (!session.trackId) {
      throw new Error("Upload track is missing");
    }

    const storageKey = session.storageKey;
    const fileName = storageKey.split("/").pop() ?? storageKey;
    const track = await tracksService.attachMaster(session.trackId, {
      masterStorageKey: storageKey,
      sourceFileName: fileName,
      sourceContentType: storedMetadata?.contentType ?? session.contentType,
      sourceSizeBytes: storedMetadata?.sizeBytes ?? session.sizeBytes,
      storageProvider: session.provider,
    });

    if (env.MEDIA_PROVIDER === "mux") {
      await databaseService.transaction(async (client) => {
        await client.query(
          "UPDATE tracks SET status='processing',payload=payload || $2::jsonb WHERE id=$1",
          [
            session.trackId,
            JSON.stringify({
              status: "processing",
              mediaProvider: "mux",
              muxUploadId: null,
              muxAssetId: session.remoteUploadId ?? null,
              muxPlaybackId: null,
              muxAssetStatus: "waiting",
              playbackReady: false,
            }),
          ],
        );
        await client.query(
          "INSERT INTO media_jobs(id,kind,payload) VALUES($1,'ingest',$2::jsonb) ON CONFLICT(id) DO NOTHING",
          [
            `ingest:${session.id}`,
            JSON.stringify({ sessionId: session.id, trackId: session.trackId }),
          ],
        );
      });
      return { track: await tracksRepository.findById(session.trackId) };
    }

    return {
      track: await tracksService.markPlaybackReady(track.id, {
        runtime: "Ready",
        streamMediaUrl: storageService.getDownloadUrl(
          track.masterStorageKey!,
          track.mediaStorageProvider,
        ),
        streamManifestUrl: `/api/v1/playback/tracks/${track.id}/manifest.m3u8`,
      }),
    };
  },
};
