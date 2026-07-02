import { Router } from "express";

import { requireAdminSession } from "../../middleware/require-admin-session.js";
import { requireSuperAdmin } from "../../middleware/require-super-admin.js";
import { tokenService } from "../../services/token.service.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { adminService } from "./admin.service.js";

const adminRouter = Router();

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
  "/royalties/config",
  requireAdminSession,
  asyncHandler(async (_request, response) => {
    response.json({
      config: adminService.getRoyaltyConfig(),
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
