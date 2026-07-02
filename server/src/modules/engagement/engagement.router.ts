import { Router } from "express";
import { z } from "zod";

import { optionalSession } from "../../middleware/optional-session.js";
import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { engagementService } from "./engagement.service.js";

const engagementRouter = Router();
const artistAnalyticsQuerySchema = z.object({
  windowDays: z.coerce.number().int().positive().optional(),
});

engagementRouter.get(
  "/artists/:artistId/follow-state",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      response.json({
        state: await engagementService.getArtistFollowState(
          request.session!.walletAddress,
          String(request.params.artistId),
        ),
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Unable to load follow state",
      );
    }
  }),
);

engagementRouter.post(
  "/artists/:artistId/follow",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      response.json({
        state: await engagementService.followArtist(
          request.session!.walletAddress,
          String(request.params.artistId),
        ),
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Unable to follow artist",
      );
    }
  }),
);

engagementRouter.delete(
  "/artists/:artistId/follow",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      response.json({
        state: await engagementService.unfollowArtist(
          request.session!.walletAddress,
          String(request.params.artistId),
        ),
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Unable to unfollow artist",
      );
    }
  }),
);

engagementRouter.get(
  "/tracks/:trackId/like-state",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      response.json({
        state: await engagementService.getTrackLikeState(
          request.session!.walletAddress,
          String(request.params.trackId),
        ),
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Unable to load like state",
      );
    }
  }),
);

engagementRouter.post(
  "/tracks/:trackId/like",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      response.json({
        state: await engagementService.likeTrack(
          request.session!.walletAddress,
          String(request.params.trackId),
        ),
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Unable to like track",
      );
    }
  }),
);

engagementRouter.get(
  "/tracks/:trackId/save-state",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      response.json({
        state: await engagementService.getTrackSaveState(
          request.session!.walletAddress,
          String(request.params.trackId),
        ),
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Unable to load save state",
      );
    }
  }),
);

engagementRouter.delete(
  "/tracks/:trackId/like",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      response.json({
        state: await engagementService.unlikeTrack(
          request.session!.walletAddress,
          String(request.params.trackId),
        ),
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Unable to unlike track",
      );
    }
  }),
);

engagementRouter.post(
  "/tracks/:trackId/save",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      response.json({
        state: await engagementService.saveTrack(
          request.session!.walletAddress,
          String(request.params.trackId),
        ),
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Unable to save track",
      );
    }
  }),
);

engagementRouter.delete(
  "/tracks/:trackId/save",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      response.json({
        state: await engagementService.unsaveTrack(
          request.session!.walletAddress,
          String(request.params.trackId),
        ),
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Unable to unsave track",
      );
    }
  }),
);

engagementRouter.post(
  "/releases/:releaseId/view",
  optionalSession,
  asyncHandler(async (request, response) => {
    try {
      await engagementService.recordReleaseView(
        String(request.params.releaseId),
        request.session?.walletAddress,
      );
      response.status(204).send();
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Unable to record release view",
      );
    }
  }),
);

engagementRouter.get(
  "/analytics/me/artist",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      response.json({
        analytics: await engagementService.getArtistAnalytics(
          request.session!.walletAddress,
          artistAnalyticsQuerySchema.parse(request.query).windowDays,
        ),
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Unable to load artist analytics",
      );
    }
  }),
);

export { engagementRouter };
