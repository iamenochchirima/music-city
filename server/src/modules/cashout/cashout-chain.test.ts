import assert from "node:assert/strict";
import test from "node:test";
import { Account, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { createCashOutChain, verifyCashOutReceipt, verifyCashOutReadiness } from "./cashout-chain.js";

test("receipt verification binds the exact Testnet transaction, source and ledger", () => {
  const wallet = Keypair.random();
  const tx = new TransactionBuilder(new Account(wallet.publicKey(), "1"), { fee: "100", networkPassphrase: Networks.TESTNET }).addOperation(Operation.manageData({ name: "test", value: "receipt" })).setTimeout(60).build();
  tx.sign(wallet);
  const expected = { transactionHash: tx.hash().toString("hex"), walletAddress: wallet.publicKey() };
  const receipt = { hash: expected.transactionHash, successful: true, envelope_xdr: tx.toXDR(), ledger: 123, fee_charged: "100" };
  assert.equal(verifyCashOutReceipt(expected, receipt).ledger, 123);
  for (const patch of [{ hash: "a".repeat(64) }, { ledger: 0 }, { fee_charged: "-1" }, { envelope_xdr: "invalid" }])
    assert.throws(() => verifyCashOutReceipt(expected, { ...receipt, ...patch }));
  assert.throws(() => verifyCashOutReceipt({ ...expected, walletAddress: Keypair.random().publicKey() }, receipt));
  assert.throws(() => verifyCashOutReceipt({ ...expected, transactionHash: "b".repeat(64) }, receipt));
  const wrongNetwork = TransactionBuilder.fromXDR(tx.toXDR(), Networks.PUBLIC);
  assert.throws(() => verifyCashOutReceipt({ ...expected, transactionHash: wrongNetwork.hash().toString("hex") }, { ...receipt, hash: wrongNetwork.hash().toString("hex") }));
  assert.equal(verifyCashOutReceipt(expected, { ...receipt, successful: false }).successful, false);
});
test("chain requests use a fixed Testnet host and leave unavailable receipts unresolved", async () => {
  const requests: string[] = [];
  const chain = createCashOutChain((async (url: URL, init: RequestInit) => {
    assert.equal(url.origin, "https://horizon-testnet.stellar.org"); assert.equal(init.redirect, "error");
    requests.push(`${init.method ?? "GET"} ${url.pathname}`);
    if (url.pathname === "/ledgers") return Response.json({ _embedded: { records: [{ sequence: 20, closed_at: "2026-10-28T12:00:00.000Z" }] } });
    if (url.pathname === "/") return Response.json({ history_elder_ledger: 10, history_latest_ledger: 20, history_latest_ledger_closed_at: "2026-10-28T12:00:00.000Z" });
    return new Response(null, { status: 404 });
  }) as typeof fetch);
  assert.equal((await chain.ledger()).sequence, 20);
  assert.deepEqual(await chain.historyCoverage(), { start: 10, latest: 20, latestClosedAt: "2026-10-28T12:00:00.000Z" });
  assert.equal(await chain.receipt("a".repeat(64)), null);
  await assert.rejects(chain.submit("signed"), /Waiting/);
  assert.deepEqual(requests, ["GET /ledgers", "GET /", "GET /transactions/" + "a".repeat(64), "POST /transactions"]);
});

test("preparation uses a validated Testnet ledger and the requested wallet account", async () => {
  const wallet = Keypair.random().publicKey();
  let accountId = wallet;
  let fee = 100;
  const requests: string[] = [];
  const chain = createCashOutChain((async (url: URL) => {
    assert.equal(url.origin, "https://horizon-testnet.stellar.org");
    requests.push(url.pathname);
    if (url.pathname === "/ledgers") return Response.json({ _embedded: { records: [{ sequence: 30, closed_at: "2026-10-28T12:00:00.000Z", base_fee_in_stroops: fee, base_reserve_in_stroops: 5000000 }] } });
    return Response.json({ account_id: accountId, sequence: "123", thresholds: { med_threshold: 1 }, signers: [{ key: wallet, type: "ed25519_public_key", weight: 1 }] });
  }) as typeof fetch);
  assert.equal((await chain.preparationLedger()).base_fee_in_stroops, 100);
  assert.equal((await chain.account(wallet)).sequence, "123");
  assert.deepEqual(requests, ["/ledgers", `/accounts/${wallet}`]);
  accountId = Keypair.random().publicKey();
  await assert.rejects(chain.account(wallet), /verify the Stellar wallet/);
  await assert.rejects(chain.account("../transactions"), /Invalid wallet/);
  fee = 10001;
  await assert.rejects(chain.preparationLedger(), /network fee/);
});


test("cash-out readiness checks spendable USDC and XLM reserve using exact units", () => {
  const wallet = Keypair.random().publicKey(), issuer = Keypair.random().publicKey();
  const native = { asset_type: "native", balance: "1.5000100", selling_liabilities: "0" };
  const usdc = { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: issuer, balance: "1.2500000", selling_liabilities: "0.2500000", is_authorized: true };
  const account = { account_id: wallet, sequence: "1", subentry_count: 1, num_sponsoring: 0, num_sponsored: 0, balances: [native, usdc], thresholds: { med_threshold: 1 }, signers: [{ key: wallet, type: "ed25519_public_key", weight: 1 }] };
  const check = (value: unknown, fee = 100, baseFee = 100) => verifyCashOutReadiness(value, issuer, "10000000", 5000000, fee, baseFee);
  assert.doesNotThrow(() => check(account));
  assert.throws(() => check({ ...account, balances: [native, { ...usdc, selling_liabilities: "0.2500001" }] }), /insufficient spendable USDC/);
  assert.throws(() => check({ ...account, balances: [native, { ...usdc, asset_issuer: Keypair.random().publicKey() }] }), /trustline/);
  assert.throws(() => check({ ...account, balances: [native, { ...usdc, is_authorized: false }] }), /trustline/);
  assert.throws(() => check({ ...account, balances: [native, { ...usdc, is_authorized: undefined }] }), /trustline/);
  assert.throws(() => check({ ...account, balances: [{ ...native, balance: "1.5000099" }, usdc] }), /Add XLM/);
  assert.throws(() => check({ ...account, balances: [native, { ...usdc, selling_liabilities: "invalid" }] }), /check your wallet balance/);
  assert.throws(() => check({ ...account, num_sponsored: 99 }), /check your wallet balance/);
  assert.throws(() => check(account, 100, 200), /Network fee changed/);
});
