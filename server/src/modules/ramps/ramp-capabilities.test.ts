import assert from "node:assert/strict";
import test from "node:test";
import type { RampOrder } from "@music-city/shared";
import { createRampService, routeSupportsOrder, type VerifiedRampRoute } from "./ramp-service.js";

const issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const valid: VerifiedRampRoute = { provider: "moonpay", direction: "buy", environment: "sandbox", network: "stellar:testnet", assetCode: "USDC", assetIssuer: issuer, market: { country: "GB", currency: "GBP", method: "card" }, amountDecimals: 2, minUnits: "100", maxUnits: "100000", verifiedAt: "2026-10-27T00:00:00Z", expiresAt: "2026-10-30T00:00:00Z" };

test("only advertises unexpired routes supported by the order and transfer contracts", async () => {
  const candidates: VerifiedRampRoute[] = [valid,
    { ...valid, assetIssuer: undefined },
    { ...valid, assetIssuer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" },
    { ...valid, assetCode: "XLM", assetIssuer: issuer },
    { ...valid, market: { ...valid.market, method: "cash_pickup" } },
    { ...valid, direction: "sell", assetCode: "XLM", assetIssuer: undefined, amountDecimals: 7 },
    { ...valid, maxUnits: "0", minUnits: "0" },
    { ...valid, expiresAt: "2026-10-27T00:00:00Z" },
  ];
  const repository = { async getByRequest() { return null; }, async reserve() { throw new Error("unexpected reserve"); } };
  const service = createRampService(repository, { async routes() { return candidates; } }, () => Date.parse("2026-10-28T00:00:00Z"));
  assert.deepEqual(await service.routes(), [valid]);
  await assert.rejects(service.create({ userId: "user", walletAddress: issuer }, { requestId: "ed39ecdf-d398-49cb-86bf-54cac8329168", provider: "moonpay", direction: "buy", assetCode: "USDC", market: { ...valid.market, method: "cash_pickup" }, amount: "1.00" }), /not available/);
});


test("does not show ambiguous duplicate routes that cannot be created", async () => {
  const repository = { async getByRequest() { return null; }, async reserve() { throw new Error("unexpected reserve"); } };
  const other = { ...valid, market: { ...valid.market, currency: "EUR" } };
  const service = createRampService(repository, { async routes() { return [valid, { ...valid, maxUnits: "200000" }, other]; } }, () => Date.parse("2026-10-28T00:00:00Z"));
  assert.deepEqual(await service.routes(), [other]);
});


test("route matching binds the complete order and amount", () => {
  const order = { terms: { provider: valid.provider, direction: valid.direction, environment: valid.environment, network: valid.network,
    assetCode: valid.assetCode, assetIssuer: valid.assetIssuer, market: valid.market, amount: { currency: "GBP", units: "10000", decimals: 2 } } } as RampOrder;
  assert.equal(routeSupportsOrder(valid, order), true);
  for (const route of [{ ...valid, market: { ...valid.market, country: "ZA" } }, { ...valid, assetIssuer: undefined },
    { ...valid, amountDecimals: 7 }, { ...valid, maxUnits: "9999" }, { ...valid, minUnits: "10001" }])
    assert.equal(routeSupportsOrder(route, order), false);
});
