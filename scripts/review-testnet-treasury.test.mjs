import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { reviewTransaction, verifiedSigners } from "./review-testnet-treasury.mjs";
const require = createRequire(new URL("../server/package.json", import.meta.url));
const { Account, Keypair, Networks, Operation, TransactionBuilder } = require("@stellar/stellar-sdk");

function fixture(network = Networks.TESTNET) {
  const key = Keypair.random();
  const tx = new TransactionBuilder(new Account(key.publicKey(), "1"), { fee: "100", networkPassphrase: network })
    .addOperation(Operation.manageData({ name: "offline-fixture", value: "test" }))
    .setTimeout(120).build();
  return { key, tx, hash: tx.hash().toString("hex") };
}

test("review preserves the exact unsigned Testnet envelope", () => {
  const { key, tx, hash } = fixture();
  const reviewed = reviewTransaction(tx.toXDR(), hash, Date.now(), key.publicKey());
  assert.equal(reviewed.toXDR(), tx.toXDR());
  assert.equal(reviewed.signatures.length, 0);
});

test("review rejects another network hash, source, or changed transaction", () => {
  const { key, tx, hash } = fixture();
  assert.throws(() => reviewTransaction(tx.toXDR(), "0".repeat(64), Date.now(), key.publicKey()), /hash/);
  assert.throws(() => reviewTransaction(tx.toXDR(), hash, Date.now(), Keypair.random().publicKey()), /source/);
  const mainnet = fixture(Networks.PUBLIC);
  assert.throws(() => reviewTransaction(mainnet.tx.toXDR(), mainnet.hash, Date.now(), mainnet.key.publicKey()), /hash/);
});

test("expired and previously signed envelopes cannot be reused", () => {
  const { key, tx, hash } = fixture();
  assert.throws(() => reviewTransaction(tx.toXDR(), hash, Number(tx.timeBounds.maxTime) * 1000, key.publicKey()), /expired/);
  tx.sign(key);
  assert.throws(() => reviewTransaction(tx.toXDR(), hash, Date.now(), key.publicKey()), /unsigned/);
});

test("signer state must contain three distinct keys in the expected slots", () => {
  const keys = [Keypair.random(), Keypair.random(), Keypair.random()];
  const expected = keys.map((key) => key.publicKey());
  assert.equal(verifiedSigners({ secrets: keys.map((key) => key.secret()) }, expected).length, 3);
  assert.throws(() => verifiedSigners({ secrets: keys.slice(1).map((key) => key.secret()) }, expected), /match/);
  assert.throws(() => verifiedSigners({ secrets: [keys[0].secret(), keys[0].secret(), keys[2].secret()] }, expected), /match/);
  assert.throws(() => verifiedSigners({ secrets: keys.slice().reverse().map((key) => key.secret()) }, expected), /match/);
});
