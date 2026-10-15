import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { supportRouter } from "./support.router.js";
import { adminSupportRouter } from "./admin-support.router.js";
import { supportService } from "./support.service.js";
import { tokenService } from "../../services/token.service.js";
import { HttpError } from "../../utils/http-error.js";
import { databaseService } from "../../services/database.service.js";
test("support HTTP routes bind actions to session wallets and keep admin records restricted", async () => {
  const original = {
    submit: supportService.submit,
    list: supportService.list,
    transaction: databaseService.transaction,
  };
  const calls: string[] = [];
  supportService.submit = async (sender) => {
    calls.push(sender);
    return {} as never;
  };
  supportService.list = async (sender) => {
    calls.push(sender);
    return [];
  };
  databaseService.transaction = async () => [] as never;
  const app = express();
  app.use(express.json());
  app.use("/support", supportRouter);
  app.use("/admin/support", adminSupportRouter);
  app.use(
    (
      e: Error,
      _q: express.Request,
      r: express.Response,
      _n: express.NextFunction,
    ) =>
      r
        .status(e instanceof HttpError ? e.statusCode : 500)
        .json({ error: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  const token = tokenService.issueSession({
    walletAddress: "G" + "B".repeat(55),
    displayName: "Fan",
    artistAccess: false,
    primaryIntent: "listener",
    onboardingStatus: "complete",
    onboardingStep: "complete",
    onboardingVersion: 1,
    profileCompletion: {
      percentage: 100,
      completed: [],
      missing: [],
      requiredComplete: true,
    },
  });
  const admin = tokenService.issueAdminSession({
    adminId: "admin",
    email: "admin@example.test",
    name: "Admin",
    role: "admin",
  });
  const request = (path: string, credential?: string, method = "GET") =>
    fetch(`http://127.0.0.1:${addr.port}${path}`, {
      method,
      headers: {
        ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
        "Content-Type": "application/json",
      },
      body:
        method === "POST" ? JSON.stringify({ sender: "forged" }) : undefined,
    });
  try {
    assert.equal((await request("/support")).status, 401);
    assert.equal((await request("/support", token)).status, 200);
    assert.equal(
      (await request("/support/id/submit", token, "POST")).status,
      200,
    );
    assert.deepEqual(calls, ["G" + "B".repeat(55), "G" + "B".repeat(55)]);
    assert.equal((await request("/admin/support", token)).status, 401);
    assert.equal((await request("/admin/support", admin)).status, 200);
  } finally {
    Object.assign(supportService, {
      submit: original.submit,
      list: original.list,
    });
    databaseService.transaction = original.transaction;
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
