import { Router } from "express";
import { requireSession } from "../../middleware/require-session.js";
import { requireAdminSession } from "../../middleware/require-admin-session.js";
import { requireSuperAdmin } from "../../middleware/require-super-admin.js";
import { onboardingWriteRateLimit } from "../../middleware/onboarding-write-rate-limit.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { referralsService } from "./referrals.service.js";

export const referralsRouter = Router();
referralsRouter.post("/capture", onboardingWriteRateLimit, asyncHandler(async (req,res) => { res.json(await referralsService.capture(req.body)); }));
referralsRouter.get("/me", requireSession, asyncHandler(async (req,res) => { res.json(await referralsService.mine(req.session!.walletAddress)); }));
export const adminReferralsRouter = Router();
adminReferralsRouter.use(requireAdminSession);
adminReferralsRouter.get("/", asyncHandler(async (_req,res) => { res.json(await referralsService.adminList()); }));
adminReferralsRouter.use(requireSuperAdmin);
adminReferralsRouter.post("/reconcile", asyncHandler(async (_req,res) => { res.json({ ...await referralsService.reconcile(), ...await referralsService.reconcilePayments() }); }));
adminReferralsRouter.post("/:id/exclude", asyncHandler(async (req,res) => { await referralsService.exclude(String(req.params.id),`admin:${req.adminSession!.adminId}`,req.body); res.json({ excluded: true }); }));
