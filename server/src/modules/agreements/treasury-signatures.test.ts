import assert from "node:assert/strict";
import test from "node:test";
import { Account, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import type { AgreementFinalization } from "@music-city/shared";
import { collectTreasurySignatures, signedTreasuryTransaction, verifyTreasuryConfiguration, verifyTreasuryEnvelope, type TreasuryAccount } from "./treasury-signatures.js";

const keys = [Keypair.random(), Keypair.random(), Keypair.random()];
const treasury = keys[0]!.publicKey();
function fixture(): AgreementFinalization {
  const tx = new TransactionBuilder(new Account(treasury,"10"),{ fee: "100",networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.manageData({ name: "finalization-test",value: "exact-envelope" })).setTimeout(600).build();
  const now = new Date().toISOString();
  return { id: "00000000-0000-4000-8000-000000000001",agreementId: "agreement",version: 1,proposalHash: "a".repeat(64),previousFinalizedHash: "0".repeat(64),treasuryAddress: treasury,contractId: "contract",networkPassphrase: Networks.TESTNET,transaction: tx.toXDR(),transactionHash: tx.hash().toString("hex"),expiresAt: new Date(Number(tx.timeBounds!.maxTime)*1000).toISOString(),signers: keys.map(k => k.publicKey()).sort(),signedBy: [],signatures: {},status: "awaiting_signatures",createdAt: now,updatedAt: now };
}
function sign(attempt: AgreementFinalization,...signers: Keypair[]) {
  const tx = TransactionBuilder.fromXDR(attempt.transaction,attempt.networkPassphrase);
  tx.sign(...signers); return tx.toXDR();
}
function account(): TreasuryAccount {
  return { account_id: treasury,thresholds: { low_threshold: 2,med_threshold: 2,high_threshold: 2 },signers: keys.map(k => ({ key: k.publicKey(),type: "ed25519_public_key",weight: 1 })) };
}
test("treasury requires exactly three independent weight-one signers and every threshold two", () => {
  assert.deepEqual(verifyTreasuryConfiguration(account(),treasury),keys.map(k => k.publicKey()).sort());
  for (const threshold of ["low_threshold","med_threshold","high_threshold"] as const) {
    const invalid = account(); invalid.thresholds[threshold] = 1;
    assert.throws(() => verifyTreasuryConfiguration(invalid,treasury));
  }
  for (const invalid of [
    { ...account(),signers: account().signers.slice(0,2) },
    { ...account(),signers: [...account().signers,account().signers[0]!] },
    { ...account(),signers: account().signers.map(s => ({ ...s,weight: 2 })) },
    { ...account(),account_id: keys[1]!.publicKey() },
  ]) assert.throws(() => verifyTreasuryConfiguration(invalid,treasury));
});
test("one signer and repeated signatures cannot reach the two-signature gate", () => {
  const attempt = fixture(), xdr = sign(attempt,keys[0]!);
  const once = collectTreasurySignatures(attempt,xdr);
  const repeated = collectTreasurySignatures(once,xdr);
  assert.equal(repeated.signedBy.length,1);
  assert.throws(() => signedTreasuryTransaction(repeated),/Two independent/);
  const twiceInEnvelope = collectTreasurySignatures(attempt,sign(attempt,keys[0]!,keys[0]!));
  assert.equal(twiceInEnvelope.signedBy.length,1);
});
test("independent envelopes merge into an exact verifiable two-signature transaction", () => {
  const attempt = fixture();
  const first = collectTreasurySignatures(attempt,sign(attempt,keys[0]!));
  const second = collectTreasurySignatures(first,sign(attempt,keys[2]!));
  const tx = signedTreasuryTransaction(second);
  assert.equal(tx.hash().toString("hex"),attempt.transactionHash);
  assert.equal(tx.signatures.length,2);
  assert.deepEqual(Object.keys(verifyTreasuryEnvelope(attempt,tx.toXDR())).sort(),second.signedBy);
});
test("outsiders, missing signatures, malformed XDR and changes to envelope or network fail", () => {
  const attempt = fixture();
  assert.throws(() => collectTreasurySignatures(attempt,sign(attempt,Keypair.random())),/outside/);
  assert.throws(() => collectTreasurySignatures(attempt,attempt.transaction),/No treasury/);
  assert.throws(() => collectTreasurySignatures(attempt,"invalid"),/Invalid signed/);
  const changed = fixture();
  const other = new TransactionBuilder(new Account(treasury,"11"),{ fee: "100",networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.manageData({ name: "finalization-test",value: "exact-envelope" })).setTimeout(600).build();
  other.sign(keys[0]!);
  assert.throws(() => collectTreasurySignatures(changed,other.toXDR()),/exact prepared/);
  const wrongNetwork = TransactionBuilder.fromXDR(attempt.transaction,Networks.PUBLIC); wrongNetwork.sign(keys[0]!);
  assert.throws(() => collectTreasurySignatures(attempt,wrongNetwork.toXDR()),/outside/);
});
test("expired or submitted attempts reject additional signatures; stored signature forgery fails", () => {
  const attempt = fixture(), xdr = sign(attempt,keys[0]!,keys[1]!);
  assert.throws(() => collectTreasurySignatures(attempt,xdr,new Date(attempt.expiresAt)),/expired/);
  assert.throws(() => collectTreasurySignatures({ ...attempt,status: "submitted" },xdr),/no longer/);
  const collected = collectTreasurySignatures(attempt,xdr);
  const forged = { ...collected,signatures: { ...collected.signatures,[keys[0]!.publicKey()]: Buffer.alloc(64).toString("base64") } };
  assert.throws(() => signedTreasuryTransaction(forged),/Invalid treasury/);
});
