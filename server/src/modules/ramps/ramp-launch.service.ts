import type { RampOrder } from "@music-city/shared";
import { HttpError } from "../../utils/http-error.js";
import type { createCashOutEnvelopeCipher } from "../cashout/cashout-envelope.js";
import type { createRampRepository } from "./ramp.repository.js";
import { decimalAmount, MoonpaySandbox } from "./moonpay-sandbox.js";
import type { RampSandboxConfig } from "./sandbox-config.js";

type Owner = { userId: string; walletAddress: string };
type Repository = Pick<ReturnType<typeof createRampRepository>, "getForOwner" | "getLaunchSession" | "saveLaunchSession">;
// Preparing a session must not create a provider transaction. Set safeResume only with provider-specific evidence.
export type RampLaunchAdapter = { safeResume: boolean; prepare(order: RampOrder, customerIps: readonly string[]): Promise<string>; validate(order: RampOrder, url: URL): void };

function validateUrl(order: RampOrder, raw: string, adapter: RampLaunchAdapter) {
  if (typeof raw !== "string" || raw.length > 12000) throw new HttpError(502, "The payment link could not be verified");
  let url: URL;
  try { url = new URL(raw); } catch { throw new HttpError(502, "The payment link could not be verified"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    throw new HttpError(502, "The payment link could not be verified");
  adapter.validate(order, url);
  return url.href;
}

export function validateMoonpayLaunch(order: RampOrder, url: URL) {
  if (order.terms.provider !== "moonpay") throw new HttpError(503, "This payment option is not available yet");
  const expectedOrigin = `https://${order.terms.direction === "buy" ? "buy" : "sell"}-sandbox.moonpay.com`;
  if (url.origin !== expectedOrigin || url.pathname !== "/" || url.username || url.password || url.hash)
    throw new HttpError(502, "The payment link could not be verified");
  const params = url.searchParams;
  const single = (key: string, value: string) => params.getAll(key).length === 1 && params.get(key) === value;
  const buy = order.terms.direction === "buy";
  const asset = order.terms.assetCode === "XLM" ? "xlm" : "usdc_xlm";
  const expected: Record<string, string> = { externalTransactionId: order.id, externalCustomerId: order.terms.userId,
    theme: "dark", lockAmount: "true", baseCurrencyCode: buy ? order.terms.market.currency.toLowerCase() : asset,
    baseCurrencyAmount: decimalAmount(order.terms.amount.units, order.terms.amount.decimals),
    ...(buy ? { currencyCode: asset, walletAddress: order.terms.walletAddress } : { quoteCurrencyCode: order.terms.market.currency.toLowerCase(), refundWalletAddress: order.terms.walletAddress }) };
  const keys = new Set([...Object.keys(expected), "apiKey", "allowedIpAddress", "signature"]);
  if ([...params.keys()].some((key) => !keys.has(key)) || Object.entries(expected).some(([key, value]) => !single(key, value)) ||
      params.getAll("apiKey").length !== 1 || !params.get("apiKey")?.startsWith("pk_test_") ||
      ["allowedIpAddress", "signature"].some((key) => params.getAll(key).length !== 1 || !params.get(key)))
    throw new HttpError(502, "The payment link could not be verified");
}

export function createRampLaunchService(repository: Repository, adapters: ReadonlyMap<string, RampLaunchAdapter>,
  cipher: ReturnType<typeof createCashOutEnvelopeCipher>, canLaunch: (order: RampOrder) => Promise<boolean>) {
  return {
    async launch(id: string, owner: Owner, customerIps: readonly string[]) {
      const order = await repository.getForOwner(id, owner.userId, owner.walletAddress);
      if (!order) throw new HttpError(404, "Ramp transaction not found");
      const adapter = adapters.get(order.terms.provider);
      if (!adapter || !await canLaunch(order)) throw new HttpError(503, "This payment option is not available yet");
      const previous = await repository.getLaunchSession(id, owner.userId, owner.walletAddress);
      if (previous) {
        if (!adapter.safeResume) throw new HttpError(409, "Check your existing transaction before reopening payment.");
        return { url: validateUrl(order, cipher.decrypt(id, "provider-launch", id, previous), adapter), created: false };
      }
      const url = validateUrl(order, await adapter.prepare(order, customerIps), adapter);
      const saved = await repository.saveLaunchSession(id, owner.userId, owner.walletAddress,
        cipher.encrypt(id, "provider-launch", id, url), adapter.safeResume);
      return { url: validateUrl(order, cipher.decrypt(id, "provider-launch", id, saved.encryptedSession), adapter), created: saved.created };
    },
  };
}

export function createMoonpayLaunchAdapter(config: RampSandboxConfig, fetcher: typeof fetch = fetch): RampLaunchAdapter {
  const moonpay = new MoonpaySandbox(config, fetcher);
  return { safeResume: false, validate: validateMoonpayLaunch, async prepare(order, customerIps) { return moonpay.widgetUrl(order, await moonpay.catalog(), customerIps); } };
}
