import { Router } from "express";
import { z } from "zod";
import type { UserProfile } from "@music-city/shared";
import { requireSession } from "../../middleware/require-session.js";
import { databaseService } from "../../services/database.service.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { usersRepository } from "../users/users.repository.js";
import { createRampRepository } from "../ramps/ramp.repository.js";
import { createRampService, verifiedRampCapabilities } from "../ramps/ramp-service.js";
import { rampSandboxConfigSchema } from "../ramps/sandbox-config.js";
import { createCashOutAuthorizationService } from "./cashout-authorization.service.js";
import { createCashOutChain } from "./cashout-chain.js";
import { createCashOutEnvelopeCipher } from "./cashout-envelope.js";

type Service = ReturnType<typeof createCashOutAuthorizationService>;
type FindUser = (wallet: string) => Promise<Pick<UserProfile, "id"> | null | undefined>;
const uuid = z.string().uuid();

export function createCashOutAuthorizationRouter(service: () => Service, findUser: FindUser) {
  const router = Router({ mergeParams: true });
  router.use(requireSession);
  async function owner(walletAddress: string) {
    const user = await findUser(walletAddress);
    if (!user) throw new HttpError(404, "Account not found");
    return { userId: user.id, walletAddress };
  }
  router.get("/transfer", asyncHandler(async (req, res) => {
    const result = await service().latest(String(req.params.orderId), await owner(req.session!.walletAddress));
    res.set("Cache-Control", "no-store").json({ transfer: result });
  }));
  router.post("/transfer", asyncHandler(async (req, res) => {
    const body = z.object({ quoteId: uuid, confirmationHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(req.body);
    const transfer = await service().prepare(String(req.params.orderId), body.quoteId, body.confirmationHash, await owner(req.session!.walletAddress));
    res.set("Cache-Control", "no-store").json({ transfer: { ...transfer, transaction: transfer.state === "prepared" ? transfer.transaction : null } });
  }));
  router.post("/transfer/:attemptId/authorize", asyncHandler(async (req, res) => {
    const attemptId = uuid.parse(req.params.attemptId);
    const body = z.object({ signedXdr: z.string().min(1).max(200000) }).strict().parse(req.body);
    const transfer = await service().authorize(String(req.params.orderId), attemptId, body.signedXdr, await owner(req.session!.walletAddress));
    res.set("Cache-Control", "no-store").json({ transfer });
  }));
  router.post("/transfer/:attemptId/cancel", asyncHandler(async (req, res) => {
    const attemptId = uuid.parse(req.params.attemptId);
    z.object({}).strict().parse(req.body);
    await service().cancel(String(req.params.orderId), attemptId, await owner(req.session!.walletAddress));
    res.set("Cache-Control", "no-store").status(204).end();
  }));
  return router;
}

const repository = createRampRepository(databaseService);
const capabilities = createRampService(repository, verifiedRampCapabilities);
function configuredService() {
  const config = rampSandboxConfigSchema.safeParse(process.env);
  if (!config.success || config.data.RAMPS_SANDBOX_ENABLED !== "true" || !config.data.RAMPS_CASHOUT_ENCRYPTION_KEY)
    throw new HttpError(503, "Cash-out is not available yet");
  return createCashOutAuthorizationService(repository, createCashOutChain(), createCashOutEnvelopeCipher(Buffer.from(config.data.RAMPS_CASHOUT_ENCRYPTION_KEY, "hex")), async (order) =>
    (await capabilities.routes()).some((route) => route.provider === order.terms.provider && route.direction === "sell" &&
      route.environment === order.terms.environment && route.network === order.terms.network && route.assetCode === order.terms.assetCode &&
      route.assetIssuer === order.terms.assetIssuer && route.market.country === order.terms.market.country &&
      route.market.currency === order.terms.market.currency && route.market.method === order.terms.market.method &&
      route.amountDecimals === order.terms.amount.decimals && BigInt(order.terms.amount.units) >= BigInt(route.minUnits) &&
      BigInt(order.terms.amount.units) <= BigInt(route.maxUnits)));
}
export const cashOutAuthorizationRouter = createCashOutAuthorizationRouter(configuredService, usersRepository.findByWallet);
