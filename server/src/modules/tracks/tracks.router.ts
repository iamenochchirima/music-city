import { Router } from "express";
import { ZodError } from "zod";

import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { tracksService } from "./tracks.service.js";

const tracksRouter = Router();

tracksRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json({ items: await tracksService.listTracks() });
  }),
);

tracksRouter.get(
  "/mine",
  requireSession,
  asyncHandler(async (request, response) => {
    response.json({
      items: await tracksService.listMyTracks(request.session!.walletAddress),
    });
  }),
);

tracksRouter.get(
  "/:trackId/manage",
  requireSession,
  asyncHandler(async (request, response) => {
    const track = await tracksService.getManageTrack(
      request.session!.walletAddress,
      String(request.params.trackId),
    );

    if (!track) {
      throw new HttpError(404, "Track not found");
    }

    response.json({ track });
  }),
);

tracksRouter.get(
  "/:trackId",
  asyncHandler(async (request, response) => {
    response.json({
      track: await tracksService.getTrack(String(request.params.trackId)),
    });
  }),
);

tracksRouter.put(
  "/:trackId/monetization",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const track = await tracksService.updateTrackMonetization(
        request.session!.walletAddress,
        String(request.params.trackId),
        request.body,
      );

      response.json({ track });
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Track monetization update failed",
      );
    }
  }),
);

tracksRouter.put(
  "/:trackId/metadata",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const track = await tracksService.updateTrackMetadata(
        request.session!.walletAddress,
        String(request.params.trackId),
        request.body,
      );

      response.json({ track });
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Track metadata update failed",
      );
    }
  }),
);

tracksRouter.post(
  "/",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const track = await tracksService.createTrack(
        request.session!.walletAddress,
        request.body,
      );

      response.status(201).json({ track });
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Track creation failed",
      );
    }
  }),
);

tracksRouter.post(
  "/:trackId/sync-media",
  requireSession,
  asyncHandler(async (request, response) => {
    const trackId = String(request.params.trackId);
    const ownsTrack = await tracksService.userOwnsTrack(
      request.session!.walletAddress,
      trackId,
    );

    if (!ownsTrack) {
      throw new HttpError(404, "Track not found");
    }

    try {
      const track = await tracksService.syncMuxTrack(trackId);
      response.json({ track });
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Track sync failed",
      );
    }
  }),
);

tracksRouter.delete(
  "/:trackId",
  requireSession,
  asyncHandler(async (request, response) => {
    const trackId = String(request.params.trackId);

    try {
      await tracksService.deleteTrack(request.session!.walletAddress, trackId);
      response.status(204).send();
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Track delete failed",
      );
    }
  }),
);

export { tracksRouter };
