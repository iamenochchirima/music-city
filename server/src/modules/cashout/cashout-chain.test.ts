import assert from "node:assert/strict";
import test from "node:test";
import { Account, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { createCashOutChain, verifyCashOutReceipt } from "./cashout-chain.js";

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
    if (url.pathname === "/ledgers") return Response.json({ _embedded: { records: [{ sequence: 30, closed_at: "2026-10-28T12:00:00.000Z", base_fee_in_stroops: fee }] } });
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
