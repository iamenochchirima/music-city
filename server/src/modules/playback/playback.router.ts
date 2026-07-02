import {
  createPlaybackSessionSchema,
  recordPlaybackEventSchema,
} from "@music-city/shared";
import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { entitlementsService } from "../entitlements/entitlements.service.js";
import { engagementService } from "../engagement/engagement.service.js";
import { tracksService } from "../tracks/tracks.service.js";
import { usersService } from "../users/users.service.js";
import { playbackService } from "./playback.service.js";

const playbackRouter = Router();

playbackRouter.use((_request, response, next) => {
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});

playbackRouter.post(
  "/sessions",
  requireSession,
  asyncHandler(async (request, response) => {
    const input = createPlaybackSessionSchema.parse(request.body);
    const track = await tracksService.getTrackForPlayback(input.trackId);

    if (!track) {
      throw new HttpError(404, "Track not found");
    }

    const canPlay = await entitlementsService.canPlayTrack(
      request.session!.walletAddress,
      input.trackId,
    );

    if (!canPlay) {
      throw new HttpError(403, "You do not have access to this track");
    }

    const profile = await usersService.getProfile(request.session!.walletAddress);

    if (!profile) {
      throw new HttpError(401, "Profile not found");
    }

    const playbackSession = await playbackService.createSession(
      input.trackId,
      profile.id,
    );

    response.status(201).json({
      playbackSession,
    });
  }),
);

playbackRouter.post(
  "/sessions/:sessionId/events",
  requireSession,
  asyncHandler(async (request, response) => {
    const session = await playbackService.getSession(
      String(request.params.sessionId),
      String(request.body?.token ?? ""),
    );
    const profile = await usersService.getProfile(request.session!.walletAddress);

    if (!profile || session.listenerUserId !== profile.id) {
      throw new HttpError(403, "Playback session does not belong to this user");
    }

    const playbackSession = await engagementService.recordPlaybackEvent(
      session,
      recordPlaybackEventSchema.parse(request.body),
    );

    response.json({ playbackSession });
  }),
);

playbackRouter.get(
  "/sessions/:sessionId/manifest.m3u8",
  asyncHandler(async (request, response) => {
    const token = String(request.query.token ?? "");
    const manifest = await playbackService.getManifest(
      String(request.params.sessionId),
      token,
    );

    response.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    response.send(manifest);
  }),
);

playbackRouter.get(
  "/sessions/:sessionId/media",
  asyncHandler(async (request, response) => {
    const token = String(request.query.token ?? "");
    const url = await playbackService.getMediaRedirect(
      String(request.params.sessionId),
      token,
    );

    response.redirect(url);
  }),
);

export { playbackRouter };
