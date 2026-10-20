import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, Networks, Transaction, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import {
  cashOutMemoSchema,
  cashOutQuoteSchema,
  cashOutTransactionSchema,
  cashOutUnitsSchema,
  createCashOutInputSchema,
  type CashOutQuote,
  type CashOutTransferInstructions,
} from "@music-city/shared";
import { prepareCashOutTransfer, verifyCashOutEnvelope, type CashOutTransferPolicy } from "./cashout-transfer.js";

// These are local domain fixtures, not an enabled payout corridor or provider sandbox evidence.
const wallet = Keypair.random();
const walletAddress = wallet.publicKey();
const destination = Keypair.random().publicKey();
const assetIssuer = Keypair.random().publicKey();
const now = new Date("2026-10-17T12:00:00.000Z");
const requestId = "00000000-0000-4000-8000-000000000001";
const context = { provider: "fixture", environment: "sandbox", network: "stellar:testnet", walletAddress } as const;
const market = { country: "ZA", currency: "ZAR", payoutMethod: "bank" } as const;
const quote: CashOutQuote = {
  ...context, id: "quote-1", cashOutId: "cashout-1", sessionId: "session-1", providerQuoteId: "provider-quote-1",
  providerTransactionId: "provider-transaction-1", market, debitUnits: "123456789",
  receive: { currency: "ZAR", units: "21550", decimals: 2 },
  fees: [{ kind: "provider", amount: { currency: "USDC", units: "10000000", decimals: 7 }, includedInDebit: true }],
  destinationLabel: "Bank account ending 0123", createdAt: now.toISOString(),
  expiresAt: "2026-10-17T12:10:00.000Z",
};
const instructions: CashOutTransferInstructions = {
  ...context, cashOutId: "cashout-1", quoteId: quote.id, providerTransactionId: quote.providerTransactionId,
  destination, assetCode: "USDC", assetIssuer, amountUnits: quote.debitUnits,
  memo: { type: "id", value: "18446744073709551615" }, expiresAt: quote.expiresAt,
};
const policy: CashOutTransferPolicy = { ...context, assetIssuer, market, maxFeeStroops: 1000 };
const prepare = (i: unknown = instructions, q: unknown = quote, p = policy, sequence = "42", fee = 100, at = now) =>
  prepareCashOutTransfer(i, q, p, sequence, fee, at);

test("cash-out amounts preserve integer precision and reject truncation, overflow and coercion", () => {
  for (const value of ["0", "1", "9007199254740993", "9223372036854775807"]) {
    assert.equal(cashOutUnitsSchema.parse(value), value);
  }
  for (const value of ["9223372036854775808", "1.1", "1e7", "-1", "01", " 1", "", 1, null]) {
    assert.equal(cashOutUnitsSchema.safeParse(value).success, false, String(value));
  }
});

test("create input cannot choose another wallet, provider, status or environment", () => {
  const input = { requestId, market, debitUnits: "1" };
  assert.deepEqual(createCashOutInputSchema.parse(input), input);
  for (const key of ["walletAddress", "userId", "provider", "environment", "status"]) {
    assert.equal(createCashOutInputSchema.safeParse({ ...input, [key]: walletAddress }).success, false);
  }
  assert.equal(createCashOutInputSchema.safeParse({ ...input, debitUnits: "0" }).success, false);
});

test("quotes require exact payout currency, positive proceeds, fee precision and valid expiry", () => {
  assert.deepEqual(cashOutQuoteSchema.parse(quote), quote);
  for (const patch of [
    { receive: { ...quote.receive, currency: "USD" } },
    { receive: { ...quote.receive, units: "0" } },
    { receive: { ...quote.receive, units: 21550 } },
    { receive: { ...quote.receive, decimals: 1.5 } },
    { fees: [{ ...quote.fees[0], amount: { currency: "USDC", units: "0.1", decimals: 7 } }] },
    { expiresAt: quote.createdAt }, { expiresAt: "yesterday" },
  ]) assert.equal(cashOutQuoteSchema.safeParse({ ...quote, ...patch }).success, false);
});

test("memo limits use UTF-8 bytes and unsigned integer precision", () => {
  for (const memo of [
    { type: "none" }, { type: "text", value: "a".repeat(28) },
    { type: "text", value: "🎵".repeat(7) }, { type: "text", value: "é".repeat(14) },
    { type: "id", value: "18446744073709551615" }, { type: "hash", value: "a".repeat(64) },
  ]) assert.equal(cashOutMemoSchema.safeParse(memo).success, true);
  for (const memo of [
    { type: "text", value: "a".repeat(29) }, { type: "text", value: "🎵".repeat(8) },
    { type: "text", value: "é".repeat(15) }, { type: "id", value: "18446744073709551616" },
    { type: "id", value: "1e3" }, { type: "id", value: "01" },
    { type: "none", value: "hidden" }, { type: "hash", value: "a".repeat(63) },
  ]) assert.equal(cashOutMemoSchema.safeParse(memo).success, false);
});

