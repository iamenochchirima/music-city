import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { Keypair } from "@stellar/stellar-sdk";
import type { RampOrder } from "@music-city/shared";
import { tokenService } from "../../services/token.service.js";
import { HttpError } from "../../utils/http-error.js";
import { createAdminRampsRouter } from "./admin-ramps.router.js";

test("ramp administration is read-only and restricted to admin sessions", async () => {
  const order: RampOrder = {
    id: "order", terms: { userId: "user", walletAddress: Keypair.random().publicKey(), requestId: "ed39ecdf-d398-49cb-86bf-54cac8329168", provider: "moonpay", direction: "buy", environment: "sandbox", network: "stellar:testnet", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amount: { currency: "GBP", units: "10000", decimals: 2 } },
    providerState: "processing", chainState: "unobserved", createdAt: "2026-10-28T00:00:00.000Z", updatedAt: "2026-10-28T00:00:00.000Z",
  };
  let reads = 0;
  const app = express();
  app.use("/admin/ramps", createAdminRampsRouter({
    async listForAdmin() { reads++; return [order]; },
    async detailForAdmin(id) { reads++; return id === order.id ? { order, events: [{ source: "provider_api", kind: "status_observed" }], attempts: [], deliveries: [], receipts: [], job: { attempts: 1, last_error_code: "provider_check_failed" } } : null; },
  }));
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error instanceof HttpError ? error.statusCode : 500).json({ error: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const admin = tokenService.issueAdminSession({ adminId: "admin", email: "admin@example.test", name: "Admin", role: "admin" });
  const user = tokenService.issueSession({ walletAddress: order.terms.walletAddress, displayName: "Fan", artistAccess: false, primaryIntent: "listener", onboardingStatus: "complete", onboardingStep: "complete", onboardingVersion: 1, profileCompletion: { percentage: 100, completed: [], missing: [], requiredComplete: true } });
  const request = (path: string, token?: string, method = "GET") => fetch(`http://127.0.0.1:${address.port}/admin/ramps${path}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  try {
    assert.equal((await request("/")).status, 401);
    assert.equal((await request("/", user)).status, 401);
    assert.equal(reads, 0);
    const list = await request("/", admin);
    assert.equal(list.status, 200);
    assert.equal(list.headers.get("cache-control"), "no-store");
    const body = await list.json() as { items: Record<string, unknown>[] };
    assert.equal(body.items[0].walletAddress, order.terms.walletAddress);
    assert.equal(body.items[0].chainState, "unobserved");
    assert.equal("terms" in body.items[0], false);
    assert.equal((await request("/order", admin)).status, 200);
    assert.equal((await request("/missing", admin)).status, 404);
    assert.equal((await request("/order", admin, "POST")).status, 404);
    assert.equal(reads, 3);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
