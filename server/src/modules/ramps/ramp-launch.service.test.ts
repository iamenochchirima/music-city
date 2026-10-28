import assert from "node:assert/strict";
import test from "node:test";
import type { RampOrder } from "@music-city/shared";
import { Keypair } from "@stellar/stellar-sdk";
import { randomUUID } from "node:crypto";
import { createCashOutEnvelopeCipher } from "../cashout/cashout-envelope.js";
import { createMoonpayLaunchAdapter, createRampLaunchService, type RampLaunchAdapter } from "./ramp-launch.service.js";
import { rampSandboxConfigSchema } from "./sandbox-config.js";

test("launch validates owner, verified capability and provider destination before saving", async () => {
  const order = { id: "order", terms: { userId: "user", walletAddress: "wallet", provider: "moonpay", direction: "buy", assetCode: "XLM", market: { currency: "USD" }, amount: { units: "10000", decimals: 2 } } } as RampOrder;
  const owner = { userId: "user", walletAddress: "wallet" };
  let stored: Buffer | null = null, calls = 0, allowed = true;
  const repository = {
    async getForOwner(id: string, user: string, wallet: string) { return id === order.id && user === owner.userId && wallet === owner.walletAddress ? order : null; },
    async getLaunchSession() { return stored; },
    async saveLaunchSession(_id: string, _user: string, _wallet: string, encrypted: Buffer) { stored = encrypted; return { encryptedSession: encrypted, created: true }; },
  };
  const params = new URLSearchParams({ apiKey: "pk_test_fixture", externalTransactionId: "order", externalCustomerId: "user", theme: "dark", lockAmount: "true", currencyCode: "xlm", walletAddress: "wallet", baseCurrencyCode: "usd", baseCurrencyAmount: "100.00", allowedIpAddress: "binding", signature: "sig" });
  const good = `https://buy-sandbox.moonpay.com/?${params}`;
  let link = good;
  const adapter: RampLaunchAdapter = { safeResume: true, async prepare() { calls++; return link; } };
  const service = createRampLaunchService(repository as unknown as Parameters<typeof createRampLaunchService>[0], new Map([["moonpay", adapter]]), createCashOutEnvelopeCipher(Buffer.alloc(32, 9)), async () => allowed);
  await assert.rejects(service.launch("order", { ...owner, userId: "other" }, ["203.0.113.1"]), /not found/);
  allowed = false;
  await assert.rejects(service.launch("order", owner, ["203.0.113.1"]), /not available/);
  assert.equal(calls, 0);
  allowed = true;
  for (const candidate of [`https://buy-sandbox.moonpay.com.evil.test/?${params}`, `https://buy-sandbox.moonpay.com/other?${params}`, `https://buy-sandbox.moonpay.com/?${params}&walletAddress=other`, `https://buy-sandbox.moonpay.com/?${params}#fragment`]) {
    link = candidate;
    await assert.rejects(service.launch("order", owner, ["203.0.113.1"]), /could not be verified/);
    assert.equal(stored, null);
  }
  link = good;
  const first = await service.launch("order", owner, ["203.0.113.1"]);
  assert.equal(first.created, true); assert.equal(first.url, good);
  assert.ok(stored && !Buffer.from(stored).includes(Buffer.from(good)));
  const before = calls;
  const retry = await service.launch("order", owner, ["203.0.113.1"]);
  assert.deepEqual(retry, { url: good, created: false });
  assert.equal(calls, before);
  adapter.safeResume = false;
  await assert.rejects(service.launch("order", owner, ["203.0.113.1"]), /existing transaction/);
});

test("MoonPay adapter builds the signed sandbox URL but does not claim safe resume", async () => {
  const config = rampSandboxConfigSchema.parse({ NODE_ENV: "test", RAMPS_SANDBOX_ENABLED: "true", RAMPS_SANDBOX_ASSET: "XLM", MOONPAY_PK: "pk_test_fixture", MOONPAY_SK: "sk_test_fixture", MOONPAY_WEBHOOK: "wk_test_fixture" });
  const wallet = Keypair.random().publicKey();
  const order: RampOrder = { id: randomUUID(), terms: { userId: "user", walletAddress: wallet, requestId: randomUUID(), provider: "moonpay", direction: "buy", environment: "sandbox", network: "stellar:testnet", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amount: { currency: "GBP", units: "10000", decimals: 2 } }, providerState: "created", chainState: "unobserved", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const requests: string[] = [];
  const adapter = createMoonpayLaunchAdapter(config, (async (url: URL) => {
    requests.push(url.pathname);
    return Response.json(url.pathname === "/v3/currencies" ? [
      { code: "xlm", type: "crypto", precision: 7, supportsTestMode: true, isSuspended: false, metadata: { networkCode: "stellar" } },
      { code: "gbp", type: "fiat", precision: 2 },
    ] : [{ alpha2: "GB", isBuyAllowed: true, isSellAllowed: true }]);
  }) as typeof fetch);
  const url = new URL(await adapter.prepare(order, ["203.0.113.1"]));
  assert.equal(adapter.safeResume, false);
  assert.equal(url.origin, "https://buy-sandbox.moonpay.com");
  assert.equal(url.searchParams.get("walletAddress"), wallet);
  assert.equal(url.searchParams.get("externalTransactionId"), order.id);
  assert.ok(url.searchParams.get("signature"));
  assert.deepEqual(new Set(requests), new Set(["/v3/currencies", "/v3/countries"]));
});
