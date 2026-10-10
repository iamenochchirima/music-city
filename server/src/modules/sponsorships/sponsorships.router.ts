import { Router } from "express";

import { requireAdminSession } from "../../middleware/require-admin-session.js";
import { requireSession } from "../../middleware/require-session.js";
import { requireSuperAdmin } from "../../middleware/require-super-admin.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { sponsorshipsService } from "./sponsorships.service.js";

export const sponsorshipsRouter = Router();
sponsorshipsRouter.get("/mine", requireSession, asyncHandler(async (req, res) => {
  res.json(await sponsorshipsService.getMyActivation(req.session!.walletAddress));
}));

export const adminSponsorshipsRouter = Router();
adminSponsorshipsRouter.use(requireAdminSession);
adminSponsorshipsRouter.get("/", asyncHandler(async (_req, res) => {
  res.json(await sponsorshipsService.getAdminReport());
}));
adminSponsorshipsRouter.use(requireSuperAdmin);
adminSponsorshipsRouter.put("/campaign", asyncHandler(async (req, res) => {
  res.json(await sponsorshipsService.updateCampaign(`admin:${req.adminSession!.adminId}`, req.body));
}));
adminSponsorshipsRouter.post("/reconcile", asyncHandler(async (_req, res) => {
  res.json(await sponsorshipsService.reconcile());
}));
