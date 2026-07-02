import express, { Router } from "express";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { storageService } from "../../services/storage.service.js";
import { HttpError } from "../../utils/http-error.js";
import { releasesService } from "../releases/releases.service.js";
import { tracksService } from "../tracks/tracks.service.js";
import { uploadsService } from "./uploads.service.js";

const uploadsRouter = Router();

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

    response.status(201).json({
      uploadSession: await uploadsService.createSession(request.body),
    });
  }),
);

uploadsRouter.put(
  "/sessions/:uploadSessionId/content",
  requireSession,
  express.raw({ type: "*/*", limit: "500mb" }),
  asyncHandler(async (request, response) => {
    const uploadSessionId = String(request.params.uploadSessionId);
    const session = await uploadsService.requireActiveSession(uploadSessionId);
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

    if (!Buffer.isBuffer(request.body)) {
      throw new HttpError(400, "Upload body is required");
    }

    if (session.provider === "local") {
      if (!session.storageKey) {
        throw new HttpError(400, "Upload session storage key is missing");
      }

      await storageService.saveLocalObject(
        session.storageKey,
        Readable.from(request.body) as unknown as NodeJS.ReadableStream,
      );

      response.status(204).send();
      return;
    }

    if (session.provider !== "s3" || !session.directUploadUrl) {
      throw new HttpError(400, "Upload relay is only available for local or S3 storage");
    }

    const result = await storageService.uploadRemoteObject(
      session.directUploadUrl,
      session.method,
      request.body,
      session.contentType
        ? {
            "Content-Type": session.contentType,
          }
        : undefined,
    );

    if (result.eTag) {
      response.setHeader("ETag", result.eTag);
    }

    response.status(204).send();
  }),
);

uploadsRouter.get(
  "/content/*",
  asyncHandler(async (request, response) => {
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    const storageKey = decodeURIComponent(String(request.params[0]));
    const filePath = storageService.getLocalPath(storageKey);
    const fileStats = await stat(filePath);
    const metadata = await storageService.getObjectMetadata(storageKey);
    const rangeHeader = request.headers.range;

    response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("Content-Type", metadata.contentType);

    if (!rangeHeader) {
      response.setHeader("Content-Length", String(fileStats.size));
      storageService.createReadStream(storageKey).pipe(response);
      return;
    }

    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);

    if (!match) {
      throw new HttpError(416, "Invalid range header");
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : fileStats.size - 1;

    response.status(206);
    response.setHeader("Content-Range", `bytes ${start}-${end}/${fileStats.size}`);
    response.setHeader("Content-Length", String(end - start + 1));

    storageService
      .createReadStream(storageKey, start, end)
      .pipe(response);
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