test("cash-out history stores provider, claim, chain and refund references independently", () => {
  const record = {
    ...context, id: "cashout-1", userId: "user-1", requestId, sessionId: quote.sessionId, market,
    status: "refund_pending", providerStatus: "provider-specific-status", debitUnits: quote.debitUnits,
    associatedClaimId: "claim-1", chainAttemptId: "attempt-1", transactionHash: "a".repeat(64),
    providerTransactionId: quote.providerTransactionId, providerCorrelationId: "correlation-1",
    createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
  assert.deepEqual(cashOutTransactionSchema.parse(record), record);
  for (const status of ["ready_for_pickup", "paid", "refund_pending", "refunded", "refund_failed", "unknown"]) {
    assert.equal(cashOutTransactionSchema.parse({ ...record, status }).status, status);
  }
  assert.equal(cashOutTransactionSchema.safeParse({ ...record, status: "completed" }).success, false);
});

test("prepared XDR contains one exact USDC transfer, exact memo, bounded fee and lifetime", () => {
  const result = prepare();
  const tx = TransactionBuilder.fromXDR(result.transaction, Networks.TESTNET);
  assert.ok(tx instanceof Transaction);
  assert.equal(tx.source, walletAddress);
  assert.equal(tx.sequence, "43");
  assert.equal(tx.fee, "100");
  assert.equal(tx.operations.length, 1);
  const operation = tx.operations[0]!;
  assert.equal(operation.type, "payment");
  if (operation.type !== "payment") throw new Error("Expected a payment");
  assert.equal(operation.destination, destination);
  assert.equal(operation.source, undefined);
  assert.equal(operation.asset.getCode(), "USDC");
  assert.equal(operation.asset.getIssuer(), assetIssuer);
  assert.equal(operation.amount, "12.3456789");
  assert.equal(tx.memo.type, "id");
  assert.equal(tx.memo.value, "18446744073709551615");
  assert.equal(result.transactionHash, tx.hash().toString("hex"));
  assert.equal(result.expiresAt, "2026-10-17T12:05:00.000Z");
  assert.equal(tx.signatures.length, 0);
});

test("preparation refuses quote, provider, wallet, environment, network or amount substitution", () => {
  for (const patch of [
    { cashOutId: "other" }, { quoteId: "other" }, { providerTransactionId: "other" }, { provider: "other" },
    { walletAddress: destination }, { environment: "production" }, { network: "stellar:public" },
    { amountUnits: "123456788" }, { assetIssuer: destination }, { assetCode: "XLM" },
  ]) assert.throws(() => prepare({ ...instructions, ...patch }));
  for (const patch of [
    { provider: "other" }, { walletAddress: destination }, { environment: "production" },
    { network: "stellar:public" }, { market: { ...market, country: "ZW" } },
    { market: { ...market, payoutMethod: "cash_pickup" } },
  ]) assert.throws(() => prepare(instructions, { ...quote, ...patch }));
});

test("signed cash-out requires the exact prepared body, correct network and source authorization", () => {
  const prepared = prepare();
  const account = { account_id: walletAddress, thresholds: { med_threshold: 1 },
    signers: [{ key: walletAddress, type: "ed25519_public_key", weight: 1 }] };
  const signed = TransactionBuilder.fromXDR(prepared.transaction, Networks.TESTNET);
  signed.sign(wallet);
  assert.equal(verifyCashOutEnvelope(prepared, signed.toXDR(), account, now), signed.toXDR());
  assert.throws(() => verifyCashOutEnvelope(prepared, prepared.transaction, account, now));
  const wrongNetwork = TransactionBuilder.fromXDR(prepared.transaction, Networks.PUBLIC);
  wrongNetwork.sign(wallet);
  assert.throws(() => verifyCashOutEnvelope(prepared, wrongNetwork.toXDR(), account, now));
  const outsider = TransactionBuilder.fromXDR(prepared.transaction, Networks.TESTNET);
  outsider.sign(Keypair.random());
  assert.throws(() => verifyCashOutEnvelope(prepared, outsider.toXDR(), account, now));
  for (const patch of [
    { memo: { type: "text", value: "changed" } }, { destination: Keypair.random().publicKey() },
  ]) {
    const altered = prepare({ ...instructions, ...patch });
    const tx = TransactionBuilder.fromXDR(altered.transaction, Networks.TESTNET);
    tx.sign(wallet);
    assert.throws(() => verifyCashOutEnvelope(prepared, tx.toXDR(), account, now));
  }
  assert.throws(() => verifyCashOutEnvelope(prepared, signed.toXDR(), { ...account, account_id: destination }, now));
  assert.throws(() => verifyCashOutEnvelope({ ...prepared, transactionHash: "a".repeat(64) }, signed.toXDR(), account, now));
  assert.throws(() => verifyCashOutEnvelope(prepared, signed.toXDR(), account, new Date(prepared.expiresAt)));
  assert.throws(() => verifyCashOutEnvelope(prepared, "invalid", account, now));
  const malformed = TransactionBuilder.fromXDR(prepared.transaction, Networks.TESTNET);
  malformed.signatures.push(new xdr.DecoratedSignature({ hint: wallet.signatureHint(), signature: Buffer.alloc(1) }));
  assert.throws(() => verifyCashOutEnvelope(prepared, malformed.toXDR(), account, now), { statusCode: 403 });
});

test("cash-out authorization respects wallet thresholds and rejects duplicated or unrelated signatures", () => {
  const second = Keypair.random();
  const prepared = prepare();
  const account = { account_id: walletAddress, thresholds: { med_threshold: 2 },
    signers: [wallet, second].map((key) => ({ key: key.publicKey(), type: "ed25519_public_key", weight: 1 })) };
  const tx = TransactionBuilder.fromXDR(prepared.transaction, Networks.TESTNET);
  tx.sign(wallet);
  assert.throws(() => verifyCashOutEnvelope(prepared, tx.toXDR(), account, now));
  tx.sign(second);
  assert.equal(verifyCashOutEnvelope(prepared, tx.toXDR(), account, now), tx.toXDR());
  const duplicated = TransactionBuilder.fromXDR(tx.toXDR(), Networks.TESTNET);
  duplicated.sign(wallet);
  assert.throws(() => verifyCashOutEnvelope(prepared, duplicated.toXDR(), account, now));
  tx.sign(Keypair.random());
  assert.throws(() => verifyCashOutEnvelope(prepared, tx.toXDR(), account, now));
});

test("expired quotes, future quotes and expired instructions never produce a transaction", () => {
  assert.throws(() => prepare(instructions, { ...quote, expiresAt: now.toISOString(), createdAt: "2026-10-17T11:00:00.000Z" }));
  assert.throws(() => prepare(instructions, { ...quote, createdAt: "2026-10-17T12:01:00.000Z" }));
  assert.throws(() => prepare({ ...instructions, expiresAt: now.toISOString() }));
  assert.throws(() => prepare(instructions, quote, policy, "42", 100, new Date(NaN)));
  const result = prepare({ ...instructions, expiresAt: "2026-10-17T12:00:30.500Z" });
  assert.equal(result.expiresAt, "2026-10-17T12:00:30.000Z");
});

test("fees, sequence and destination are validated before building a payment", () => {
  for (const fee of [-1, 0, 99, 100.1, 1001, NaN, Infinity]) assert.throws(() => prepare(instructions, quote, policy, "42", fee));
  for (const sequence of ["-1", "1e2", "01", "9223372036854775807", "9223372036854775808"]) {
    assert.throws(() => prepare(instructions, quote, policy, sequence));
  }
  assert.throws(() => prepare({ ...instructions, destination: walletAddress }));
  assert.throws(() => prepare({ ...instructions, destination: `G${"A".repeat(55)}` }));
});

test("all supported memos survive XDR encoding without numeric conversion", () => {
  for (const memo of [
    { type: "none" }, { type: "text", value: "🎵".repeat(7) },
    { type: "id", value: "9007199254740993" }, { type: "hash", value: "a".repeat(64) },
  ] as const) {
    const result = prepare({ ...instructions, memo });
    const tx = TransactionBuilder.fromXDR(result.transaction, result.networkPassphrase);
    assert.ok(tx instanceof Transaction);
    assert.equal(tx.memo.type, memo.type);
    if (memo.type === "hash") assert.equal((tx.memo.value as Buffer).toString("hex"), memo.value);
    else if (memo.type === "text") assert.equal((tx.memo.value as Buffer).toString("utf8"), memo.value);
    else if (memo.type === "id") assert.equal(tx.memo.value, memo.value);
  }
});
