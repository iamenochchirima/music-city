import { BlockList, isIP } from "node:net";
import { Router, type Request } from "express";
import { z } from "zod";
import type { UserProfile } from "@music-city/shared";
import { env } from "../../config/env.js";
import { requireSession } from "../../middleware/require-session.js";
import { databaseService } from "../../services/database.service.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { usersRepository } from "../users/users.repository.js";
import { createCashOutEnvelopeCipher } from "../cashout/cashout-envelope.js";
import { canonicalizeMoonpayIp } from "./moonpay-ip.js";
import { createRampRepository } from "./ramp.repository.js";
import { createRampService, operationalRampCapabilities } from "./ramp-service.js";
import { createMoonpayLaunchAdapter, createRampLaunchService } from "./ramp-launch.service.js";
import { rampSandboxConfigSchema } from "./sandbox-config.js";

const nonPublic = new BlockList();
for (const [network, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) nonPublic.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32]] as const) nonPublic.addSubnet(network, prefix, "ipv6");

export function directCustomerIp(request: Pick<Request, "socket">, mode: string, proxyHops: number) {
  // Direct mode deliberately ignores forwarding headers. Proxy ingress needs its own verified adapter.
  if (mode !== "direct" || proxyHops !== 0 || !request.socket.remoteAddress)
    throw new HttpError(503, "Payments are not available on this connection");
  const ip = canonicalizeMoonpayIp(request.socket.remoteAddress);
  const family = isIP(ip);
  if (!family || nonPublic.check(ip, family === 4 ? "ipv4" : "ipv6"))
    throw new HttpError(503, "Payments are not available on this connection");
  return [ip];
}

type Service = ReturnType<typeof createRampLaunchService>;
type FindUser = (wallet: string) => Promise<Pick<UserProfile, "id"> | null | undefined>;
export function createRampLaunchRouter(service: () => Service, findUser: FindUser, clientIp: (request: Request) => string[]) {
  const router = Router({ mergeParams: true });
  router.use(requireSession);
  router.post("/launch", asyncHandler(async (req, res) => {
    z.object({}).strict().parse(req.body);
    const walletAddress = req.session!.walletAddress;
    const user = await findUser(walletAddress);
    if (!user) throw new HttpError(404, "Account not found");
    const result = await service().launch(String(req.params.orderId), { userId: user.id, walletAddress }, clientIp(req));
    res.set("Cache-Control", "no-store").status(result.created ? 201 : 200).json({ url: result.url });
  }));
  return router;
}

const repository = createRampRepository(databaseService);
const capabilities = createRampService(repository, operationalRampCapabilities);
function configuredService() {
  const config = rampSandboxConfigSchema.safeParse(process.env);
  if (!config.success || config.data.RAMPS_SANDBOX_ENABLED !== "true" || !config.data.RAMPS_LAUNCH_ENCRYPTION_KEY || config.data.RAMPS_LAUNCH_IP_MODE !== "direct" || env.TRUST_PROXY_HOPS !== 0)
    throw new HttpError(503, "This payment option is not available yet");
  const adapter = createMoonpayLaunchAdapter(config.data);
  return createRampLaunchService(repository, new Map([["moonpay", adapter]]), createCashOutEnvelopeCipher(Buffer.from(config.data.RAMPS_LAUNCH_ENCRYPTION_KEY, "hex")), async (order) =>
    (await capabilities.routes()).some((route) => route.provider === order.terms.provider && route.direction === order.terms.direction &&
      route.environment === order.terms.environment && route.network === order.terms.network && route.assetCode === order.terms.assetCode &&
      route.assetIssuer === order.terms.assetIssuer && route.market.country === order.terms.market.country && route.market.currency === order.terms.market.currency &&
      route.market.method === order.terms.market.method && route.amountDecimals === order.terms.amount.decimals &&
      BigInt(order.terms.amount.units) >= BigInt(route.minUnits) && BigInt(order.terms.amount.units) <= BigInt(route.maxUnits)));
}
export const rampLaunchRouter = createRampLaunchRouter(configuredService, usersRepository.findByWallet,
  (req) => directCustomerIp(req, rampSandboxConfigSchema.parse(process.env).RAMPS_LAUNCH_IP_MODE, env.TRUST_PROXY_HOPS));
