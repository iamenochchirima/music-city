import express, { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { onboardingWriteRateLimit } from "../../middleware/onboarding-write-rate-limit.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { usersService } from "./users.service.js";

const usersRouter = Router();

usersRouter.get(
  "/me",
  requireSession,
  asyncHandler(async (request, response) => {
    const profile = await usersService.getProfile(request.session!.walletAddress);

    response.json({ profile });
  }),
);

usersRouter.put(
  "/me",
  requireSession,
  asyncHandler(async (request, response) => {
    const profile = await usersService.upsertProfile(
      request.session!.walletAddress,
      request.body,
    );

    response.json({ profile });
  }),
);

usersRouter.get(
  "/me/onboarding",
  requireSession,
  asyncHandler(async (request, response) => {
    response.json(
      await usersService.getOnboardingState(request.session!.walletAddress),
    );
  }),
);

usersRouter.put(
  "/me/onboarding",
  requireSession,
  onboardingWriteRateLimit,
  asyncHandler(async (request, response) => {
    const profile = await usersService.saveOnboardingStep(
      request.session!.walletAddress,
      request.body,
    );

    response.json({ profile });
  }),
);

usersRouter.post(
  "/me/onboarding/complete",
  requireSession,
  onboardingWriteRateLimit,
  asyncHandler(async (request, response) => {
    const profile = await usersService.completeOnboarding(
      request.session!.walletAddress,
      request.body,
    );

    response.json({ profile });
  }),
);

usersRouter.post(
  "/me/media-upload-targets",
  requireSession,
  asyncHandler(async (request, response) => {
    response.status(201).json({
      uploadTarget: usersService.createMediaUploadTarget(
        request.session!.walletAddress,
        request.body,
      ),
    });
  }),
);

usersRouter.put(
  "/me/media/*",
  requireSession,
  express.raw({ type: "*/*", limit: "10mb" }),
  asyncHandler(async (request, response) => {
    if (!Buffer.isBuffer(request.body)) {
      response.status(400).json({ message: "Upload body is required" });
      return;
    }

    await usersService.uploadMedia(
      request.session!.walletAddress,
      decodeURIComponent(String(request.params[0])),
      request.body,
      Array.isArray(request.headers["content-type"])
        ? request.headers["content-type"][0]
        : request.headers["content-type"],
    );

    response.status(204).send();
  }),
);

usersRouter.get(
  "/artists/:artistId/releases",
  asyncHandler(async (request, response) => {
    response.json({
      items: await usersService.getPublicArtistReleases(
        String(request.params.artistId),
      ),
    });
  }),
);

usersRouter.get(
  "/artists/:artistId/tracks",
  asyncHandler(async (request, response) => {
    response.json({
      items: await usersService.getPublicArtistTracks(String(request.params.artistId)),
    });
  }),
);

usersRouter.get(
  "/artists/:artistId",
  asyncHandler(async (request, response) => {
    const profile = await usersService.getPublicArtistProfile(
      String(request.params.artistId),
    );

    response.json({ profile });
  }),
);

usersRouter.get(
  "/artists",
  asyncHandler(async (_request, response) => {
    response.json({ items: await usersService.listArtists() });
  }),
);

export { usersRouter };
