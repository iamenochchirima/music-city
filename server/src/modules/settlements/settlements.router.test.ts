import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { adminSettlementsRouter } from "./settlements.router.js";
import { settlementService } from "./settlement.service.js";
import { tokenService } from "../../services/token.service.js";
import { HttpError } from "../../utils/http-error.js";
test("settlement HTTP reads require an admin and protected actions require super admin", async () => {
  const app = express();
  app.use(express.json());
  app.use("/settlements", adminSettlementsRouter);
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
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  const original = { ...settlementService };
  const calls: string[] = [];
  settlementService.list = async () => [];
  settlementService.prepare = async (_id, _kind, actor) => {
    calls.push(actor);
    return {} as never;
  };
  settlementService.addSignature = async (_id, actor) => {
    calls.push(actor);
    return {} as never;
  };
  settlementService.submit = async (_id, actor) => {
    calls.push(actor);
    return {} as never;
  };
  const admin = tokenService.issueAdminSession({
    adminId: "read",
    email: "read@example.test",
    name: "Read",
    role: "admin",
  });
  const operator = tokenService.issueAdminSession({
    adminId: "operator",
    email: "operator@example.test",
    name: "Operator",
    role: "super_admin",
  });
  async function request(path: string, token?: string, method = "POST") {
    return fetch(`http://127.0.0.1:${port}/settlements${path}`, {
      method,
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          }
        : {},
      body:
        method === "POST"
          ? JSON.stringify({ actor: "forged-actor" })
          : undefined,
    });
  }
  try {
    assert.equal((await request("", undefined, "GET")).status, 401);
    assert.equal((await request("", admin, "GET")).status, 200);
    for (const path of [
      "/batch/prepare",
      "/batch/claims/0/reclaim",
      "/batch/maintenance",
      "/attempts/attempt/signatures",
      "/attempts/attempt/submit",
    ]) {
      assert.equal((await request(path)).status, 401);
      assert.equal((await request(path, admin)).status, 403);
      assert.equal(calls.length, 0);
      assert.ok([200, 201].includes((await request(path, operator)).status));
      assert.equal(calls.pop(), "admin:operator");
    }
  } finally {
    Object.assign(settlementService, original);
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  }
});
