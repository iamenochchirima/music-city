import { createCipheriv, createHash, createSecretKey, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ArchiveRecord } from "@music-city/shared";

import { env } from "../../config/env.js";
import { createId } from "../../services/id.service.js";
import { storageService } from "../../services/storage.service.js";
import { HttpError } from "../../utils/http-error.js";
import { tracksService } from "../tracks/tracks.service.js";
import { archivesRepository } from "./archives.repository.js";

const archivePath = (key: string) => join(process.cwd(), env.ARCHIVE_OUTPUT_ROOT, key);

const wrapDataKey = (dataKey: Buffer) => {
  const masterKeyMaterial = env.ARCHIVE_MASTER_KEY
    ? Buffer.from(env.ARCHIVE_MASTER_KEY, "base64")
    : createHash("sha256").update(env.JWT_SECRET).digest();
  const wrappingKey = createSecretKey(masterKeyMaterial.subarray(0, 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", wrappingKey, iv);
  const ciphertext = Buffer.concat([cipher.update(dataKey), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    wrappedKey: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
};

export const archivesService = {
  async createArchive(trackId: string) {
    const track = await tracksService.getTrackForUpload(trackId);

    if (!track?.masterStorageKey) {
      throw new HttpError(404, "Track media is not available");
    }

    const metadata = await storageService.getObjectMetadata(
      track.masterStorageKey,
      track.sourceFileName,
    );
    const bytes = await storageService.readObject(track.masterStorageKey);
    const dataKey = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
    const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const archiveId = createId("arc");
    const storageKey = `${archiveId}.bin`;
    const metadataKey = `${archiveId}.json`;
    const wrapped = wrapDataKey(dataKey);

    mkdirSync(join(process.cwd(), env.ARCHIVE_OUTPUT_ROOT), { recursive: true });
    writeFileSync(archivePath(storageKey), encrypted);
    writeFileSync(
      archivePath(metadataKey),
      `${JSON.stringify(
        {
          trackId,
          sourceFileName: track.sourceFileName,
          sourceContentType: metadata.contentType,
          sourceSizeBytes: metadata.sizeBytes,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    let remoteUrl: string | undefined;

    if (env.ARCHIVE_REMOTE_UPLOAD_URL) {
      const response = await fetch(env.ARCHIVE_REMOTE_UPLOAD_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          ...(env.ARCHIVE_REMOTE_UPLOAD_TOKEN
            ? { Authorization: `Bearer ${env.ARCHIVE_REMOTE_UPLOAD_TOKEN}` }
            : {}),
          "x-track-id": trackId,
          "x-archive-id": archiveId,
        },
        body: encrypted,
      });

      if (!response.ok) {
        throw new HttpError(502, "Remote archive upload failed");
      }

      remoteUrl = response.headers.get("location") ?? undefined;
    }

    const record: ArchiveRecord = {
      id: archiveId,
      trackId,
      storageKey,
      metadataKey,
      wrappedKey: wrapped.wrappedKey,
      iv: wrapped.iv,
      authTag: wrapped.authTag,
      remoteUrl,
      createdAt: new Date().toISOString(),
    };

    await tracksService.markArchiveReady(trackId);
    return archivesRepository.upsert(record);
  },
};
