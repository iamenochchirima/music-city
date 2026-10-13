import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { entitlementsService } from "./entitlements.service.js";

const entitlementsRouter = Router();

entitlementsRouter.get(
  "/mine",
  requireSession,
  asyncHandler(async (request, response) => {
    response.json({
      items: await entitlementsService.listMine(request.session!.walletAddress),
    });
  }),
);

export { entitlementsRouter };
