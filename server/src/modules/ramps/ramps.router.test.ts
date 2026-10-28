import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { Keypair } from "@stellar/stellar-sdk";
import type { RampOrder } from "@music-city/shared";
import { createRampsRouter } from "./ramps.router.js";
import { tokenService } from "../../services/token.service.js";
import { HttpError } from "../../utils/http-error.js";

test("ramp history and detail require a session and enforce user and wallet ownership", async () => {
  const wallet = Keypair.random().publicKey();
  const otherWallet = Keypair.random().publicKey();
  const order: RampOrder = {
    id: "order-1",
    terms: { userId: "user-1", walletAddress: wallet, requestId: "ed39ecdf-d398-49cb-86bf-54cac8329168", provider: "moonpay", direction: "buy", environment: "sandbox", network: "stellar:testnet", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amount: { currency: "GBP", units: "10000", decimals: 2 } },
    providerState: "completed", chainState: "unobserved", providerTransactionId: "private-reference", createdAt: "2026-10-28T00:00:00.000Z", updatedAt: "2026-10-28T00:00:00.000Z",
  };
  const owned = (user: string, address: string) => user === order.terms.userId && address === order.terms.walletAddress;
  const app = express();
  const createCalls: Array<{ userId: string; walletAddress: string }> = [];
  app.use(express.json());
  app.use("/ramps", createRampsRouter({
    list: async (user, address) => owned(user, address) ? [order] : [],
    getForOwner: async (id, user, address) => id === order.id && owned(user, address) ? order : null,
  }, async address => ({ id: address === wallet ? "user-1" : "user-2" }), { routes: async () => [], create: async (owner) => { createCalls.push(owner); return { order, created: true }; } }));
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error instanceof HttpError ? error.statusCode : 500).json({ error: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const token = (walletAddress: string) => tokenService.issueSession({ walletAddress, displayName: "Fan", artistAccess: false, primaryIntent: "listener", onboardingStatus: "complete", onboardingStep: "complete", onboardingVersion: 1, profileCompletion: { percentage: 100, completed: [], missing: [], requiredComplete: true } });
  const request = (path: string, credential?: string, method = "GET") => fetch(`http://127.0.0.1:${address.port}/ramps${path}`, { method, headers: { ...(credential ? { Authorization: `Bearer ${credential}` } : {}), ...(method === "POST" ? { "Content-Type": "application/json" } : {}) }, ...(method === "POST" ? { body: "{}" } : {}) });
  try {
    assert.equal((await request("/")).status, 401);
    assert.equal((await request("/", "invalid")).status, 401);
    const response = await request("/", token(wallet));
    assert.equal(response.headers.get("cache-control"), "no-store");
    const result = await response.json() as { items: Record<string, unknown>[] };
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].providerState, "completed");
    assert.equal(result.items[0].chainState, "unobserved");
    assert.equal(result.items[0].launchRequested, false);
    assert.equal(result.items[0].providerStarted, true);
    assert.equal("providerTransactionId" in result.items[0], false);
    assert.equal("terms" in result.items[0], false);
    assert.equal((await request("/order-1", token(wallet))).status, 200);
    assert.deepEqual(await (await request("/", token(otherWallet))).json(), { items: [] });
    assert.equal((await request("/order-1", token(otherWallet))).status, 404);
    assert.equal((await request("/missing", token(wallet))).status, 404);
    assert.equal((await request("/", undefined, "POST")).status, 401);
    assert.deepEqual(await (await request("/capabilities", token(wallet))).json(), { routes: [] });
    assert.equal((await request("/", token(wallet), "POST")).status, 201);
    assert.deepEqual(createCalls, [{ userId: "user-1", walletAddress: wallet }]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
