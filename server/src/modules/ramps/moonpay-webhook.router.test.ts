import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import express from "express";
import { HttpError } from "../../utils/http-error.js";
import { MoonpaySandbox } from "./moonpay-sandbox.js";
import { createMoonpayWebhookRouter } from "./moonpay-webhook.router.js";
import { rampSandboxConfigSchema } from "./sandbox-config.js";

test("signed MoonPay notifications only schedule owned transactions for reconciliation", async () => {
  const provider = new MoonpaySandbox(rampSandboxConfigSchema.parse({ NODE_ENV: "test", RAMPS_SANDBOX_ENABLED: "true", MOONPAY_PK: "pk_test_fixture", MOONPAY_SK: "sk_test_fixture", MOONPAY_WEBHOOK: "wk_test_fixture" }));
  const received: Array<{ orderId: string; providerId: string; userId: string; direction: string; key: string; kind: string }> = [];
  const repo = { async recordMoonpayNotification(input: typeof received[number] & { direction: "buy" | "sell" }) { received.push(input); return input.userId === "owner"; } };
  const app = express();
  app.use(express.json({ verify: (req, _res, body) => { (req as express.Request).rawBody = body.toString("utf8"); } }));
  app.use("/moonpay", createMoonpayWebhookRouter(repo, () => provider));
  app.use("/disabled", createMoonpayWebhookRouter(repo, () => null));
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error instanceof HttpError ? error.statusCode : 500).json({ error: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const sign = (body: string, time = Math.floor(Date.now() / 1000)) => `t=${time},s=${createHmac("sha256", "wk_test_fixture").update(`${time}.${body}`).digest("hex")}`;
  const request = (body: string, signature: string, path = "/moonpay") => fetch(`http://127.0.0.1:${address.port}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "Moonpay-Signature-V2": signature }, body });
  try {
    const body = JSON.stringify({ type: "transaction_updated", data: { id: "provider-id", externalTransactionId: "order", externalCustomerId: "owner", status: "completed", walletAddress: "private" } });
    assert.equal((await request(body, sign(body), "/disabled")).status, 404);
    assert.equal((await request(body, "bad")).status, 401);
    assert.equal((await request(body, sign(body, Math.floor(Date.now() / 1000) - 301))).status, 401);
    assert.equal((await request(body + " ", sign(body))).status, 401);
    assert.equal((await request(body, sign(body))).status, 204);
    assert.equal(received.length, 1);
    assert.equal(received[0].direction, "buy");
    assert.match(received[0].key, /^[a-f0-9]{64}$/);
    assert.equal("status" in received[0], false);
    const sell = JSON.stringify({ type: "sell_transaction_requote_required", data: { id: "provider-id", externalTransactionId: "order", externalCustomerId: "owner" } });
    assert.equal((await request(sell, sign(sell))).status, 204);
    assert.equal(received[1].direction, "sell");
    const unrelated = JSON.stringify({ type: "transaction_updated", data: { id: "provider-id", externalTransactionId: "order", externalCustomerId: "stranger" } });
    assert.equal((await request(unrelated, sign(unrelated))).status, 404);
    const unsupported = JSON.stringify({ type: "identity_check_updated", data: { id: "provider-id", externalTransactionId: "order", externalCustomerId: "owner" } });
    assert.equal((await request(unsupported, sign(unsupported))).status, 400);
    assert.equal(received.length, 3);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
