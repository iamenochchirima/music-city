import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { storageService } from "../../services/storage.service.js";
import { paymentsService } from "./payments.service.js";
import { checkoutService } from "./checkout.service.js";
import { signedFinancialTransactionSchema } from "@music-city/shared";

const audioExtensions: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/flac": ".flac",
  "audio/mp4": ".m4a",
  "audio/aac": ".aac",
  "audio/ogg": ".ogg",
  "audio/webm": ".webm",
};

const downloadFileName = (
  track: { id: string; artistName?: string; title: string; sourceFileName?: string },
  contentType: string,
) => {
  const extension =
    track.sourceFileName?.match(/(\.[a-z0-9]{1,5})$/i)?.[1]?.toLowerCase() ??
    audioExtensions[contentType] ??
    "";
  const base = `${track.artistName ?? "Music City"} - ${track.title}`
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return `${base || track.id}${extension}`;
};

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

paymentsRouter.get(
  "/tracks/:trackId/download",
  requireSession,
  asyncHandler(async (request, response) => {
    const { track, metadata } = await paymentsService.getTrackDownload(
      request.session!.walletAddress,
      String(request.params.trackId),
    );
    const fileName = downloadFileName(track, metadata.contentType);
    const asciiFileName = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");

    response.setHeader("Content-Type", metadata.contentType);
    response.setHeader("Content-Length", String(metadata.sizeBytes));
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    response.setHeader("Cache-Control", "private, no-store");

    const file = await storageService.openStoredObjectRange(
      track.masterStorageKey!,
      0,
      metadata.sizeBytes - 1,
    );
    file.stream.on("error", () => response.destroy());
    file.stream.pipe(response);
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
