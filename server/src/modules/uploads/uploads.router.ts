import { Router, type Request, type Response } from "express";
import { createWriteStream, createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { UploadSession } from "@music-city/shared";
import { uploadMaxBytes } from "@music-city/shared";

import { env } from "../../config/env.js";
import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { storageService } from "../../services/storage.service.js";
import { HttpError } from "../../utils/http-error.js";
import { releasesService } from "../releases/releases.service.js";
import { tracksService } from "../tracks/tracks.service.js";
import { uploadsService } from "./uploads.service.js";

const uploadsRouter = Router();

const assertSessionOwner = async (walletAddress: string, session: UploadSession) => {
  if (session.trackId) {
    if (!(await tracksService.userOwnsTrack(walletAddress, session.trackId))) {
      throw new HttpError(404, "Upload session not found");
    }
  } else if (session.releaseId) {
    if (!(await releasesService.userOwnsRelease(walletAddress, session.releaseId))) {
      throw new HttpError(404, "Upload session not found");
    }
  } else {
    throw new HttpError(400, "Upload session target is missing");
  }
};

const rejectUploadRequest = (request: Request, response: Response, status: number, message: string) => {
  request.pause();
  response.status(status).json({ error: message });
  const closeRequest = () => request.destroy();
  response.once("finish", closeRequest);
  response.once("close", closeRequest);
};

const readAndValidateUpload = asyncHandler(async (request, response, next) => {
  const session = await uploadsService.requireActiveSession(String(request.params.uploadSessionId));
  await assertSessionOwner(request.session!.walletAddress, session);
  const maxBytes = uploadMaxBytes(session.purpose);
  const contentLength = request.headers["content-length"];
  if (contentLength !== undefined) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > maxBytes || declaredLength > session.sizeBytes) {
      rejectUploadRequest(
        request,
        response,
        declaredLength > maxBytes ? 413 : 400,
        "Upload size does not match the session",
      );
      return;
    }
  }

  const tempDirectory = await mkdtemp(join(tmpdir(), "music-city-upload-"));
  const tempPath = join(tempDirectory, "upload.bin");
  const output = createWriteStream(tempPath, { flags: "wx", mode: 0o600 });
  const sample = Buffer.alloc(16);
  let sampleLength = 0;
  let receivedBytes = 0;
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      receivedBytes += buffer.length;
      if (sampleLength < sample.length) {
        const bytesToCopy = Math.min(sample.length - sampleLength, buffer.length);
        buffer.copy(sample, sampleLength, 0, bytesToCopy);
        sampleLength += bytesToCopy;
      }
      if (receivedBytes > maxBytes) {
        output.destroy();
        await rm(tempDirectory, { recursive: true, force: true });
        rejectUploadRequest(request, response, 413, "Uploaded file exceeds the allowed size");
        return;
      }
      if (receivedBytes > session.sizeBytes) {
        output.destroy();
        await rm(tempDirectory, { recursive: true, force: true });
        rejectUploadRequest(request, response, 400, "Uploaded file size does not match the upload session");
        return;
      }
      if (!output.write(buffer)) await once(output, "drain");
    }

    await new Promise<void>((resolveFinish, rejectFinish) => {
      output.once("error", rejectFinish);
      output.end(() => resolveFinish());
    });

    if (receivedBytes !== session.sizeBytes) {
      throw new HttpError(400, "Uploaded file size does not match the upload session");
    }
    uploadsService.validatePayload(session, { sizeBytes: receivedBytes, sample: sample.subarray(0, sampleLength) });
    response.locals.uploadSession = session;
    response.locals.uploadTempPath = tempPath;
    response.locals.uploadTempDirectory = tempDirectory;
    response.locals.uploadSizeBytes = receivedBytes;
    next();
  } catch (error) {
    output.destroy();
    await rm(tempDirectory, { recursive: true, force: true });
    throw error;
  }
});

uploadsRouter.post(
  "/sessions",
  requireSession,
  asyncHandler(async (request, response) => {
    const { trackId, releaseId } = request.body ?? {};
    const walletAddress = request.session!.walletAddress;

    if (trackId) {
      const ownsTrack = await tracksService.userOwnsTrack(walletAddress, trackId);

      if (!ownsTrack) {
        throw new HttpError(404, "Track not found");
      }
    } else if (releaseId) {
      const ownsRelease = await releasesService.userOwnsRelease(
        walletAddress,
        releaseId,
      );

      if (!ownsRelease) {
        throw new HttpError(404, "Release not found");
      }
    } else {
      throw new HttpError(400, "trackId or releaseId is required");
    }

    const session = await uploadsService.createSession(request.body);
    const { directUploadUrl: _directUploadUrl, ...clientSession } = session;
    response.status(201).json({ uploadSession: clientSession });
  }),
);

