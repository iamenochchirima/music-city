import { Router } from "express";
import { requireAdminSession } from "../../middleware/require-admin-session.js";
import { requireSuperAdmin } from "../../middleware/require-super-admin.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { finalizationService } from "./finalization.service.js";

export const adminAgreementsRouter = Router();
adminAgreementsRouter.use(requireAdminSession);
adminAgreementsRouter.get("/",asyncHandler(async (_req,res) => { res.json({ items: await finalizationService.list() }); }));
adminAgreementsRouter.get("/:id",asyncHandler(async (req,res) => { res.json(await finalizationService.detail(String(req.params.id),`admin:${req.adminSession!.adminId}`)); }));
adminAgreementsRouter.use(requireSuperAdmin);
adminAgreementsRouter.post("/:id/resolutions",asyncHandler(async (req,res) => {
  res.status(201).json({ version: await finalizationService.resolveDispute(String(req.params.id),`admin:${req.adminSession!.adminId}`,req.body) });
}));
adminAgreementsRouter.post("/:id/finalizations",asyncHandler(async (req,res) => {
  res.status(201).json({ finalization: await finalizationService.prepare(String(req.params.id),`admin:${req.adminSession!.adminId}`) });
}));
adminAgreementsRouter.post("/:id/finalizations/:attemptId/signatures",asyncHandler(async (req,res) => {
  res.json({ finalization: await finalizationService.addSignatures(String(req.params.id),String(req.params.attemptId),`admin:${req.adminSession!.adminId}`,req.body) });
}));
adminAgreementsRouter.post("/:id/finalizations/:attemptId/submit",asyncHandler(async (req,res) => {
  res.json({ finalization: await finalizationService.submit(String(req.params.id),String(req.params.attemptId),`admin:${req.adminSession!.adminId}`) });
}));
adminAgreementsRouter.post("/:id/finalizations/:attemptId/reconcile",asyncHandler(async (req,res) => {
  res.json({ finalization: await finalizationService.reconcile(String(req.params.id),String(req.params.attemptId),`admin:${req.adminSession!.adminId}`) });
}));
