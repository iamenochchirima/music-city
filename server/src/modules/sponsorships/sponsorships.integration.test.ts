import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import express from "express";

const testUrl = process.env.REFERRALS_TEST_DATABASE_URL;

test("early-user artist sponsorship through PostgreSQL and HTTP", { skip: !testUrl }, async (t) => {
  const url = new URL(testUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.endsWith("_test"), "Use an isolated local database ending in _test");
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = "test";
  process.env.REFERRALS_ENABLED = "true";
  process.env.ARTIST_ONBOARDING_FEE_PRICE = "0";
  const { databaseService } = await import("../../services/database.service.js");
  const { usersService } = await import("../users/users.service.js");
  const { usersRepository } = await import("../users/users.repository.js");
  const { sponsorshipsService } = await import("./sponsorships.service.js");
  const { referralsService } = await import("../referrals/referrals.service.js");
  const { sponsorshipsRouter, adminSponsorshipsRouter } = await import("./sponsorships.router.js");
  const { paymentsRouter } = await import("../payments/payments.router.js");
  const { tokenService } = await import("../../services/token.service.js");
  const { errorHandler } = await import("../../middleware/error-handler.js");
  const app = express();
  app.use(express.json());
  app.use("/sponsorships", sponsorshipsRouter);
  app.use("/admin/sponsorships", adminSponsorshipsRouter);
  app.use("/payments", paymentsRouter);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const wallet = () => Keypair.random().publicKey();
  const session = (w: string) => tokenService.issueSession({ walletAddress: w,email: "",displayName: "",primaryIntent: "listener",artistAccess: false,onboardingStatus: "required",onboardingStep: "identity",onboardingVersion: 1,profileCompletion: { percentage: 0,completed: [],missing: [],requiredComplete: false } });
  const request = (path: string, method = "GET", body?: unknown, bearer?: string) => fetch(`${base}${path}`, { method,headers: { "Content-Type": "application/json",...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },body: body === undefined ? undefined : JSON.stringify(body) });
  const welcome = (w: string, referralReceipt?: string) => usersService.saveOnboardingStep(w,{ step: "identity",displayName: "Early artist",referralReceipt });
  const complete = async (w: string, intent: "artist" | "both" | "listener") => {
    await usersService.saveOnboardingStep(w,{ step: "intent",primaryIntent: intent });
    await usersService.completeOnboarding(w);
  };
  const counts = async (w: string) => databaseService.transaction(async client => {
    const row = (await client.query<{ intents: string; payments: string; activations: string }>(
      `SELECT (SELECT COUNT(*) FROM payment_intents WHERE wallet_address=$1 AND product_type='artist_onboarding_fee')::text AS intents,
        (SELECT COUNT(*) FROM payments WHERE wallet_address=$1 AND product_type='artist_onboarding_fee')::text AS payments,
        (SELECT COUNT(*) FROM referral_paid_activations a JOIN referrals r ON r.id=a.referral_id JOIN users u ON u.id=r.invitee_id WHERE u.wallet_address=$1)::text AS activations`,[w])).rows[0]!;
    return { intents: Number(row.intents),payments: Number(row.payments),activations: Number(row.activations) };
  });

  try {
    await databaseService.initialize({ repair: false });
    const schemaHealth = await databaseService.inspectSchemaHealth();
    const sponsorshipSchema = schemaHealth.groups.find(group => group.name === "2026-10-09-early-user-sponsorship");
    assert.ok(sponsorshipSchema && sponsorshipSchema.missingRelations.length === 0 && sponsorshipSchema.missingIndexes.length === 0,"sponsorship tables and indexes are registered in schema health");
    await databaseService.transaction(client => client.query("UPDATE artist_sponsorship_campaigns SET active=TRUE WHERE code='EARLYUSER'"));

    const inviter = wallet();
    await welcome(inviter);
    await complete(inviter,"artist");
    const invitation = await referralsService.capture({ code: (await referralsService.mine(inviter)).code });

    await t.test("a wallet with no profile cannot start a payment before automatic eligibility capture", async () => {
      const w = wallet();
      const response = await request("/payments/intents/artist-onboarding-fee","POST",{},session(w));
      assert.equal(response.status,409);
      assert.deepEqual(await counts(w),{ intents: 0,payments: 0,activations: 0 });
    });

    await t.test("captures terms once, preserves personal referral, and redeems without payments", async () => {
      const feesWaivedBefore = (await sponsorshipsService.getAdminReport()).campaign.totalFeesWaivedMinor;
      const w = wallet();
      const profile = await welcome(w,invitation.receipt);
      assert.ok(profile);
      const eligible = await sponsorshipsService.getMyActivation(w);
      assert.deepEqual({ status: eligible.status,currency: eligible.currency,original: eligible.originalAmountMinor,discount: eligible.discountAmountMinor,percent: eligible.discountPercent,due: eligible.amountDueMinor },
        { status: "eligible",currency: "USD",original: 2000,discount: 2000,percent: 100,due: 0 });
      assert.equal((await request("/sponsorships/mine","GET",undefined,session(w))).status,200);
      for (let i=0;i<3;i++) await usersService.getProfile(w);
      assert.deepEqual(await counts(w),{ intents: 0,payments: 0,activations: 0 });

      const blocked = await request("/payments/intents/artist-onboarding-fee","POST",{},session(w));
      assert.equal(blocked.status,409,"eligible accounts cannot be charged through the payment API");
      await complete(w,"artist");
      await usersService.completeOnboarding(w);
      const sponsored = await sponsorshipsService.getMyActivation(w);
      assert.equal(sponsored.status,"sponsored");
      assert.equal(sponsored.artistAccess,true);
      assert.equal(sponsored.activatedAt !== null,true);
      const stalePaymentAttempt = await request("/payments/intents/artist-onboarding-fee","POST",{},session(w));
      assert.equal(stalePaymentAttempt.status,409,"a stale client cannot pay after sponsorship is redeemed");
      assert.deepEqual(await counts(w),{ intents: 0,payments: 0,activations: 0 });
      const report = await sponsorshipsService.getAdminReport();
      assert.equal(report.items.find(item => item.id === profile.id)?.status,"sponsored");
      assert.equal(report.campaign.totalFeesWaivedMinor,feesWaivedBefore + 2000);
      assert.equal((await referralsService.adminList()).items.find(row => row.invitee_id === profile.id)?.paid_activation,null);
    });

    await t.test("both-intent completion also receives one sponsored activation", async () => {
      const w = wallet();
      await welcome(w);
      await complete(w,"both");
      await usersService.completeOnboarding(w);
      const activation = await sponsorshipsService.getMyActivation(w);
      assert.equal(activation.status,"sponsored");
      assert.equal(activation.artistAccess,true);
      assert.deepEqual(await counts(w),{ intents: 0,payments: 0,activations: 0 });
    });

    await t.test("first profile creation and eligibility roll back together, including concurrent retries", async () => {
      await databaseService.transaction(async client => {
        await client.query(`CREATE OR REPLACE FUNCTION test_fail_sponsorship_capture() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'test capture failure'; END; $$ LANGUAGE plpgsql`);
        await client.query(`CREATE TRIGGER test_fail_sponsorship_capture AFTER INSERT ON artist_sponsorship_events FOR EACH ROW WHEN (NEW.action='eligibility_captured') EXECUTE FUNCTION test_fail_sponsorship_capture()`);
      });
      const failedWallet = wallet();
      try {
        await assert.rejects(welcome(failedWallet),/test capture failure/);
        assert.ok(!(await usersRepository.findByWallet(failedWallet)));
        const failedRows = await databaseService.transaction(client => client.query("SELECT COUNT(*)::int AS count FROM artist_sponsorship_eligibilities e JOIN users u ON u.id=e.user_id WHERE u.wallet_address=$1",[failedWallet]));
        assert.equal(failedRows.rows[0]!.count,0);
      } finally {
        await databaseService.transaction(async client => {
          await client.query("DROP TRIGGER IF EXISTS test_fail_sponsorship_capture ON artist_sponsorship_events");
          await client.query("DROP FUNCTION IF EXISTS test_fail_sponsorship_capture()");
        });
      }

      const concurrentWallet = wallet();
      const profiles = await Promise.all([welcome(concurrentWallet),welcome(concurrentWallet),welcome(concurrentWallet)]);
      assert.ok(profiles.every(profile => profile));
      assert.equal(new Set(profiles.map(profile => profile!.id)).size,1);
      const eligibilityRows = await databaseService.transaction(client => client.query("SELECT COUNT(*)::int AS count FROM artist_sponsorship_eligibilities WHERE user_id=$1",[profiles[0]!.id]));
      assert.equal(eligibilityRows.rows[0]!.count,1);
    });

    await t.test("captured listeners keep eligibility through pause; new accounts do not", async () => {
      const activatedBefore = (await sponsorshipsService.getAdminReport()).campaign.activatedArtists;
      const listener = wallet();
      await welcome(listener);
      await sponsorshipsService.updateCampaign("admin:test",{ active: false,reason: "Pause for integration test" });
      await complete(listener,"listener");
      await usersService.upsertProfile(listener,{ primaryIntent: "artist" });
      await usersService.upsertProfile(listener,{ primaryIntent: "both" });
      assert.equal((await sponsorshipsService.getMyActivation(listener)).status,"sponsored");
      assert.equal((await sponsorshipsService.getAdminReport()).campaign.activatedArtists,activatedBefore + 1);

      const afterPause = wallet();
      await welcome(afterPause);
      assert.equal((await sponsorshipsService.getMyActivation(afterPause)).status,"payment_required");
      const blocked = await request("/payments/intents/artist-onboarding-fee","POST",{},session(afterPause));
      assert.equal(blocked.status,503,"no USD-to-Stellar price mapping is configured");
      assert.deepEqual(await counts(afterPause),{ intents: 0,payments: 0,activations: 0 });

      await sponsorshipsService.updateCampaign("admin:test",{ active: true,reason: "Resume after integration test" });
      const resumed = wallet();
      await welcome(resumed);
      assert.equal((await sponsorshipsService.getMyActivation(resumed)).status,"eligible");
      assert.equal((await sponsorshipsService.getMyActivation(afterPause)).status,"payment_required");
    });

    await t.test("campaign controls require super admin, a reason, and append audit history", async () => {
      const readerToken = tokenService.issueAdminSession({ adminId: randomUUID(),email: "admin@example.test",name: "Admin",role: "admin" });
      const superToken = tokenService.issueAdminSession({ adminId: randomUUID(),email: "root@example.test",name: "Root",role: "super_admin" });
      assert.equal((await request("/admin/sponsorships","GET",undefined,readerToken)).status,200);
      assert.equal((await request("/admin/sponsorships/campaign","PUT",{ active: false,reason: "Pause" },readerToken)).status,403);
      assert.equal((await request("/admin/sponsorships/campaign","PUT",{ active: false,reason: "x" },superToken)).status,400);
      assert.equal((await request("/admin/sponsorships/campaign","PUT",{ active: false,reason: "Pause campaign test" },superToken)).status,200);
      await databaseService.initialize({ repair: false });
      const report = await sponsorshipsService.getAdminReport();
      assert.equal(report.campaign.active,false);
      assert.ok(report.events.some(event => event.action === "campaign_paused" && event.reason === "Pause campaign test"));
      await sponsorshipsService.updateCampaign("admin:test",{ active: true,reason: "Restore active test state" });
    });

    await t.test("super-admin reconciliation repairs and repeats without duplicate grants", async () => {
      const w = wallet();
      await welcome(w);
      await complete(w,"listener");
      await databaseService.transaction(client => client.query(
        "UPDATE users SET primary_intent='artist',payload=jsonb_set(payload,'{primaryIntent}','\"artist\"'::jsonb) WHERE wallet_address=$1",
        [w],
      ));
      const readerToken = tokenService.issueAdminSession({ adminId: randomUUID(),email: "reader@example.test",name: "Reader",role: "admin" });
      const superToken = tokenService.issueAdminSession({ adminId: randomUUID(),email: "reconcile@example.test",name: "Reconciler",role: "super_admin" });
      assert.equal((await request("/admin/sponsorships/reconcile","POST",{},readerToken)).status,403);
      const first = await request("/admin/sponsorships/reconcile","POST",{},superToken);
      assert.equal(first.status,200);
      assert.deepEqual(await first.json(),{ checked: 1,activated: 1 });
      assert.equal((await sponsorshipsService.getMyActivation(w)).status,"sponsored");
      const second = await request("/admin/sponsorships/reconcile","POST",{},superToken);
      assert.deepEqual(await second.json(),{ checked: 0,activated: 0 });
      assert.deepEqual(await counts(w),{ intents: 0,payments: 0,activations: 0 });
    });

    await t.test("legacy waived records and real payments retain access with honest labels", async () => {
      const { paymentsRepository } = await import("../payments/payments.repository.js");
      await sponsorshipsService.updateCampaign("admin:test",{ active: false,reason: "Create legacy test accounts" });
      const profileGrantWallet = wallet();
      await welcome(profileGrantWallet);
      await complete(profileGrantWallet,"artist");
      await databaseService.transaction(client => client.query(
        "UPDATE users SET payload=jsonb_set(payload,'{artistAccess}','true'::jsonb) WHERE wallet_address=$1",
        [profileGrantWallet],
      ));
      const profileGrant = await sponsorshipsService.getMyActivation(profileGrantWallet);
      assert.equal(profileGrant.status,"legacy_free");
      assert.equal(profileGrant.artistAccess,true);

      const legacyWallet = wallet();
      await welcome(legacyWallet);
      const timestamp = new Date().toISOString();
      const createHistoricRecord = async (w: string,amount: string,waived = false) => {
        const intentId = `history-intent-${randomUUID()}`;
        const txHash = waived ? `waived:history:${randomUUID()}` : `history-tx:${randomUUID()}`;
        const intent = { id: intentId,walletAddress: w,productType: "artist_onboarding_fee" as const,amount,assetCode: "XLM",destinationAddress: w,memo: `artist_onboarding_fee:${intentId}`,status: "confirmed" as const,txHash,expiresAt: timestamp,createdAt: timestamp,updatedAt: timestamp };
        await paymentsRepository.upsertIntent(intent);
        await paymentsRepository.upsertPayment({ id: `history-payment-${randomUUID()}`,intentId,walletAddress: w,productType: intent.productType,txHash,amount,assetCode: "XLM",status: "confirmed",waived,confirmedAt: timestamp,createdAt: timestamp });
      };
      await createHistoricRecord(legacyWallet,"0",true);
      const legacy = await sponsorshipsService.getMyActivation(legacyWallet);
      assert.equal(legacy.status,"legacy_free");
      assert.equal(legacy.artistAccess,true);
      assert.equal(legacy.campaignCode,null);
      assert.equal(legacy.discountAmountMinor,0);

      const paidWallet = wallet();
      await welcome(paidWallet);
      await createHistoricRecord(paidWallet,"0.42");
      const paid = await sponsorshipsService.getMyActivation(paidWallet);
      assert.equal(paid.status,"paid");
      assert.equal(paid.artistAccess,true);
      assert.equal(paid.campaignCode,null);
      await sponsorshipsService.updateCampaign("admin:test",{ active: true,reason: "Restore after legacy test" });
    });
  } finally {
    await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
    await databaseService.close();
  }
});
