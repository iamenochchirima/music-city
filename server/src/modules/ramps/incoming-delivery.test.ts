import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import type { RampOrder } from "@music-city/shared";
import { verifyIncomingDelivery } from "./incoming-delivery.js";

const wallet = Keypair.random().publicKey(), issuer = Keypair.random().publicKey(), hash = "a".repeat(64);
const order = (asset: "XLM" | "USDC" = "USDC"): RampOrder => ({
  id: "order", terms: { userId: "owner", walletAddress: wallet, requestId: "ed39ecdf-d398-49cb-86bf-54cac8329168", provider: "moonpay", direction: "buy", environment: "sandbox", network: "stellar:testnet", assetCode: asset, ...(asset === "USDC" ? { assetIssuer: issuer } : {}), market: { country: "GB", currency: "GBP", method: "card" }, amount: { currency: "GBP", units: "10000", decimals: 2 } },
  providerState: "completed", chainState: "unobserved", createdAt: "2026-10-28T00:00:00.000Z", updatedAt: "2026-10-28T00:00:00.000Z",
});
const observed = { id: "provider", externalId: "order", state: "completed" as const, originalStatus: "completed", updatedAt: "2026-10-28T00:00:00.000Z", chainHash: hash, assetUnits: "12500000" };
const payment = { id: "101", transaction_hash: hash, transaction_successful: true, type: "payment", to: wallet, asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: issuer, amount: "1.2500000" };
const fetcher = (transaction: object | null, records: object[]) => (async (url: URL, init: RequestInit) => {
  assert.equal(url.origin, "https://horizon-testnet.stellar.org");
  assert.equal(init.redirect, "error");
  if (url.pathname.endsWith("/operations")) return Response.json({ _embedded: { records } });
  return transaction ? Response.json(transaction) : new Response(null, { status: 404 });
}) as typeof fetch;
const transaction = { hash, successful: true, ledger: 100, operation_count: 1 };

test("confirms only an exact successful Testnet payment to the saved wallet and asset", async () => {
  assert.deepEqual(await verifyIncomingDelivery(order(), observed, fetcher(transaction, [payment])), { transactionHash: hash, operationId: "101", ledger: 100, assetUnits: "12500000" });
  assert.ok(await verifyIncomingDelivery(order("XLM"), observed, fetcher(transaction, [{ ...payment, asset_type: "native", asset_code: undefined, asset_issuer: undefined }])));
  for (const changed of [{ to: Keypair.random().publicKey() }, { asset_issuer: Keypair.random().publicKey() }, { asset_code: "OTHER" }, { amount: "1.2500001" }, { transaction_hash: "b".repeat(64) }, { transaction_successful: false }, { type: "path_payment_strict_send" }])
    await assert.rejects(verifyIncomingDelivery(order(), observed, fetcher(transaction, [{ ...payment, ...changed }])), /does not match/);
  await assert.rejects(verifyIncomingDelivery(order(), observed, fetcher({ ...transaction, hash: "b".repeat(64) }, [payment])), /could not be verified/);
  await assert.rejects(verifyIncomingDelivery(order(), observed, fetcher({ ...transaction, successful: false }, [payment])), /could not be verified/);
  await assert.rejects(verifyIncomingDelivery(order(), observed, fetcher({ ...transaction, operation_count: 2 }, [payment])), /incomplete/);
  await assert.rejects(verifyIncomingDelivery(order(), observed, fetcher({ ...transaction, operation_count: 2 }, [payment, { ...payment, id: "102" }])), /does not match/);
});
test("missing provider or chain evidence stays unresolved", async () => {
  const never = (async () => { throw new Error("unexpected request"); }) as typeof fetch;
  assert.equal(await verifyIncomingDelivery(order(), { ...observed, state: "processing" }, never), null);
  assert.equal(await verifyIncomingDelivery(order(), { ...observed, assetUnits: undefined }, never), null);
  assert.equal(await verifyIncomingDelivery(order(), observed, fetcher(null, [])), null);
  await assert.rejects(verifyIncomingDelivery(order(), observed, (async () => { throw new Error("offline"); }) as typeof fetch), /Unable to check/);
});
