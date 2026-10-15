import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../../middleware/require-session.js";
import { requireAdminSession } from "../../middleware/require-admin-session.js";
import { requireSuperAdmin } from "../../middleware/require-super-admin.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { databaseService } from "../../services/database.service.js";
import { settlementService } from "./settlement.service.js";

export const settlementsRouter = Router();
settlementsRouter.use(requireSession);
settlementsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({
      items: await settlementService.list(req.session!.walletAddress),
    });
  }),
);
settlementsRouter.get(
  "/balances",
  asyncHandler(async (req, res) => {
    res.json(await settlementService.balances(req.session!.walletAddress));
  }),
);
settlementsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(
      await settlementService.detail(
        String(req.params.id),
        req.session!.walletAddress,
      ),
    );
  }),
);
settlementsRouter.post(
  "/:id/claims/:index/prepare",
  asyncHandler(async (req, res) => {
    const index = z.coerce
      .number()
      .int()
      .min(0)
      .max(19)
      .parse(req.params.index);
    res.status(201).json({
      attempt: await settlementService.prepare(
        String(req.params.id),
        "claim",
        req.session!.walletAddress,
        index,
      ),
    });
  }),
);
settlementsRouter.post(
  "/attempts/:id/signatures",
  asyncHandler(async (req, res) => {
    res.json({
      attempt: await settlementService.addSignature(
        String(req.params.id),
        req.session!.walletAddress,
        req.body,
      ),
    });
  }),
);
settlementsRouter.post(
  "/attempts/:id/submit",
  asyncHandler(async (req, res) => {
    res.json({
      attempt: await settlementService.submit(
        String(req.params.id),
        req.session!.walletAddress,
      ),
    });
  }),
);

export const adminSettlementsRouter = Router();
adminSettlementsRouter.use(requireAdminSession);
adminSettlementsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ items: await settlementService.list() });
  }),
);
adminSettlementsRouter.get(
  "/sources",
  asyncHandler(async (_req, res) => {
    const items = await databaseService.transaction(
      async (client) =>
        (
          await client.query(
            'SELECT l.track_id AS "trackId",l.source_type AS "sourceType",l.source_id AS "sourceId",count(*)::int AS allocations FROM royalty_ledger l WHERE l.status=\'approved\' AND NOT EXISTS(SELECT 1 FROM settlement_reservations r WHERE r.ledger_id=l.id) GROUP BY l.track_id,l.source_type,l.source_id ORDER BY l.track_id,l.source_id LIMIT 200',
          )
        ).rows,
    );
    res.json({ items });
  }),
);
adminSettlementsRouter.get(
  "/reconciliation",
  asyncHandler(async (_req, res) => {
    res.json(await settlementService.latestReconciliation());
  }),
);
adminSettlementsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await settlementService.detail(String(req.params.id)));
  }),
);
adminSettlementsRouter.use(requireSuperAdmin);
adminSettlementsRouter.post(
  "/preview",
  asyncHandler(async (req, res) => {
    res.json({ batch: await settlementService.preview(req.body) });
  }),
);
adminSettlementsRouter.post(
  "/reserve",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        previewId: z.string().regex(/^[a-f0-9]{64}$/),
        source: z.unknown(),
      })
      .strict()
      .parse(req.body);
    res.status(201).json({
      batch: await settlementService.reserve(
        input.source,
        input.previewId,
        `admin:${req.adminSession!.adminId}`,
      ),
    });
  }),
);
adminSettlementsRouter.post(
  "/:id/prepare",
  asyncHandler(async (req, res) => {
    res.status(201).json({
      attempt: await settlementService.prepare(
        String(req.params.id),
        "settle",
        `admin:${req.adminSession!.adminId}`,
      ),
    });
  }),
);
adminSettlementsRouter.post(
  "/:id/claims/:index/reclaim",
  asyncHandler(async (req, res) => {
    const index = z.coerce
      .number()
      .int()
      .min(0)
      .max(19)
      .parse(req.params.index);
    res.status(201).json({
      attempt: await settlementService.prepare(
        String(req.params.id),
        "reclaim",
        `admin:${req.adminSession!.adminId}`,
        index,
      ),
    });
  }),
);
adminSettlementsRouter.post(
  "/attempts/:id/signatures",
  asyncHandler(async (req, res) => {
    res.json({
      attempt: await settlementService.addSignature(
        String(req.params.id),
        `admin:${req.adminSession!.adminId}`,
        req.body,
        true,
      ),
    });
  }),
);
adminSettlementsRouter.post(
  "/attempts/:id/submit",
  asyncHandler(async (req, res) => {
    res.json({
      attempt: await settlementService.submit(
        String(req.params.id),
        `admin:${req.adminSession!.adminId}`,
        true,
      ),
    });
  }),
);

adminSettlementsRouter.post(
  "/:id/maintenance",
  asyncHandler(async (req, res) => {
    res.status(201).json({
      attempt: await settlementService.prepare(
        String(req.params.id),
        "maintain",
        `admin:${req.adminSession!.adminId}`,
      ),
    });
  }),
);
