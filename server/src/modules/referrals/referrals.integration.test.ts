import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import express from "express";

const testUrl = process.env.REFERRALS_TEST_DATABASE_URL;
test("registration referrals through real PostgreSQL and HTTP routes", { skip: !testUrl }, async t => {
  const url = new URL(testUrl!);
  assert.ok(["localhost","127.0.0.1"].includes(url.hostname) && url.pathname.endsWith("_test"),"Use an isolated local database ending in _test");
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = "test";
  process.env.REFERRALS_ENABLED = "true";
  process.env.ARTIST_ONBOARDING_FEE_PRICE = "0";
  const { databaseService } = await import("../../services/database.service.js");
  const { usersService } = await import("../users/users.service.js");
  const { usersRepository } = await import("../users/users.repository.js");
  const { referralsService } = await import("./referrals.service.js");
  const { env } = await import("../../config/env.js");
  const { referralsRouter,adminReferralsRouter } = await import("./referrals.router.js");
  const { usersRouter } = await import("../users/users.router.js");
  const { tokenService } = await import("../../services/token.service.js");
  const { errorHandler } = await import("../../middleware/error-handler.js");
  const app = express(); app.use(express.json()); app.use("/referrals",referralsRouter); app.use("/admin/referrals",adminReferralsRouter); app.use("/users",usersRouter); app.use(errorHandler);
  const server = app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve => server.once("listening",resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const wallet = () => Keypair.random().publicKey();
  const inviterWallet = wallet();
  const welcome = (w: string, receipt?: string) => usersService.saveOnboardingStep(w,{ step: "identity", displayName: "Test artist",referralReceipt: receipt });
  const completion = async (w: string, intent: "artist" | "both" | "listener") => {
    await usersService.saveOnboardingStep(w,{ step: "intent",primaryIntent: intent });
    return usersService.completeOnboarding(w);
  };
  const sessionToken = (w: string) => tokenService.issueSession({ walletAddress: w,email: "",displayName: "",primaryIntent: "listener",artistAccess: false,onboardingStatus: "required",onboardingStep: "identity",onboardingVersion: 1,profileCompletion: { percentage: 0,completed: [],missing: [],requiredComplete: false } });
  const request = (path: string, method = "GET", body?: unknown, token?: string) => fetch(`${base}${path}`,{ method,headers: { "Content-Type": "application/json",...(token ? { Authorization: `Bearer ${token}` } : {}) },body: body ? JSON.stringify(body) : undefined });
  try {
    await databaseService.initialize({ repair: false });
    await welcome(inviterWallet); await completion(inviterWallet,"artist");
    const code = (await referralsService.mine(inviterWallet)).code!;
    const capture = () => referralsService.capture({ code });
    await t.test("new artist binds through authenticated onboarding and qualifies exactly once",async () => {
      const w = wallet(); const invitation = await capture();
      const response = await request("/users/me/onboarding","PUT",{ step: "identity",displayName: "Invited artist",referralReceipt: invitation.receipt },sessionToken(w));
      assert.equal(response.status,200);
      await completion(w,"artist"); await usersService.completeOnboarding(w);
      const mine = await referralsService.mine(inviterWallet);
      assert.deepEqual(mine.totals,{ started: 1,completed: 1,artists: 1 });
      assert.ok(!JSON.stringify(mine).includes(w)); assert.ok(!JSON.stringify(mine).includes("Invited artist"));
      assert.equal(mine.rewardsEnabled,false);
      const events = (await referralsService.adminList()).items[0]!.events;
      assert.deepEqual(events.map((e: { action: string }) => e.action),["attributed","registration_completed","artist_registration_completed"]);
      await assert.rejects(databaseService.transaction(c => c.query("UPDATE referral_events SET action='changed' WHERE id=$1",[events[0]!.id])), /append only/);
    });
    await t.test("concurrent first requests retain one profile and immutable attribution",async () => {
      const w = wallet(); const invitation = await capture();
      const profiles = await Promise.all([welcome(w,invitation.receipt),welcome(w,invitation.receipt)]);
      assert.equal(profiles[0]!.id,profiles[1]!.id);
      assert.equal((await referralsService.mine(inviterWallet)).totals.started,2);
      const rows = await databaseService.transaction(c => c.query("SELECT * FROM referrals WHERE invitee_id=$1",[profiles[0]!.id]));
      assert.equal(rows.rowCount,1);
      await assert.rejects(databaseService.transaction(c => c.query("UPDATE referrals SET campaign='changed' WHERE id=$1",[rows.rows[0].id])), /immutable/);
      await completion(w,"both");
    });
    await t.test("listener completion and later artist intent count once",async () => {
      const w = wallet(); await welcome(w,(await capture()).receipt); await completion(w,"listener");
      let mine = await referralsService.mine(inviterWallet); assert.equal(mine.totals.completed,3); assert.equal(mine.totals.artists,2);
      await usersService.upsertProfile(w,{ primaryIntent: "artist" });
      await usersService.upsertProfile(w,{ primaryIntent: "listener" }); await usersService.upsertProfile(w,{ primaryIntent: "both" });
      mine = await referralsService.mine(inviterWallet); assert.equal(mine.totals.artists,3);
    });
    await t.test("existing profile cannot gain attribution; ordinary signup still works",async () => {
      const w = wallet(); await welcome(w); await welcome(w,(await capture()).receipt); await completion(w,"artist");
      assert.equal((await referralsService.mine(inviterWallet)).totals.started,3);
    });
    await t.test("invalid attribution rolls profile creation back; retry can register normally",async () => {
      const w = wallet(); await assert.rejects(welcome(w,"forged"),/invalid or expired/);
      assert.equal(await usersRepository.findByWallet(w),undefined);
      await welcome(w,(await capture()).receipt);
    });
    await t.test("self-referral is rejected inside the binding transaction",async () => {
      const invitation = await capture();
      const { bindReferral } = await import("./referrals.service.js");
      const user = (await usersRepository.findByWallet(inviterWallet))!;
      await assert.rejects(databaseService.transaction(c => bindReferral(c,user,invitation.receipt)),/refer yourself/);
    });
    await t.test("paused capture preserves old invitations and qualification; exclusions reconcile totals",async () => {
      const invitation = await capture(); env.REFERRALS_ENABLED = false;
      await assert.rejects(capture(),/paused/);
      const w = wallet(); await welcome(w,invitation.receipt); await completion(w,"artist");
      const user = (await usersRepository.findByWallet(w))!;
      const row = (await referralsService.adminList()).items.find(r => r.invitee_id === user.id)!;
      await referralsService.exclude(row.id,"admin:test",{ reason: "Internal test exclusion" });
      await assert.rejects(referralsService.exclude(row.id,"admin:test",{ reason: "Repeat exclusion" }),/already excluded/);
      await referralsService.reconcile();
      assert.equal((await referralsService.mine(inviterWallet)).totals.started,4);
      env.REFERRALS_ENABLED = true;
    });
    await t.test("paid activation excludes waivers and unrelated products and survives confirmation retries",async () => {
      const { paymentsRepository } = await import("../payments/payments.repository.js");
      const { paymentsService } = await import("../payments/payments.service.js");
      const w = wallet(); await welcome(w,(await capture()).receipt); await completion(w,"artist");
      const id = randomUUID(), timestamp = new Date().toISOString();
      const intent = { id,walletAddress: w,productType: "artist_onboarding_fee" as const,amount: "20",assetCode: "XLM",destinationAddress: w,memo: "test",status: "confirmed" as const,txHash: id,expiresAt: timestamp,createdAt: timestamp,updatedAt: timestamp };
      const payment = { id: randomUUID(),intentId: id,walletAddress: w,productType: intent.productType,amount: "20",assetCode: "XLM",networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,txHash: id,status: "confirmed" as const,confirmedAt: timestamp,createdAt: timestamp };
      await paymentsRepository.upsertIntent(intent); await paymentsRepository.upsertPayment(payment);
      for (const candidate of [{ ...payment,amount: "0" },{ ...payment,waived: true },{ ...payment,productType: "track_purchase" as const }]) await referralsService.recordPaidActivation(candidate);
      const user = (await usersRepository.findByWallet(w))!;
      const read = async () => (await referralsService.adminList()).items.find(r => r.invitee_id === user.id)!;
      assert.equal((await read()).paid_activation,null);
      await paymentsService.confirm(w,{ intentId: id,txHash: id });
      await paymentsService.confirm(w,{ intentId: id,txHash: id });
      await referralsService.reconcilePayments();
      const row = await read(); assert.equal(row.paid_activation.payment_id,payment.id);
      assert.equal(row.paid_activation.network_passphrase,env.STELLAR_NETWORK_PASSPHRASE);
      assert.equal(row.events.filter((e: { action: string }) => e.action === "paid_artist_activation").length,1);
      assert.equal((await referralsService.mine(inviterWallet)).rewardsEnabled,false);
    });
    await t.test("routes require sessions and admin role; users cannot read another inviter",async () => {
      assert.equal((await request("/referrals/me")).status,401);
      assert.equal((await request("/admin/referrals")).status,401);
      assert.equal((await request("/admin/referrals","GET",undefined,sessionToken(inviterWallet))).status,401);
      const other = wallet(); await welcome(other); await completion(other,"listener");
      const response = await request("/referrals/me","GET",undefined,sessionToken(other));
      assert.equal(response.status,200); assert.equal(((await response.json()) as { items: unknown[] }).items.length,0);
      const token = tokenService.issueAdminSession({ adminId: randomUUID(),email: "review@example.com",name: "Reviewer",role: "admin" });
      assert.equal((await request("/admin/referrals","GET",undefined,token)).status,200);
      assert.equal((await request("/admin/referrals/reconcile","POST",{},token)).status,403);
    });
    await t.test("invalid code and ineligible inviter fail without creating attribution",async () => {
      await assert.rejects(referralsService.capture({ code: "MC0000000000000000" }),/not found/);
      const unfinished = wallet(); await welcome(unfinished);
      await assert.rejects(referralsService.mine(unfinished),/Complete your registration/);
      await databaseService.transaction(c => c.query("UPDATE referral_campaigns SET active=FALSE WHERE version='registration-v1'"));
      try {
        await assert.rejects(capture(),/not found/);
        assert.equal((await referralsService.mine(inviterWallet)).enabled,false);
      } finally {
        await databaseService.transaction(c => c.query("UPDATE referral_campaigns SET active=TRUE WHERE version='registration-v1'"));
      }
    });
  } finally {
    await new Promise<void>((resolve,reject) => server.close(e => e ? reject(e) : resolve()));
    await databaseService.close();
  }
});
