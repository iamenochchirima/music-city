import { Router } from "express";
import type { RampOrder } from "@music-city/shared";
import { requireAdminSession } from "../../middleware/require-admin-session.js";
import { databaseService } from "../../services/database.service.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { createRampRepository } from "./ramp.repository.js";
import { publicOrder } from "./ramps.router.js";

type Repository = Pick<ReturnType<typeof createRampRepository>, "listForAdmin" | "detailForAdmin">;
function adminOrder(order: RampOrder) {
  return { ...publicOrder(order), userId: order.terms.userId, walletAddress: order.terms.walletAddress,
    providerTransactionId: order.providerTransactionId ?? null };
}
export function createAdminRampsRouter(repository: Repository) {
  const router = Router();
  router.use(requireAdminSession);
  router.get("/", asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "no-store").json({ items: (await repository.listForAdmin()).map(adminOrder) });
  }));
  router.get("/:id", asyncHandler(async (req, res) => {
    const detail = await repository.detailForAdmin(String(req.params.id));
    if (!detail) throw new HttpError(404, "Transaction not found");
    res.set("Cache-Control", "no-store").json({ ...detail, order: adminOrder(detail.order) });
  }));
  return router;
}
export const adminRampsRouter = createAdminRampsRouter(createRampRepository(databaseService));
