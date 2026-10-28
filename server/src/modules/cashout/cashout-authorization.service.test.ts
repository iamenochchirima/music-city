import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import { createCashOutAuthorizationService } from "./cashout-authorization.service.js";
import { createCashOutEnvelopeCipher } from "./cashout-envelope.js";

test("cash-out authorization uses owner-scoped records and server-read network data", async () => {
  const wallet = Keypair.random().publicKey();
  const owner = { userId: "artist", walletAddress: wallet };
  const calls: string[] = [];
  let found = true;
  let direction = "sell";
  const repository = {
    getForOwner: async (_id: string, user: string, address: string) => {
      calls.push("order");
      return found && user === owner.userId && address === wallet ? { terms: { direction, environment: "sandbox", network: "stellar:testnet" } } : null;
    },
    getCashOutQuote: async () => { calls.push("quote"); return { hash: "confirmed" }; },
    latestCashOutAttempt: async () => null,
    prepareCashOutAttempt: async (input: Record<string, unknown>) => { calls.push("prepare"); return input; },
    authorizeCashOutAttempt: async (input: Record<string, unknown>) => { calls.push("authorize"); return input; },
    cancelUnsignedCashOutAttempt: async () => { calls.push("cancel"); },
  };
  const chain = {
    preparationLedger: async () => { calls.push("ledger"); return { sequence: 44, base_fee_in_stroops: 100, closed_at: "2026-10-28T12:00:00.000Z" }; },
    account: async (address: string) => { calls.push("account"); return { account_id: address, sequence: "123", thresholds: { med_threshold: 1 }, signers: [] }; },
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
  assert.deepEqual(calls, ["order", "account", "authorize"]);
  calls.length = 0;
  await assert.rejects(service.prepare("order", "quote", "changed", owner), /Review/);
  assert.deepEqual(calls, ["order", "quote"]);
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
