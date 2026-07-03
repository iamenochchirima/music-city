import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { adsService } from "./ads.service.js";

const adsRouter = Router();

adsRouter.use(requireSession);

adsRouter.get(
  "/playback-decision/:trackId",
  asyncHandler(async (request, response) => {
    response.json(
      await adsService.getPlaybackAdDecision(
        request.session!.walletAddress,
        String(request.params.trackId),
      ),
    );
  }),
);

adsRouter.post(
  "/impressions",
  asyncHandler(async (request, response) => {
    response.status(201).json({
      impression: await adsService.startImpression(
        request.session!.walletAddress,
        request.body,
      ),
    });
  }),
);

adsRouter.put(
  "/impressions/:id",
  asyncHandler(async (request, response) => {
    response.json({
      impression: await adsService.updateImpression(
        request.session!.walletAddress,
        String(request.params.id),
        request.body,
      ),
    });
  }),
);

export { adsRouter };
