import { Router } from "express";

import { requireAdminSession } from "../../middleware/require-admin-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { royaltiesService } from "./royalties.service.js";

const royaltiesRouter = Router();

royaltiesRouter.use(requireAdminSession);

royaltiesRouter.get(
  "/config",
  asyncHandler(async (_request, response) => {
    response.json({
      config: royaltiesService.getConfig(),
    });
  }),
);

royaltiesRouter.get(
  "/tracks/:trackId/splits",
  asyncHandler(async (request, response) => {
    response.json(
      await royaltiesService.listTrackSplits(String(request.params.trackId)),
    );
  }),
);

royaltiesRouter.get(
  "/tracks/:trackId/ledger",
  asyncHandler(async (request, response) => {
    response.json({
      items: await royaltiesService.listTrackLedgerEntries(
        String(request.params.trackId),
      ),
    });
  }),
);

royaltiesRouter.put(
  "/tracks/:trackId/splits",
  asyncHandler(async (request, response) => {
    response.json({
      split: await royaltiesService.upsertTrackSplits(
        String(request.params.trackId),
        request.body,
      ),
    });
  }),
);

royaltiesRouter.post(
  "/tracks/:trackId/splits/publish",
  asyncHandler(async (request, response) => {
    response.json(
      await royaltiesService.publishTrackSplit(String(request.params.trackId)),
    );
  }),
);

royaltiesRouter.get(
  "/tracks/:trackId/splits/verify",
  asyncHandler(async (request, response) => {
    response.json(
      await royaltiesService.verifyTrackSplit(String(request.params.trackId)),
    );
  }),
);

export { royaltiesRouter };
