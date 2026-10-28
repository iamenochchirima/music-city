import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { Keypair } from "@stellar/stellar-sdk";
import { ZodError } from "zod";
import { tokenService } from "../../services/token.service.js";
import { HttpError } from "../../utils/http-error.js";
import { createRampLaunchRouter, directCustomerIp } from "./ramp-launch.router.js";

test("direct launch IP uses only a public socket address and refuses proxies", () => {
  const request = (remoteAddress: string) => ({ socket: { remoteAddress } }) as Parameters<typeof directCustomerIp>[0];
  assert.deepEqual(directCustomerIp(request("::ffff:8.8.8.8"), "direct", 0), ["8.8.8.8"]);
  for (const address of ["127.0.0.1", "10.0.0.4", "192.0.2.5", "::1", "fe80::1"]) assert.throws(() => directCustomerIp(request(address), "direct", 0));
  assert.throws(() => directCustomerIp(request("8.8.8.8"), "disabled", 0));
  assert.throws(() => directCustomerIp(request("8.8.8.8"), "direct", 1));
});

test("launch requires authentication and rejects client-supplied payment or IP parameters", async () => {
  const wallet = Keypair.random().publicKey();
  const calls: unknown[] = [];
  const app = express(); app.use(express.json());
  app.use("/ramps/:orderId", createRampLaunchRouter(() => ({ async launch(id, owner, ips) { calls.push({ id, owner, ips }); return { url: "https://buy-sandbox.moonpay.com/", created: true }; } }), async () => ({ id: "user" }), () => ["8.8.8.8"]));
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error instanceof HttpError ? error.statusCode : error instanceof ZodError ? 400 : 500).json({ error: error.message }));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const token = tokenService.issueSession({ walletAddress: wallet, displayName: "Fan", artistAccess: false, primaryIntent: "listener", onboardingStatus: "complete", onboardingStep: "complete", onboardingVersion: 1, profileCompletion: { percentage: 100, completed: [], missing: [], requiredComplete: true } });
  const request = (body: object, credential?: string) => fetch(`http://127.0.0.1:${address.port}/ramps/order/launch`, { method: "POST", headers: { "Content-Type": "application/json", ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, body: JSON.stringify(body) });
  try {
    assert.equal((await request({})).status, 401);
    assert.equal((await request({ ip: "8.8.8.8" }, token)).status, 400);
    assert.equal(calls.length, 0);
    const response = await request({}, token);
    assert.equal(response.status, 201); assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(calls, [{ id: "order", owner: { userId: "user", walletAddress: wallet }, ips: ["8.8.8.8"] }]);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
