import { Router } from "express";
import type { RampOrder, UserProfile } from "@music-city/shared";
import { requireSession } from "../../middleware/require-session.js";
import { databaseService } from "../../services/database.service.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { usersRepository } from "../users/users.repository.js";
import { createRampRepository } from "./ramp.repository.js";

type Repository = Pick<ReturnType<typeof createRampRepository>, "list" | "getForOwner">;
type FindUser = (wallet: string) => Promise<Pick<UserProfile, "id"> | null | undefined>;

// Provider state and chain state are deliberately separate: neither implies the other.
function publicOrder(order: RampOrder) {
  return {
    id: order.id,
    provider: order.terms.provider,
    direction: order.terms.direction,
    environment: order.terms.environment,
    network: order.terms.network,
    assetCode: order.terms.assetCode,
    market: order.terms.market,
    amount: order.terms.amount,
    providerState: order.providerState,
    chainState: order.chainState,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function createRampsRouter(repository: Repository, findUser: FindUser) {
  const router = Router();
  router.use(requireSession);
  async function owner(wallet: string) {
    const user = await findUser(wallet);
    if (!user) throw new HttpError(404, "Account not found");
    return user.id;
  }
  router.get("/", asyncHandler(async (req, res) => {
    const wallet = req.session!.walletAddress;
    const userId = await owner(wallet);
    res.set("Cache-Control", "no-store").json({ items: (await repository.list(userId, wallet)).map(publicOrder) });
  }));
  router.get("/:id", asyncHandler(async (req, res) => {
    const wallet = req.session!.walletAddress;
    const userId = await owner(wallet);
    const order = await repository.getForOwner(String(req.params.id), userId, wallet);
    if (!order) throw new HttpError(404, "Transaction not found");
    res.set("Cache-Control", "no-store").json({ order: publicOrder(order) });
  }));
  return router;
}

export const rampsRouter = createRampsRouter(createRampRepository(databaseService), usersRepository.findByWallet);
