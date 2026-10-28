import { z } from "zod";
import {
  createRampOrderSchema, rampDirectionSchema, rampMarketSchema, rampOrderTermsSchema,
  rampProviderSchema, type CreateRampOrder, type RampOrder,
} from "@music-city/shared";
import { HttpError } from "../../utils/http-error.js";
import { createRampRepository } from "./ramp.repository.js";
import { rampSandboxConfigSchema } from "./sandbox-config.js";
import { env } from "../../config/env.js";

// Only an adapter with verified, current account-specific evidence may return a route.
const verifiedRouteSchema = z.object({
  provider: rampProviderSchema,
  direction: rampDirectionSchema,
  environment: z.literal("sandbox"),
  network: z.literal("stellar:testnet"),
  assetCode: z.enum(["USDC", "XLM"]),
  assetIssuer: z.string().optional(),
  market: rampMarketSchema,
  amountDecimals: z.number().int().min(0).max(18),
  minUnits: z.string().max(38).regex(/^(0|[1-9][0-9]*)$/),
  maxUnits: z.string().max(38).regex(/^(0|[1-9][0-9]*)$/),
  verifiedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
}).strict();
export type VerifiedRampRoute = z.infer<typeof verifiedRouteSchema>;
export type RampCapabilitySource = { routes(): Promise<VerifiedRampRoute[]> };
type Repository = Pick<ReturnType<typeof createRampRepository>, "getByRequest" | "reserve">;
type Owner = { userId: string; walletAddress: string };

function units(amount: string, decimals: number): string {
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > decimals) throw new HttpError(400, "Use the supported amount precision");
  const digits = `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+/, "") || "0";
  if (digits.length > 38 || digits === "0") throw new HttpError(400, "Enter a valid amount above zero");
  return digits;
}
function matches(input: CreateRampOrder, terms: RampOrder["terms"]) {
  return input.provider === terms.provider && input.direction === terms.direction &&
    input.assetCode === terms.assetCode && input.market.country === terms.market.country &&
    input.market.currency === terms.market.currency && input.market.method === terms.market.method &&
    units(input.amount, terms.amount.decimals) === terms.amount.units;
}

export function createRampService(repository: Repository, capabilities: RampCapabilitySource, now: () => number = Date.now) {
  async function routes() {
    const time = now();
    const candidates = z.array(z.unknown()).max(1000).parse(await capabilities.routes());
    const routes = candidates.flatMap((candidate) => {
      const parsed = verifiedRouteSchema.safeParse(candidate);
      return parsed.success ? [parsed.data] : [];
    });
    const eligible = routes.filter((route) => {
      if (Date.parse(route.verifiedAt) > time || Date.parse(route.expiresAt) <= time ||
          BigInt(route.minUnits) > BigInt(route.maxUnits) || BigInt(route.maxUnits) === 0n ||
          (route.assetCode === "USDC" && route.assetIssuer !== "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5") ||
          (route.direction === "sell" && (route.amountDecimals !== 7 || route.assetCode !== "USDC"))) return false;
      // Check provider, method, asset and amount together using the actual order contract.
      return rampOrderTermsSchema.safeParse({
        userId: "capability-check", walletAddress: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        requestId: "ed39ecdf-d398-49cb-86bf-54cac8329168", provider: route.provider,
        direction: route.direction, environment: route.environment, network: route.network,
        assetCode: route.assetCode, assetIssuer: route.assetIssuer, market: route.market,
        amount: { currency: route.direction === "buy" ? route.market.currency : route.assetCode,
          units: route.maxUnits, decimals: route.amountDecimals },
      }).success;
    });
    const routeKey = (route: VerifiedRampRoute) => JSON.stringify([route.provider, route.direction, route.assetCode,
      route.market.country, route.market.currency, route.market.method]);
    const counts = new Map<string, number>();
    for (const route of eligible) counts.set(routeKey(route), (counts.get(routeKey(route)) ?? 0) + 1);
    return eligible.filter((route) => counts.get(routeKey(route)) === 1);
  }
  return {
    routes,
    async create(owner: Owner, raw: unknown) {
      const input = createRampOrderSchema.parse(raw);
      const previous = await repository.getByRequest(owner.userId, input.requestId);
      if (previous) {
        if (previous.terms.walletAddress !== owner.walletAddress || !matches(input, previous.terms))
          throw new HttpError(409, "This request already exists with different terms");
        return { order: previous, created: false };
      }
      const matching = (await routes()).filter((route) => route.provider === input.provider &&
        route.direction === input.direction && route.assetCode === input.assetCode &&
        route.market.country === input.market.country && route.market.currency === input.market.currency &&
        route.market.method === input.market.method);
      if (matching.length !== 1) throw new HttpError(409, "This payment option is not available");
      const route = matching[0];
      const amountUnits = units(input.amount, route.amountDecimals);
      if (BigInt(amountUnits) < BigInt(route.minUnits) || BigInt(amountUnits) > BigInt(route.maxUnits))
        throw new HttpError(400, "Enter an amount within the available limits");
      const terms = rampOrderTermsSchema.parse({
        userId: owner.userId, walletAddress: owner.walletAddress, requestId: input.requestId,
        provider: route.provider, direction: route.direction, environment: route.environment, network: route.network,
        assetCode: route.assetCode, assetIssuer: route.assetIssuer, market: route.market,
        amount: { currency: route.direction === "buy" ? route.market.currency : route.assetCode,
          units: amountUnits, decimals: route.amountDecimals },
      });
      return repository.reserve(terms);
    },
  };
}

// No account-specific payment route has passed verification yet.
export const verifiedRampCapabilities: RampCapabilitySource = { async routes() { return []; } };

// Do not advertise a route until the corresponding launch path is configured.
export function createOperationalRampCapabilities(verified: RampCapabilitySource, configSource: () => unknown, proxyHops: number): RampCapabilitySource {
  return { async routes() {
    const config = rampSandboxConfigSchema.safeParse(configSource());
    if (!config.success || config.data.RAMPS_SANDBOX_ENABLED !== "true" || config.data.RAMPS_LAUNCH_IP_MODE !== "direct" ||
      !config.data.RAMPS_LAUNCH_ENCRYPTION_KEY || !config.data.MOONPAY_PK || !config.data.MOONPAY_SK || !config.data.MOONPAY_WEBHOOK || proxyHops !== 0)
      return [];
    return (await verified.routes()).filter((route) => route.provider === "moonpay" && route.direction === "buy" &&
      route.assetCode === config.data.RAMPS_SANDBOX_ASSET && ["moonpay", "both"].includes(config.data.RAMPS_SANDBOX_PROVIDERS));
  } };
}
export const operationalRampCapabilities = createOperationalRampCapabilities(verifiedRampCapabilities, () => process.env, env.TRUST_PROXY_HOPS);
