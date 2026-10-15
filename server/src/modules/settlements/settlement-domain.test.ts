import assert from "node:assert/strict";
import test from "node:test";
import {
  Account,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type {
  RoyaltyLedgerEntry,
  SettlementConfig,
  TrackRoyaltySplitRecord,
} from "@music-city/shared";
import { amountUnits, createSettlementPreview } from "./settlement-domain.js";
import { verifyChainBatch, type ChainBatch } from "./settlement-chain.js";
import { signedFinancialTransaction } from "./settlement.service.js";
import { collectTreasurySignatures } from "../agreements/treasury-signatures.js";
const wallets = [Keypair.random(), Keypair.random()];
const config: SettlementConfig = {
  contractId: "C-settlement",
  registryId: "C-registry",
  assetContractId: "C-USDC",
  treasuryAddress: Keypair.random().publicKey(),
  networkPassphrase: Networks.TESTNET,
  assetCode: "USDC",
  assetIssuer: Keypair.random().publicKey(),
};
const now = new Date("2026-10-15T12:00:00Z"),
  expiry = "2026-10-16T12:00:00.000Z";
const split: TrackRoyaltySplitRecord = {
  id: "agreement:a:1",
  trackId: "track",
  agreementId: "a",
  version: 1,
  status: "superseded",
  historical: false,
  finalizationId: "confirmed-attempt",
  proposalHash: "1".repeat(64),
  registryKind: "soroban",
  registryContractId: config.registryId,
  registryNetwork: "stellar:testnet",
  totalBps: 10000,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  recipients: wallets.map((k, i) => ({
    walletAddress: k.publicKey(),
    chain: "stellar",
    role: i === 0 ? "artist" : "producer",
    shareBps: i === 0 ? 7000 : 3000,
  })),
};
function entries(): RoyaltyLedgerEntry[] {
  return wallets.map((k, i) => ({
    id: `entry-${i}`,
    trackId: "track",
    splitId: split.id,
    sourceType: "track_purchase",
    sourceId: "payment",
    recipientWalletAddress: k.publicKey(),
    recipientChain: "stellar",
    recipientRole: i === 0 ? "artist" : "producer",
    status: "approved",
    grossAmount: i === 0 ? "70" : "30",
    netAmount: i === 0 ? "63" : "27",
    feeAmount: i === 0 ? "7" : "3",
    feeBps: 1000,
    assetCode: "USDC",
    assetIssuer: config.assetIssuer,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }));
}
function preview(es = entries(), s = split, c = config) {
  return createSettlementPreview(es, s, c, expiry, now);
}

test("exact amounts reject truncation, exponent notation, negative amounts, and overflow", () => {
  assert.equal(amountUnits("0.0000001"), 1n);
  assert.equal(amountUnits("100"), 1000000000n);
  for (const value of ["0.00000001", "-1", "1e3", "01", "1.", "922337203686"])
    assert.throws(() => amountUnits(value));
});
test("preview consumes existing allocations once and conserves gross, fees and net", () => {
  const b = preview();
  assert.equal(b.grossUnits, "1000000000");
  assert.equal(b.fundedUnits, "900000000");
  assert.deepEqual(
    b.allocations.map((a) => a.amountUnits),
    ["630000000", "270000000"],
  );
  assert.deepEqual(
    b.allocations.flatMap((a) => a.ledgerEntryIds),
    ["entry-0", "entry-1"],
  );
  assert.equal(preview(entries().reverse()).id, b.id);
});
test("historical finalized versions stay valid and amendments cannot change source identity", () => {
  const first = preview();
  const amended = {
    ...split,
    id: "agreement:a:3",
    version: 3,
    proposalHash: "3".repeat(64),
  };
  const later = preview(
    entries().map((e) => ({ ...e, splitId: amended.id })),
    amended,
  );
  assert.equal(first.sourceKey, later.sourceKey);
  assert.notEqual(first.id, later.id);
});
test("source amounts, evidence, network, asset and fees cannot be substituted", () => {
  for (const change of [
    { status: "paid" },
    { feeBps: undefined },
    { assetIssuer: Keypair.random().publicKey() },
    { splitId: "unapproved" },
    { recipientWalletAddress: Keypair.random().publicKey() },
    { netAmount: "64" },
    { grossAmount: "71" },
    { feeBps: 500 },
  ] as Partial<RoyaltyLedgerEntry>[]) {
    const e = entries();
    e[0] = { ...e[0]!, ...change };
    assert.throws(() => preview(e));
  }
  assert.throws(() => preview(entries(), { ...split, historical: true }));
  assert.throws(() =>
    preview(entries(), { ...split, registryContractId: "foreign" }),
  );
  assert.throws(() =>
    preview(entries(), { ...split, registryNetwork: "stellar:public" }),
  );
  assert.throws(() => preview([...entries(), entries()[0]!]));
});
test("expiry binds the batch and enforces whole seconds and seven-day maximum", () => {
  for (const expiry of [
    "2026-10-15T12:01:00.000Z",
    "2026-10-25T12:00:00.000Z",
    "2026-10-16T12:00:00.001Z",
  ])
    assert.throws(() =>
      createSettlementPreview(entries(), split, config, expiry, now),
    );
  assert.notEqual(
    createSettlementPreview(
      entries(),
      split,
      config,
      "2026-10-16T13:00:00.000Z",
      now,
    ).id,
    preview().id,
  );
});
test("chain readback checks exact terms, recipients, outcomes and conservation", () => {
  const b = preview();
  const actual: ChainBatch = {
    request: {
      batch_id: Buffer.from(b.id, "hex"),
      source_id: Buffer.from(b.sourceKey, "hex"),
      track_id: b.trackId,
      agreement_id: b.agreementId,
      version: b.version,
      proposal_hash: Buffer.from(b.proposalHash, "hex"),
      gross_amount: BigInt(b.grossUnits),
      fee_bps: b.feeBps,
      expires_at: BigInt(Date.parse(b.expiresAt) / 1000),
    },
    claims: b.allocations.map((a) => ({
      beneficiary: a.beneficiary,
      amount: BigInt(a.amountUnits),
      status: ["Available"],
      updated_ledger: 1,
    })),
    funded: BigInt(b.fundedUnits),
    claimed: 0n,
    reclaimed: 0n,
    funded_ledger: 1,
  };
  verifyChainBatch(b, actual);
  assert.throws(() => verifyChainBatch(b, { ...actual, claimed: 1n }));
  assert.throws(() =>
    verifyChainBatch(b, {
      ...actual,
      claims: actual.claims.map((c) => ({
        ...c,
        beneficiary: Keypair.random().publicKey(),
      })),
    }),
  );
  assert.throws(() =>
    verifyChainBatch(b, {
      ...actual,
      request: { ...actual.request, version: 3 },
    }),
  );
});
test("creator authorization binds its exact transaction and cannot redirect or replay another wallet", () => {
  const key = wallets[0]!;
  const tx = new TransactionBuilder(new Account(key.publicKey(), "10"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.manageData({
        name: "isolated-authorization-test",
        value: "exact-payload",
      }),
    )
    .setTimeout(600)
    .build();
  const attempt = {
    id: "id",
    batchId: preview().id,
    kind: "claim" as const,
    claimIndex: 0,
    actor: key.publicKey(),
    treasuryAddress: key.publicKey(),
    networkPassphrase: Networks.TESTNET,
    transaction: tx.toXDR(),
    transactionHash: tx.hash().toString("hex"),
    signers: [key.publicKey()],
    signatures: {},
    signedBy: [],
    status: "awaiting_signatures" as const,
    submissionCount: 0,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.throws(() => signedFinancialTransaction(attempt));
  tx.sign(wallets[1]!);
  assert.throws(() => collectTreasurySignatures(attempt, tx.toXDR()));
  const correct = TransactionBuilder.fromXDR(
    attempt.transaction,
    Networks.TESTNET,
  );
  correct.sign(key);
  const signed = collectTreasurySignatures(attempt, correct.toXDR());
  assert.equal(
    signedFinancialTransaction(signed).hash().toString("hex"),
    attempt.transactionHash,
  );
  assert.throws(() =>
    signedFinancialTransaction({ ...signed, transactionHash: "0".repeat(64) }),
  );
});

test("zero allocations do not require fabricated zero-value ledger entries", () => {
  const es = entries();
  const last = {
    ...es[1]!,
    grossAmount: "0.0000001",
    netAmount: "0.0000001",
    feeAmount: undefined,
    feeBps: 0,
  };
  const b = preview([last]);
  assert.deepEqual(
    b.allocations.map((a) => a.amountUnits),
    ["0", "1"],
  );
  assert.equal(b.fundedUnits, "1");
});
