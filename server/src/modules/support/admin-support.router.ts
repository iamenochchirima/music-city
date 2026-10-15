import { Router } from "express";
import { requireAdminSession } from "../../middleware/require-admin-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { databaseService } from "../../services/database.service.js";
export const adminSupportRouter = Router();
adminSupportRouter.use(requireAdminSession);
adminSupportRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await databaseService.transaction(async (client) =>
      (
        await client.query(
          "SELECT payload FROM support_payments ORDER BY payload->>'createdAt' DESC LIMIT 200",
        )
      ).rows.map((r) => r.payload),
    );
    res.json({ items });
  }),
);
adminSupportRouter.get(
  "/:id/events",
  asyncHandler(async (req, res) => {
    const items = await databaseService.transaction(
      async (client) =>
        (
          await client.query(
            "SELECT id,action,payload,created_at FROM support_events WHERE payment_id=$1 ORDER BY id",
            [String(req.params.id)],
          )
        ).rows,
    );
    res.json({ items });
  }),
);
