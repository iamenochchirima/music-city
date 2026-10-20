import assert from "node:assert/strict";
import test from "node:test";
import {
  Keypair,
  Networks,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type { CheckoutAttempt, PaymentIntentRecord } from "@music-city/shared";
process.env.DATABASE_URL ??=
  "postgres://unused:unused@127.0.0.1:5432/unused_test";
const { env } = await import("../../config/env.js");
const { buildCheckoutTransaction, verifyCheckoutReceipt } = await import(
  "./checkout-chain.js"
);
const now = new Date("2026-10-17T12:00:00Z");
const source = Keypair.random(),
  destination = Keypair.random(),
  issuer = Keypair.random().publicKey();
env.STELLAR_NETWORK_PASSPHRASE = Networks.TESTNET;
env.STELLAR_SETTLEMENT_ASSET_ISSUER = issuer;
const ledger = {
  sequence: 100,
  closed_at: now.toISOString(),
  base_fee_in_stroops: 100,
  base_reserve_in_stroops: 5000000,
};
const account = (wallet: string) => ({
  account_id: wallet,
  sequence: "42",
  subentry_count: 1,
  balances: [
    { asset_type: "native", balance: "20" },
    {
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: issuer,
      balance: "10",
      limit: "1000",
      is_authorized: true,
    },
  ],
  thresholds: { med_threshold: 1 },
  signers: [{ key: wallet, type: "ed25519_public_key", weight: 1 }],
});
const intent: PaymentIntentRecord = {
  id: "payi_example",
  walletAddress: source.publicKey(),
  productType: "track_purchase",
  trackId: "track",
  royaltySplitId: "split-1",
  amount: "0.0000001",
  assetCode: "USDC",
  assetIssuer: issuer,
  destinationAddress: destination.publicKey(),
  memo: "payi_example",
  status: "pending",
  networkPassphrase: Networks.TESTNET,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  expiresAt: "2026-10-17T12:15:00Z",
};
const build = (
  patch: Partial<PaymentIntentRecord> = {},
  sender = account(source.publicKey()),
  receiver = account(destination.publicKey()),
  closed = ledger,
) =>
  buildCheckoutTransaction(
    { ...intent, ...patch },
    sender,
    receiver,
    closed,
    now.getTime(),
  );

test("checkout pays the advertised amount exactly and binds a short order memo", () => {
  const prepared = build();
  const tx = TransactionBuilder.fromXDR(prepared.transaction, Networks.TESTNET);
  assert.ok(tx instanceof Transaction);
  assert.equal(tx.source, source.publicKey());
  assert.equal(tx.sequence, "43");
  assert.equal(tx.fee, "100");
  assert.equal(tx.operations.length, 1);
  const operation = tx.operations[0]!;
  assert.equal(operation.type, "payment");
  if (operation.type !== "payment") throw new Error("Expected a payment");
  assert.equal(operation.amount, "0.0000001");
  assert.equal(operation.destination, destination.publicKey());
  assert.equal(operation.asset.getIssuer(), issuer);
  assert.equal(operation.source, undefined);
  assert.equal(tx.memo.type, "text");
  assert.equal((tx.memo.value as Buffer).toString(), intent.id);
  assert.equal(prepared.expiresAt, "2026-10-17T12:05:00.000Z");
  assert.equal(prepared.transactionHash, tx.hash().toString("hex"));
});

test("checkout rejects a different wallet, network, issuer, unsupported asset and invalid amounts", () => {
  for (const patch of [
    { walletAddress: destination.publicKey() },
    { networkPassphrase: Networks.PUBLIC },
    { assetIssuer: source.publicKey() },
    { assetCode: "OTHER" },
    { amount: "0" },
    { amount: "0.00000001" },
    { amount: "1e-7" },
    { amount: "922337203686" },
    { memo: "x".repeat(29) },
    { expiresAt: now.toISOString() },
  ])
    assert.throws(() => build(patch));
});

test("checkout refuses missing trustlines, locked funds, insufficient reserve and excessive fees", () => {
  const sender = account(source.publicKey());
  assert.throws(() => build({}, { ...sender, balances: [] }));
  assert.throws(() => build({ amount: "11" }));
  assert.throws(() =>
    build(
      {},
      {
        ...sender,
        balances: sender.balances.map((b) =>
          b.asset_type === "native" ? { ...b, balance: "1.5" } : b,
        ),
      },
    ),
  );
  assert.throws(() =>
    build({}, sender, { ...account(destination.publicKey()), balances: [] }),
  );
  assert.throws(() =>
    build({}, sender, account(destination.publicKey()), {
      ...ledger,
      base_fee_in_stroops: 10001,
    }),
  );
});

test("existing native-asset products retain exact-price checkout with a reserve check", () => {
  const prepared = build({
    productType: "platform_subscription",
    amount: "1",
    assetCode: "XLM",
    assetIssuer: undefined,
  });
  const tx = TransactionBuilder.fromXDR(prepared.transaction, Networks.TESTNET);
  assert.ok(tx instanceof Transaction);
  const op = tx.operations[0]!;
  assert.equal(op.type, "payment");
  if (op.type !== "payment") throw new Error("Expected payment");
  assert.equal(op.asset.isNative(), true);
  assert.equal(op.amount, "1.0000000");
  assert.throws(() =>
    build({ amount: "19", assetCode: "XLM", assetIssuer: undefined }),
  );
});

test("receipt confirmation requires the retained hash, source, envelope and ledger evidence", () => {
  const prepared = build();
  const attempt = {
    ...prepared,
    walletAddress: source.publicKey(),
    networkPassphrase: Networks.TESTNET,
  } as CheckoutAttempt;
  const receipt = {
    hash: prepared.transactionHash,
    successful: true,
    envelope_xdr: prepared.transaction,
    ledger: 101,
    fee_charged: "100",
  };
  verifyCheckoutReceipt(attempt, receipt);
  for (const patch of [
    { hash: "a".repeat(64) },
    { ledger: 0 },
    { fee_charged: "0.1" },
    { envelope_xdr: build({ amount: "1" }).transaction },
  ]) {
    assert.throws(() =>
      verifyCheckoutReceipt(attempt, { ...receipt, ...patch }),
    );
  }
});
