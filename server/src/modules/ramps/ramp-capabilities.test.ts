import assert from "node:assert/strict";
import test from "node:test";
import type { RampOrder } from "@music-city/shared";
import { createRampService, routeSupportsOrder, type VerifiedRampRoute } from "./ramp-service.js";
import { settlementClaimMatchesWallet } from "../settlements/settlement-repository.js";

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

test("cash-out claim links require a claimed allocation owned by the source wallet", () => {
  const wallet = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const batch = {
    id: "a".repeat(64), sourceKey: "b".repeat(64), trackId: "track", sourceType: "sale", sourceId: "source",
    agreementId: "agreement", version: 1, proposalHash: "c".repeat(64), grossUnits: "100", feeBps: 0,
    fundedUnits: "100", expiresAt: "2026-11-01T00:00:00.000Z",
    config: { contractId: "contract", registryId: "registry", assetContractId: "asset", treasuryAddress: wallet,
      networkPassphrase: "Test SDF Network ; September 2015", assetCode: "USDC", assetIssuer: wallet },
    allocations: [{ index: 0, beneficiary: wallet, grossUnits: "100", feeUnits: "0", amountUnits: "100",
      ledgerEntryIds: ["entry"], status: "claimed", updatedLedger: 10, transactionHash: "d".repeat(64) }],
    state: "funded", fundedLedger: 10, createdAt: "2026-10-28T00:00:00.000Z", updatedAt: "2026-10-28T00:01:00.000Z",
  };
  assert.equal(settlementClaimMatchesWallet(batch, 0, wallet), true);
  assert.equal(settlementClaimMatchesWallet(batch, 0, "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"), false);
  assert.equal(settlementClaimMatchesWallet({ ...batch, allocations: [{ ...batch.allocations[0], status: "available" }] }, 0, wallet), false);
});

test("cash-out creation persists only an owner-verified claim reference and binds retries to it", async () => {
  const wallet = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const route: VerifiedRampRoute = {
    provider: "moonpay", direction: "sell", environment: "sandbox", network: "stellar:testnet",
    assetCode: "USDC", assetIssuer: issuer, market: { country: "GB", currency: "GBP", method: "bank" },
    amountDecimals: 7, minUnits: "1000000", maxUnits: "100000000", verifiedAt: "2026-10-27T00:00:00.000Z", expiresAt: "2026-10-30T00:00:00.000Z",
  };
  const reference = { batchId: "a".repeat(64), claimIndex: 0 };
  const stored: RampOrder[] = [];
  let allowClaim = false;
  const repository = {
    async getByRequest(userId: string, requestId: string) {
      return stored.find((order) => order.terms.userId === userId && order.terms.requestId === requestId) ?? null;
    },
    async reserve(terms: RampOrder["terms"]) {
      const order: RampOrder = { id: "cash-out-1", terms, providerState: "created", chainState: "unobserved",
        createdAt: "2026-10-28T00:00:00.000Z", updatedAt: "2026-10-28T00:00:00.000Z" };
      stored.push(order);
      return { order, created: true };
    },
  };
  const service = createRampService(repository, { async routes() { return [route]; } },
    () => Date.parse("2026-10-28T00:00:00.000Z"), async (candidate, sourceWallet) => allowClaim && candidate.batchId === reference.batchId && candidate.claimIndex === 0 && sourceWallet === wallet);
  const request = { requestId: "ed39ecdf-d398-49cb-86bf-54cac8329168", provider: "moonpay", direction: "sell", assetCode: "USDC",
    market: route.market, amount: "1.5000000", associatedClaim: reference };
  await assert.rejects(service.create({ userId: "artist", walletAddress: wallet }, request), /not confirmed for this wallet/);
  assert.equal(stored.length, 0);
  allowClaim = true;
  const created = await service.create({ userId: "artist", walletAddress: wallet }, request);
  assert.equal(created.order.terms.associatedClaim?.batchId, reference.batchId);
  assert.equal(created.order.terms.amount.units, "15000000");
  assert.equal((await service.create({ userId: "artist", walletAddress: wallet }, request)).order.id, created.order.id);
  await assert.rejects(service.create({ userId: "artist", walletAddress: wallet }, { ...request, associatedClaim: { ...reference, claimIndex: 1 } }), /different terms/);
  await assert.rejects(service.create({ userId: "artist", walletAddress: wallet }, { ...request, direction: "buy" }), /only be linked to a cash-out/);
});
