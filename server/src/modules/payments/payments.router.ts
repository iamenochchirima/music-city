import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { paymentsService } from "./payments.service.js";

const paymentsRouter = Router();

paymentsRouter.get(
  "/mine",
  requireSession,
  asyncHandler(async (request, response) => {
    response.json({
      items: await paymentsService.listMine(request.session!.walletAddress),
    });
  }),
);

paymentsRouter.get(
  "/artist-onboarding-fee/status",
  requireSession,
  asyncHandler(async (request, response) => {
    response.json(
      await paymentsService.getArtistOnboardingFeeStatus(
        request.session!.walletAddress,
      ),
    );
  }),
);

paymentsRouter.post(
  "/intents/track/:trackId",
  requireSession,
  asyncHandler(async (request, response) => {
    response.status(201).json({
      intent: await paymentsService.createTrackPurchaseIntent(
        request.session!.walletAddress,
        String(request.params.trackId),
      ),
    });
  }),
);

paymentsRouter.post(
  "/intents/platform-subscription",
  requireSession,
  asyncHandler(async (request, response) => {
    response.status(201).json({
      intent: await paymentsService.createPlatformSubscriptionIntent(
        request.session!.walletAddress,
      ),
    });
  }),
);

paymentsRouter.post(
  "/intents/artist-onboarding-fee",
  requireSession,
  asyncHandler(async (request, response) => {
    response.status(201).json({
      intent: await paymentsService.createArtistOnboardingFeeIntent(
        request.session!.walletAddress,
      ),
    });
  }),
);

paymentsRouter.post(
  "/confirm",
  requireSession,
  asyncHandler(async (request, response) => {
    response.json(
      await paymentsService.confirm(
        request.session!.walletAddress,
        request.body,
      ),
    );
  }),
);

export { paymentsRouter };
