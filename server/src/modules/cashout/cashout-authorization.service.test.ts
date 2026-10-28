import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import { createCashOutAuthorizationService } from "./cashout-authorization.service.js";
import { createCashOutEnvelopeCipher } from "./cashout-envelope.js";

test("cash-out authorization uses owner-scoped records and server-read network data", async () => {
  const wallet = Keypair.random().publicKey();
  const owner = { userId: "artist", walletAddress: wallet };
  const issuer = Keypair.random().publicKey();
  const calls: string[] = [];
  let found = true;
  let direction = "sell", balance = "2";
  const repository = {
    getForOwner: async (_id: string, user: string, address: string) => {
      calls.push("order");
      return found && user === owner.userId && address === wallet ? { terms: { direction, environment: "sandbox", network: "stellar:testnet", assetIssuer: issuer, amount: { units: "10000000" } } } : null;
    },
    getCashOutQuote: async () => { calls.push("quote"); return { hash: "confirmed" }; },
    latestCashOutAttempt: async () => ({ id: "attempt", state: "prepared", transaction: "unsigned", networkFeeStroops: "100" }),
    prepareCashOutAttempt: async (input: Record<string, unknown>) => { calls.push("prepare"); return input; },
    authorizeCashOutAttempt: async (input: Record<string, unknown>) => { calls.push("authorize"); return input; },
    cancelUnsignedCashOutAttempt: async () => { calls.push("cancel"); },
  };
  const chain = {
    preparationLedger: async () => { calls.push("ledger"); return { sequence: 44, base_fee_in_stroops: 100, base_reserve_in_stroops: 5000000, closed_at: "2026-10-28T12:00:00.000Z" }; },
    account: async (address: string) => { calls.push("account"); return { account_id: address, sequence: "123", subentry_count: 1, num_sponsoring: 0, num_sponsored: 0, balances: [{ asset_type: "native", balance: "10", selling_liabilities: "0" }, { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: issuer, balance, selling_liabilities: "0", is_authorized: true }], thresholds: { med_threshold: 1 }, signers: [{ key: wallet, type: "ed25519_public_key", weight: 1 }] }; },
  };
  const service = createCashOutAuthorizationService(repository as unknown as Parameters<typeof createCashOutAuthorizationService>[0], chain, createCashOutEnvelopeCipher(Buffer.alloc(32, 1)), async () => true);
  const prepared = await service.prepare("order", "quote", "confirmed", owner);
  assert.deepEqual(calls, ["order", "quote", "ledger", "account", "prepare"]);
  assert.equal((prepared as unknown as { sequence: string }).sequence, "123");
  assert.equal((prepared as unknown as { preparedLedger: number }).preparedLedger, 44);
  calls.length = 0;
  const unavailable = createCashOutAuthorizationService(repository as unknown as Parameters<typeof createCashOutAuthorizationService>[0], chain, createCashOutEnvelopeCipher(Buffer.alloc(32, 1)));
  await assert.rejects(unavailable.prepare("order", "quote", "confirmed", owner), /not available/);
  assert.deepEqual(calls, ["order"]);
  calls.length = 0;
  await service.authorize("order", "attempt", "signed", owner);
  assert.deepEqual(calls, ["order", "ledger", "account", "authorize"]);
  calls.length = 0;
  await assert.rejects(service.prepare("order", "quote", "changed", owner), /Review/);
  assert.deepEqual(calls, ["order", "quote"]);
  calls.length = 0;
  balance = "0.5";
  const withheld = await service.latest("order", owner);
  assert.equal(withheld?.transaction, null);
  assert.ok(withheld && "unavailableReason" in withheld);
  assert.equal(withheld.unavailableReason, "Your wallet has insufficient spendable USDC.");
  await assert.rejects(service.authorize("order", "attempt", "signed", owner), /insufficient spendable USDC/);
  assert.equal(calls.includes("authorize"), false);
  balance = "2";
  calls.length = 0;
  found = false;
  await assert.rejects(service.authorize("order", "attempt", "signed", owner), /not found/);
  assert.deepEqual(calls, ["order"]);
  calls.length = 0;
  found = true;
  direction = "buy";
  await assert.rejects(service.cancel("order", "attempt", owner), /not available/);
  assert.deepEqual(calls, ["order"]);
});


test("withdraws unsigned authorization when route verification expires without hiding history or cancellation", async () => {
  const wallet = Keypair.random().publicKey(), owner = { userId: "artist", walletAddress: wallet };
  const issuer = Keypair.random().publicKey();
  const order = { terms: { direction: "sell", environment: "sandbox", network: "stellar:testnet", assetIssuer: issuer, amount: { units: "10000000" } } };
  let state = "prepared", cancelled = false, checks = 0, allowed = true;
  const repository = {
    async getForOwner() { return order; }, async getCashOutQuote() { return null; },
    async latestCashOutAttempt() { return { id: "attempt", state, transaction: state === "prepared" ? "unsigned" : null, networkFeeStroops: "100" }; },
    async prepareCashOutAttempt() { throw new Error("unexpected preparation"); },
    async authorizeCashOutAttempt() { throw new Error("unexpected authorization"); },
    async cancelUnsignedCashOutAttempt() { cancelled = true; },
  };
  const chain = { async preparationLedger() { return { sequence: 44, base_fee_in_stroops: 100, base_reserve_in_stroops: 5000000, closed_at: "2026-10-28T12:00:00.000Z" }; }, async account() { checks++; return { account_id: wallet, sequence: "1", subentry_count: 1, num_sponsoring: 0, num_sponsored: 0, balances: [{ asset_type: "native", balance: "10", selling_liabilities: "0" }, { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: issuer, balance: "2", selling_liabilities: "0", is_authorized: true }], thresholds: { med_threshold: 1 }, signers: [{ key: wallet, type: "ed25519_public_key", weight: 1 }] }; } };
  const service = createCashOutAuthorizationService(repository as unknown as Parameters<typeof createCashOutAuthorizationService>[0], chain, createCashOutEnvelopeCipher(Buffer.alloc(32, 1)), async () => allowed);
  assert.equal((await service.latest("order", owner))?.transaction, "unsigned");
  allowed = false;
  checks = 0;
  assert.equal((await service.latest("order", owner))?.transaction, null);
  await assert.rejects(service.authorize("order", "attempt", "signed", owner), /not available/);
  assert.equal(checks, 0);
  await service.cancel("order", "attempt", owner);
  assert.equal(cancelled, true);
  state = "unknown";
  assert.equal((await service.latest("order", owner))?.state, "unknown");
});
