import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { adminAgreementsRouter } from "./admin-agreements.router.js";
import { finalizationService } from "./finalization.service.js";
import { tokenService } from "../../services/token.service.js";
import { HttpError } from "../../utils/http-error.js";
import { createApp } from "../../app/create-app.js";

test("agreement admin HTTP routes enforce admin read and super-admin operation roles", async () => {
  const app = express(); app.use(express.json()); app.use("/admin/agreements",adminAgreementsRouter);
  app.use((error: Error,_req: express.Request,res: express.Response,_next: express.NextFunction) => { res.status(error instanceof HttpError ? error.statusCode : 500).json({ error: error.message }); });
  const server = app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve => server.once("listening",resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/admin/agreements`;
  const admin = tokenService.issueAdminSession({ adminId: "reviewer",email: "reviewer@example.test",name: "Reviewer",role: "admin" });
  const superAdmin = tokenService.issueAdminSession({ adminId: "operator",email: "operator@example.test",name: "Operator",role: "super_admin" });
  const original = { ...finalizationService };
  const calls: { method: string; actor: string }[] = [];
  finalizationService.list = async () => [];
  finalizationService.detail = async (_id,actor) => { calls.push({ method: "detail",actor }); return {} as never; };
  finalizationService.prepare = async (_id,actor) => { calls.push({ method: "prepare",actor }); return {} as never; };
  finalizationService.addSignatures = async (_id,_attempt,actor) => { calls.push({ method: "signatures",actor }); return {} as never; };
  finalizationService.submit = async (_id,_attempt,actor) => { calls.push({ method: "submit",actor }); return {} as never; };
  finalizationService.reconcile = async (_id,_attempt,actor) => { calls.push({ method: "reconcile",actor }); return {} as never; };
  finalizationService.resolveDispute = async (_id,actor) => { calls.push({ method: "resolution",actor }); return {} as never; };
  async function request(path: string,token?: string,method = "GET") {
    return fetch(base+path,{ method,headers: token ? { Authorization: `Bearer ${token}`,"Content-Type": "application/json" } : {},body: method === "POST" ? JSON.stringify({ signedTransaction: "xdr",actor: "forged-actor" }) : undefined });
  }
  try {
    assert.equal((await request("")).status,401);
    assert.equal((await request("","invalid-token")).status,401);
    assert.equal((await request("",admin)).status,200);
    assert.equal((await request("/agreement",admin)).status,200);
    assert.deepEqual(calls.pop(),{ method: "detail",actor: "admin:reviewer" });
    for (const [path,method,status] of [
      ["/agreement/resolutions","resolution",201],
      ["/agreement/finalizations","prepare",201],
      ["/agreement/finalizations/attempt/signatures","signatures",200],
      ["/agreement/finalizations/attempt/submit","submit",200],
      ["/agreement/finalizations/attempt/reconcile","reconcile",200],
    ] as const) {
      assert.equal((await request(path,undefined,"POST")).status,401);
      assert.equal((await request(path,admin,"POST")).status,403);
      assert.equal(calls.length,0);
      assert.equal((await request(path,superAdmin,"POST")).status,status);
      assert.deepEqual(calls.pop(),{ method,actor: "admin:operator" });
    }
  } finally { Object.assign(finalizationService,original); await new Promise<void>((resolve,reject) => server.close(e => e ? reject(e) : resolve())); }
});

test("removed split activation and single-key publication routes return 404 even for super admins", async () => {
  const server = createApp().listen(0,"127.0.0.1");
  await new Promise<void>(resolve => server.once("listening",resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const token = tokenService.issueAdminSession({ adminId: "operator",email: "operator@example.test",name: "Operator",role: "super_admin" });
  try {
    for (const [method,path] of [
      ["PUT","/api/v1/royalties/tracks/track/splits"],
      ["POST","/api/v1/royalties/tracks/track/splits/publish"],
      ["GET","/api/v1/royalties/tracks/track/splits/verify"],
      ["PUT","/api/v1/admin/royalties/tracks/track/splits"],
    ]) {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`,{ method,headers: { Authorization: `Bearer ${token}`,"Content-Type": "application/json" },body: method === "GET" ? undefined : JSON.stringify({ activate: true,recipients: [] }) });
      assert.equal(response.status,404,`${method} ${path}`);
    }
  } finally { await new Promise<void>((resolve,reject) => server.close(e => e ? reject(e) : resolve())); }
});
