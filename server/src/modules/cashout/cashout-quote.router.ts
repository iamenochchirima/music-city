import { Router } from "express";
import { z } from "zod";
import type { UserProfile } from "@music-city/shared";
import { requireSession } from "../../middleware/require-session.js";
import { databaseService } from "../../services/database.service.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { usersRepository } from "../users/users.repository.js";
import { createRampRepository } from "../ramps/ramp.repository.js";
import { createCashOutQuoteService } from "./cashout-quote.service.js";

type Service = ReturnType<typeof createCashOutQuoteService>;
type FindUser = (wallet: string) => Promise<Pick<UserProfile, "id"> | null | undefined>;
function publicQuote(result: Awaited<ReturnType<Service["get"]>>) {
  return { quote: result.snapshot.quote, transfer: result.snapshot.instructions, confirmationHash: result.hash, expiresAt: result.expiresAt };
}
export function createCashOutQuoteRouter(service: Service, findUser: FindUser) {
  const router = Router({ mergeParams: true });
  router.use(requireSession);
  async function owner(walletAddress: string) {
    const user = await findUser(walletAddress);
    if (!user) throw new HttpError(404, "Account not found");
    return { userId: user.id, walletAddress };
  }
  router.post("/quotes", asyncHandler(async (req, res) => {
    z.object({}).strict().parse(req.body);
    const result = await service.request(String(req.params.orderId), await owner(req.session!.walletAddress));
    res.set("Cache-Control", "no-store").status(201).json(publicQuote(result));
  }));
  router.get("/quotes/:quoteId", asyncHandler(async (req, res) => {
    const result = await service.get(String(req.params.orderId), String(req.params.quoteId), await owner(req.session!.walletAddress));
    res.set("Cache-Control", "no-store").json(publicQuote(result));
  }));
  return router;
}
// No cash-out provider has supplied a verified instruction adapter yet.
export const cashOutQuoteRouter = createCashOutQuoteRouter(createCashOutQuoteService(createRampRepository(databaseService), new Map()), usersRepository.findByWallet);
