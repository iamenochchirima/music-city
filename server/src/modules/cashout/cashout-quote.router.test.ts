import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { Keypair } from "@stellar/stellar-sdk";
import { ZodError } from "zod";
import { tokenService } from "../../services/token.service.js";
import { HttpError } from "../../utils/http-error.js";
import { createCashOutQuoteRouter } from "./cashout-quote.router.js";

test("cash-out quotes require a session and bind actions to its account", async () => {
  const wallet = Keypair.random().publicKey();
  const calls: Array<{ order: string; userId: string; walletAddress: string }> = [];
  const result = { snapshot: { quote: { id: "quote" }, instructions: { destination: "provider" } }, hash: "hash", expiresAt: "2026-10-28T00:00:00.000Z" } as never;
  const app = express(); app.use(express.json());
  app.use("/ramps/:orderId/cashout", createCashOutQuoteRouter({
    async request(order, owner) { calls.push({ order, ...owner }); return result; },
    async get(order, _quote, owner) { calls.push({ order, ...owner }); return result; },
  }, async () => ({ id: "user" })));
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error instanceof HttpError ? error.statusCode : error instanceof ZodError ? 400 : 500).json({ error: error.message }));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const token = tokenService.issueSession({ walletAddress: wallet, displayName: "Fan", artistAccess: false, primaryIntent: "listener", onboardingStatus: "complete", onboardingStep: "complete", onboardingVersion: 1, profileCompletion: { percentage: 100, completed: [], missing: [], requiredComplete: true } });
  const request = (path: string, tokenValue?: string, body?: object) => fetch(`http://127.0.0.1:${address.port}/ramps/order/cashout${path}`, { method: body ? "POST" : "GET", headers: { ...(tokenValue ? { Authorization: `Bearer ${tokenValue}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await request("/quotes", undefined, {})).status, 401);
    assert.equal((await request("/quotes", token, { destination: "forged" })).status, 400);
    assert.equal(calls.length, 0);
    const response = await request("/quotes", token, {});
    assert.equal(response.status, 201); assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json() as { confirmationHash: string }).confirmationHash, "hash");
    assert.equal((await request("/quotes/quote", token)).status, 200);
    assert.deepEqual(calls, [{ order: "order", userId: "user", walletAddress: wallet }, { order: "order", userId: "user", walletAddress: wallet }]);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
