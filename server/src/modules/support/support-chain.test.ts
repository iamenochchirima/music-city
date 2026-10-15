import test from "node:test";
import assert from "node:assert/strict";
import {
  Keypair,
  Networks,
  TransactionBuilder,
  Account,
  Operation,
  Asset,
} from "@stellar/stellar-sdk";
import type { SupportPayment } from "@music-city/shared";
import { prepareSupportSchema } from "@music-city/shared";
import { env } from "../../config/env.js";
import {
  buildSupportTransaction,
  validateSupportReadiness,
  verifySupportSignature,
  verifySupportReceipt,
  type SupportAccount,
} from "./support-chain.js";
const issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const ledger = {
  closed_at: new Date().toISOString(),
  sequence: 100,
  base_fee_in_stroops: 100,
  base_reserve_in_stroops: 5000000,
};
const key = Keypair.random(),
  destination = Keypair.random();
function account(): SupportAccount {
  return {
    account_id: key.publicKey(),
    sequence: "100",
    subentry_count: 1,
    balances: [
      { asset_type: "native", balance: "5" },
      {
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: issuer,
        balance: "10",
        limit: "100",
        is_authorized: true,
      },
    ],
    thresholds: { med_threshold: 1 },
    signers: [{ key: key.publicKey(), weight: 1, type: "ed25519_public_key" }],
  };
}
function payment(): SupportPayment {
  env.STELLAR_NETWORK_PASSPHRASE = Networks.TESTNET;
  env.STELLAR_SETTLEMENT_ASSET_CODE = "USDC";
  env.STELLAR_SETTLEMENT_ASSET_ISSUER = issuer;
  return {
    id: "id",
    sender: key.publicKey(),
    amount: "1.0000000",
    ...buildSupportTransaction(
      "id",
      key.publicKey(),
      destination.publicKey(),
      "1",
      "100",
      ledger,
    ),
  } as SupportPayment;
}
test("support amounts reject zero, exponent, excess precision, and untrusted destinations", () => {
  const target = { kind: "artist", profileId: "artist" },
    requestKey = crypto.randomUUID();
  for (const amount of ["0", "0.0000000", "1e2", "0.00000001", "-1", "01"])
    assert.equal(
      prepareSupportSchema.safeParse({ target, requestKey, amount }).success,
      false,
    );
  assert.equal(
    prepareSupportSchema.safeParse({
      target: { ...target, walletAddress: destination.publicKey() },
      requestKey,
      amount: "1",
    }).success,
    false,
  );
});
test("support requires the exact body, source signature, network, and account threshold", () => {
  const p = payment();
  const tx = TransactionBuilder.fromXDR(p.transaction, Networks.TESTNET);
  tx.sign(key);
  assert.equal(verifySupportSignature(p, tx.toXDR(), account()), tx.toXDR());
  const outsider = TransactionBuilder.fromXDR(p.transaction, Networks.TESTNET);
  outsider.sign(destination);
  assert.throws(
    () => verifySupportSignature(p, outsider.toXDR(), account()),
    /does not authorize/,
  );
  const wrongNetwork = TransactionBuilder.fromXDR(
    p.transaction,
    Networks.PUBLIC,
  );
  wrongNetwork.sign(key);
  assert.throws(
    () => verifySupportSignature(p, wrongNetwork.toXDR(), account()),
    /does not authorize/,
  );
  const altered = new TransactionBuilder(new Account(key.publicKey(), "100"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: destination.publicKey(),
        asset: new Asset("USDC", issuer),
        amount: "2",
      }),
    )
    .setTimeout(300)
    .build();
  altered.sign(key);
  assert.throws(
    () => verifySupportSignature(p, altered.toXDR(), account()),
    /exact support payment/,
  );
  assert.throws(
    () =>
      verifySupportSignature(p, tx.toXDR(), {
        ...account(),
        thresholds: { med_threshold: 2 },
      }),
    /More wallet authorization/,
  );
  const duplicate = TransactionBuilder.fromXDR(p.transaction, Networks.TESTNET);
  duplicate.sign(key);
  duplicate.sign(key);
  assert.throws(
    () => verifySupportSignature(p, duplicate.toXDR(), account()),
    /does not authorize/,
  );
});
test("wallet readiness checks authorization, spendable balances, reserve, and receiving capacity", () => {
  const a = account();
  validateSupportReadiness(a, issuer, 10000000n, false, ledger);
  validateSupportReadiness(a, issuer, 10000000n, true, ledger);
  assert.throws(
    () =>
      validateSupportReadiness(
        { ...a, balances: a.balances.slice(0, 1) },
        issuer,
        1n,
        false,
        ledger,
      ),
    /trustline/,
  );
  assert.throws(
    () => validateSupportReadiness(a, issuer, 100000001n, false, ledger),
    /insufficient USDC/,
  );
  assert.throws(
    () => validateSupportReadiness(a, issuer, 900000001n, true, ledger),
    /limit is too low/,
  );
  assert.throws(
    () =>
      validateSupportReadiness(
        {
          ...a,
          balances: a.balances.map((b) =>
            b.asset_code ? { ...b, is_authorized: false } : b,
          ),
        },
        issuer,
        1n,
        true,
        ledger,
      ),
    /not authorized/,
  );
  assert.throws(
    () =>
      validateSupportReadiness(
        {
          ...a,
          balances: a.balances.map((b) =>
            b.asset_type === "native" ? { ...b, balance: "1.5" } : b,
          ),
        },
        issuer,
        1n,
        false,
        ledger,
      ),
    /network fee/,
  );
});
test("receipts must match the pinned transaction body and ledger evidence", () => {
  const p = payment();
  const receipt = {
    hash: p.transactionHash,
    envelope_xdr: p.transaction,
    successful: true,
    ledger: 123,
    fee_charged: "100",
  };
  verifySupportReceipt(p, receipt);
  assert.throws(
    () => verifySupportReceipt(p, { ...receipt, hash: "a".repeat(64) }),
    /could not be verified/,
  );
  assert.throws(
    () => verifySupportReceipt(p, { ...receipt, ledger: 0 }),
    /could not be verified/,
  );
});
