import { Router } from "express";
import { z } from "zod";

import { requireAdminSession } from "../../middleware/require-admin-session.js";
import { requireSuperAdmin } from "../../middleware/require-super-admin.js";
import { tokenService } from "../../services/token.service.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { adminService } from "./admin.service.js";

const adminRouter = Router();
const adminAnalyticsQuerySchema = z.object({
  windowDays: z.coerce.number().int().positive().optional(),
});

adminRouter.get(
  "/auth/bootstrap-status",
  asyncHandler(async (_request, response) => {
    response.json({
      bootstrapRequired: await adminService.bootstrapRequired(),
    });
  }),
);

adminRouter.post(
  "/auth/bootstrap",
  asyncHandler(async (request, response) => {
    const result = await adminService.bootstrap(request.body);
    const token = tokenService.issueAdminSession(result.session);

    response.status(201).json({
      admin: result.admin,
      session: {
        ...result.session,
        token,
      },
    });
  }),
);

adminRouter.post(
  "/auth/login",
  asyncHandler(async (request, response) => {
    const result = await adminService.login(request.body);
    const token = tokenService.issueAdminSession(result.session);

    response.json({
      admin: result.admin,
      session: {
        ...result.session,
        token,
      },
    });
  }),
);

adminRouter.get(
  "/auth/me",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json({
      admin: await adminService.getAdminById(request.adminSession!.adminId),
      session: request.adminSession,
    });
  }),
);

adminRouter.get(
  "/admins",
  requireAdminSession,
  asyncHandler(async (_request, response) => {
    response.json({
      items: await adminService.listAdmins(),
    });
  }),
);

adminRouter.post(
  "/admins",
  requireAdminSession,
  requireSuperAdmin,
  asyncHandler(async (request, response) => {
    response.status(201).json({
      admin: await adminService.createAdmin(request.body),
    });
  }),
);

adminRouter.get(
  "/ads",
  requireAdminSession,
  asyncHandler(async (_request, response) => {
    response.json(await adminService.listAds());
  }),
);

adminRouter.post(
  "/ads",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.status(201).json({
      ad: await adminService.createAd(request.body),
    });
  }),
);

adminRouter.get(
  "/ads/impressions",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json(
      await adminService.listAdImpressions({
        adId: typeof request.query.adId === "string" ? request.query.adId : undefined,
        status:
          typeof request.query.status === "string" ? request.query.status : undefined,
      }),
    );
  }),
);

adminRouter.put(
  "/ads/:id",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json({
      ad: await adminService.updateAd(String(request.params.id), request.body),
    });
  }),
);

adminRouter.delete(
  "/ads/:id",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json({
      ad: await adminService.archiveAd(String(request.params.id)),
    });
  }),
);

adminRouter.get(
  "/analytics",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json({
      analytics: await adminService.getAnalyticsOverview(
        adminAnalyticsQuerySchema.parse(request.query).windowDays,
      ),
    });
  }),
);

adminRouter.get(
  "/subscriptions/platform-plan",
  requireAdminSession,
  asyncHandler(async (_request, response) => {
    response.json({
      settings: await adminService.getPlatformSubscriptionSettings(),
    });
  }),
);

adminRouter.put(
  "/subscriptions/platform-plan",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json({
      settings: await adminService.updatePlatformSubscriptionSettings(
        request.body,
      ),
    });
  }),
);

adminRouter.get(
  "/subscriptions",
  requireAdminSession,
  asyncHandler(async (_request, response) => {
    response.json(await adminService.listSubscriptions());
  }),
);

adminRouter.get(
  "/users",
  requireAdminSession,
  asyncHandler(async (_request, response) => {
    response.json(await adminService.listUsers());
  }),
);

adminRouter.get(
  "/tracks",
  requireAdminSession,
  asyncHandler(async (_request, response) => {
    response.json(await adminService.listTracks());
  }),
);

adminRouter.get(
  "/analytics/overview",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    const windowDays =
      typeof request.query.windowDays === "string"
        ? Number(request.query.windowDays)
        : undefined;

    response.json(
      await adminService.getAnalyticsOverview(
        Number.isFinite(windowDays) ? windowDays : undefined,
      ),
    );
  }),
);

adminRouter.get(
  "/royalties/config",
  requireAdminSession,
  asyncHandler(async (_request, response) => {
    response.json({
      config: adminService.getRoyaltyConfig(),
    });
  }),
);

adminRouter.get(
  "/royalties/payout-settings",
  requireAdminSession,
  asyncHandler(async (_request, response) => {
    response.json({
      settings: await adminService.getRoyaltyPayoutSettings(),
    });
  }),
);

adminRouter.put(
  "/royalties/payout-settings",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json({
      settings: await adminService.updateRoyaltyPayoutSettings(request.body),
    });
  }),
);

adminRouter.get(
  "/royalties/fee-settings",
  requireAdminSession,
  asyncHandler(async (_request, response) => {
    response.json({
      settings: await adminService.getRoyaltyFeeSettings(),
    });
  }),
);

adminRouter.put(
  "/royalties/fee-settings",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json({
      settings: await adminService.updateRoyaltyFeeSettings(request.body),
    });
  }),
);

adminRouter.get(
  "/royalties/tracks/:trackId/splits",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json(
      await adminService.listTrackRoyaltySplits(String(request.params.trackId)),
    );
  }),
);

adminRouter.get(
  "/royalties/tracks/:trackId/ledger",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json({
      items: await adminService.listTrackRoyaltyLedger(
        String(request.params.trackId),
      ),
    });
  }),
);

adminRouter.get(
  "/royalties/ledger",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json({
      items: await adminService.listRoyaltyLedger({
        status:
          typeof request.query.status === "string"
            ? (request.query.status as
                | "pending"
                | "approved"
                | "paid"
                | "reversed")
            : undefined,
        recipientWalletAddress:
          typeof request.query.recipientWalletAddress === "string"
            ? request.query.recipientWalletAddress
            : undefined,
      }),
    });
  }),
);

adminRouter.post(
  "/royalties/ledger/approve",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json({
      items: await adminService.approveRoyaltyLedgerEntries(request.body),
    });
  }),
);

adminRouter.get(
  "/royalties/payouts",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json({
      items: await adminService.listRoyaltyPayouts({
        status:
          typeof request.query.status === "string"
            ? (request.query.status as
                | "pending"
                | "submitted"
                | "confirmed"
                | "failed"
                | "cancelled")
            : undefined,
        recipientWalletAddress:
          typeof request.query.recipientWalletAddress === "string"
            ? request.query.recipientWalletAddress
            : undefined,
      }),
    });
  }),
);

adminRouter.post(
  "/royalties/payouts/run",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json(await adminService.runRoyaltyPayouts(request.body));
  }),
);

adminRouter.post(
  "/royalties/payouts/reconcile",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json(await adminService.reconcileRoyaltyPayouts(request.body));
  }),
);

adminRouter.put(
  "/royalties/tracks/:trackId/splits",
  requireAdminSession,
  asyncHandler(async (request, response) => {
    response.json({
      split: await adminService.upsertTrackRoyaltySplits(
        String(request.params.trackId),
        request.body,
      ),
    });
  }),
);

adminRouter.get(
  "/treasury",
  requireAdminSession,
  asyncHandler(async (_request, response) => {
    response.json(await adminService.getTreasuryOverview());
  }),
);

adminRouter.put(
  "/treasury",
  requireAdminSession,
  requireSuperAdmin,
  asyncHandler(async (request, response) => {
    response.json(await adminService.updateTreasurySettings(request.body));
  }),
);

export { adminRouter };