uploadsRouter.delete(
  "/sessions/:uploadSessionId",
  requireSession,
  asyncHandler(async (request, response) => {
    const uploadSessionId = String(request.params.uploadSessionId);
    const session = await uploadsService.getSession(uploadSessionId);

    if (!session) {
      response.status(204).send();
      return;
    }

    const walletAddress = request.session!.walletAddress;

    if (session.trackId) {
      if (!(await tracksService.userOwnsTrack(walletAddress, session.trackId))) {
        throw new HttpError(404, "Upload session not found");
      }
    } else if (session.releaseId) {
      if (!(await releasesService.userOwnsRelease(walletAddress, session.releaseId))) {
        throw new HttpError(404, "Upload session not found");
      }
    } else {
      throw new HttpError(400, "Upload session target is missing");
    }

    await uploadsService.cancelSession(uploadSessionId);
    response.status(204).send();
  }),
);

uploadsRouter.put(
  "/sessions/:uploadSessionId/content",
  requireSession,
  readAndValidateUpload,
  asyncHandler(async (request, response) => {
    const session = response.locals.uploadSession as UploadSession;
    const tempPath = response.locals.uploadTempPath as string;
    const tempDirectory = response.locals.uploadTempDirectory as string;
    const sizeBytes = response.locals.uploadSizeBytes as number;
    try {
      if (!session.storageKey) throw new HttpError(400, "Upload session storage key is missing");
      if (session.provider === "local") {
        await storageService.saveLocalObject(session.storageKey, createReadStream(tempPath));
        response.status(204).send();
        return;
      }
      if (session.provider !== "s3" || !session.directUploadUrl) {
        throw new HttpError(400, "Upload relay is only available for local or S3 storage");
      }

      const result = await storageService.uploadRemoteObject(
        session.directUploadUrl,
        session.method,
        createReadStream(tempPath),
        session.contentType ? { "Content-Type": session.contentType } : undefined,
        sizeBytes,
      );
      if (result.eTag) response.setHeader("ETag", result.eTag);
      response.status(204).send();
    } finally {
      await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  }),
);

uploadsRouter.get(
  "/content/*",
  asyncHandler(async (request, response) => {
    if (env.STORAGE_PROVIDER !== "local") throw new HttpError(404, "Media not found");
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    // Express has already decoded the wildcard parameter once. Decoding it a
    // second time lets double-encoded path traversal sequences become `../`.
    const storageKey = String(request.params[0]);
    let metadata: Awaited<ReturnType<typeof storageService.getObjectMetadata>>;

    try {
      metadata = await storageService.getObjectMetadata(storageKey);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new HttpError(404, "Media not found");
      }
      if (error instanceof HttpError && error.statusCode === 400) {
        throw new HttpError(404, "Media not found");
      }
      throw error;
    }

    if (metadata.contentType.startsWith("audio/") || storageKey.startsWith("masters/")) {
      throw new HttpError(403, "Start a playback session to access audio media");
    }

    const size = metadata.sizeBytes;
    const rangeHeader = request.headers.range;

    response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("Content-Type", metadata.contentType);

    if (!rangeHeader) {
      response.setHeader("Content-Length", String(size));
      const stream = storageService.createReadStream(storageKey);
      stream.on("error", () => {
        if (!response.headersSent) response.status(404).json({ error: "Media not found" });
        else response.destroy();
      });
      stream.pipe(response);
      return;
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);

    if (!match || (!match[1] && !match[2]) || size === 0) {
      response.setHeader("Content-Range", `bytes */${size}`);
      throw new HttpError(416, "Invalid range header");
    }

    const suffixLength = match[1] ? undefined : Number(match[2]);
    const start = suffixLength === undefined
      ? Number(match[1])
      : Math.max(size - suffixLength, 0);
    const end = suffixLength === undefined
      ? match[2] ? Number(match[2]) : size - 1
      : size - 1;

    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= size ||
      end < start ||
      end >= size
    ) {
      response.setHeader("Content-Range", `bytes */${size}`);
      throw new HttpError(416, "Invalid range header");
    }

    response.status(206);
    response.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    response.setHeader("Content-Length", String(end - start + 1));

    const stream = storageService.createReadStream(storageKey, start, end);
    stream.on("error", () => {
      if (!response.headersSent) response.status(404).json({ error: "Media not found" });
      else response.destroy();
    });
    stream.pipe(response);
  }),
);

uploadsRouter.post(
  "/sessions/:uploadSessionId/complete",
  requireSession,
  asyncHandler(async (request, response) => {
    const uploadSessionId = String(request.params.uploadSessionId);
    const session = await uploadsService.getSession(uploadSessionId);

    if (!session) {
      throw new HttpError(404, "Upload session not found");
    }

    const walletAddress = request.session!.walletAddress;

    if (session.trackId) {
      if (!(await tracksService.userOwnsTrack(walletAddress, session.trackId))) {
        throw new HttpError(404, "Track not found");
      }
    } else if (session.releaseId) {
      if (!(await releasesService.userOwnsRelease(walletAddress, session.releaseId))) {
        throw new HttpError(404, "Release not found");
      }
    } else {
      throw new HttpError(400, "Upload session target is missing");
    }

    const result = await uploadsService.completeSession({
      uploadSessionId,
      eTag: request.body?.eTag,
    });

    response.json(result);
  }),
);

export { uploadsRouter };
