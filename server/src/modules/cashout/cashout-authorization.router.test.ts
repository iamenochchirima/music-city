import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import { Keypair } from "@stellar/stellar-sdk";
import { ZodError } from "zod";
import { tokenService } from "../../services/token.service.js";
import { HttpError } from "../../utils/http-error.js";
import { createCashOutAuthorizationRouter } from "./cashout-authorization.router.js";

test("cash-out transfer actions require a session and use the authenticated wallet", async () => {
  const wallet = Keypair.random().publicKey(), other = Keypair.random().publicKey(), attempt = randomUUID(), quote = randomUUID();
  const calls: string[] = [];
  const owned = (owner: { userId: string; walletAddress: string }) => {
    if (owner.userId !== "artist" || owner.walletAddress !== wallet) throw new HttpError(404, "Transaction not found");
  };
  const transfer = { id: attempt, quoteId: quote, transactionHash: "a".repeat(64), transaction: "unsigned", networkFeeStroops: "100", state: "prepared", expiresAt: "2026-10-28T23:59:00.000Z" };
  const app = express(); app.use(express.json());
  app.use("/ramps/:orderId/cashout", createCashOutAuthorizationRouter(() => ({
    async latest(_order, owner) { owned(owner); calls.push("latest"); return transfer; },
    async prepare(_order, _quote, _hash, owner) { owned(owner); calls.push("prepare"); return transfer; },
    async authorize(_order, _id, _signed, owner) { owned(owner); calls.push("authorize"); return { id: attempt, transactionHash: transfer.transactionHash, state: "submitting" }; },
    async cancel(_order, _id, owner) { owned(owner); calls.push("cancel"); },
  }), async (address) => ({ id: address === wallet ? "artist" : "other" })));
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error instanceof HttpError ? error.statusCode : error instanceof ZodError ? 400 : 500).json({ error: error.message }));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const token = (walletAddress: string) => tokenService.issueSession({ walletAddress, displayName: "Fan", artistAccess: false, primaryIntent: "listener", onboardingStatus: "complete", onboardingStep: "complete", onboardingVersion: 1, profileCompletion: { percentage: 100, completed: [], missing: [], requiredComplete: true } });
  const request = (path: string, credential?: string, body?: object) => fetch(`http://127.0.0.1:${address.port}/ramps/order/cashout${path}`, { method: body ? "POST" : "GET", headers: { ...(credential ? { Authorization: `Bearer ${credential}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    assert.equal((await request("/transfer")).status, 401);
    assert.equal((await request("/transfer", token(other))).status, 404);
    const resumed = await request("/transfer", token(wallet));
    assert.equal(resumed.headers.get("cache-control"), "no-store");
    assert.equal((await resumed.json() as { transfer: { transaction: string } }).transfer.transaction, "unsigned");
    assert.equal((await request("/transfer", token(wallet), { quoteId: quote, confirmationHash: "a".repeat(64), fee: 1 })).status, 400);
    assert.equal((await request("/transfer", token(wallet), { quoteId: quote, confirmationHash: "a".repeat(64) })).status, 200);
    assert.equal((await request(`/transfer/${attempt}/authorize`, token(wallet), { signedXdr: "signed", walletAddress: other })).status, 400);
    const authorized = await request(`/transfer/${attempt}/authorize`, token(wallet), { signedXdr: "signed" });
    assert.equal(authorized.status, 200);
    assert.equal(JSON.stringify(await authorized.json()).includes("signed"), false);
    assert.equal((await request(`/transfer/${attempt}/cancel`, token(wallet), {})).status, 204);
    assert.deepEqual(calls, ["latest", "prepare", "authorize", "cancel"]);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
