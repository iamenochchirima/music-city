import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { paymentsService } from "./payments.service.js";
import { checkoutService } from "./checkout.service.js";
import { signedFinancialTransactionSchema } from "@music-city/shared";

const paymentsRouter = Router();
paymentsRouter.get(
  "/sales",
  requireSession,
  asyncHandler(async (request, response) => {
    response.json({
      items: await paymentsService.listTrackSales(
        request.session!.walletAddress,
      ),
    });
  }),
);

paymentsRouter.post(
  "/intents/:intentId/checkout",
  requireSession,
  asyncHandler(async (request, response) => {
    response.json({
      checkout: await checkoutService.prepare(
        request.session!.walletAddress,
        String(request.params.intentId),
      ),
    });
  }),
);
paymentsRouter.get(
  "/checkouts/:checkoutId",
  requireSession,
  asyncHandler(async (request, response) => {
    response.json({
      checkout: await checkoutService.get(
        request.session!.walletAddress,
        String(request.params.checkoutId),
      ),
    });
  }),
);
paymentsRouter.post(
  "/checkouts/:checkoutId/authorize",
  requireSession,
  asyncHandler(async (request, response) => {
    const input = signedFinancialTransactionSchema.parse(request.body);
    response.json({
      checkout: await checkoutService.authorize(
        request.session!.walletAddress,
        String(request.params.checkoutId),
        input.signedTransaction,
      ),
    });
  }),
);
paymentsRouter.post(
  "/checkouts/:checkoutId/submit",
  requireSession,
  asyncHandler(async (request, response) => {
    response.json({
      checkout: await checkoutService.submit(
        request.session!.walletAddress,
        String(request.params.checkoutId),
      ),
    });
  }),
);

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
