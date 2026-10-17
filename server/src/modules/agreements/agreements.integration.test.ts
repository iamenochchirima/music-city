import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";

const testUrl = process.env.AGREEMENTS_TEST_DATABASE_URL;

test("PostgreSQL contributor agreement workflow", { skip: !testUrl }, async t => {
  const url = new URL(testUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.endsWith("_test"), "Use an isolated local database ending in _test");
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = "test";
  const { databaseService } = await import("../../services/database.service.js");
  const { agreementsService } = await import("./agreements.service.js");
  const a = Keypair.random(), b = Keypair.random(), outsider = Keypair.random();
  const ownerId = randomUUID();
  try {
    await databaseService.initialize({ repair: false });
    await databaseService.transaction(async client => {
      for (const [key,id] of [[a,ownerId],[b,randomUUID()],[outsider,randomUUID()]] as const) {
        await client.query("INSERT INTO users(id,wallet_address,primary_intent,payload) VALUES($1,$2,'artist',$3)", [id,key.publicKey(),{}]);
      }
    });
    const terms = { recipients: [{ walletAddress: a.publicKey(), role: "artist", shareBps: 7000 }, { walletAddress: b.publicKey(), role: "producer", shareBps: 3000 }], terms: "Master split" };
    async function create(input = terms) {
      const trackId = randomUUID();
      await databaseService.transaction(async client => { await client.query("INSERT INTO tracks(id,artist_id,status,visibility,payload) VALUES($1,$2,'draft','unpublished',$3)", [trackId,ownerId,{}]); });
      return agreementsService.create(a.publicKey(),{ trackId,...input });
    }
    function sign(xdr: string, key: Keypair) {
      const tx = TransactionBuilder.fromXDR(xdr,Networks.TESTNET); tx.sign(key); return tx.toXDR();
    }
    await t.test("draft creation validates total and leaves no partial agreement", async () => {
      const before = await agreementsService.list(a.publicKey());
      await assert.rejects(create({ ...terms, recipients: terms.recipients.map(r => ({ ...r,shareBps: 1 })) }));
      assert.equal((await agreementsService.list(a.publicKey())).length,before.length);
    });
    await t.test("unknown contributor FK rolls back the complete draft and audit event", async () => {
      const before = await agreementsService.list(a.publicKey());
      await assert.rejects(create({ ...terms, recipients: [{ ...terms.recipients[0]!,walletAddress: Keypair.random().publicKey() },terms.recipients[1]!] }));
      assert.equal((await agreementsService.list(a.publicKey())).length,before.length);
    });
    await t.test("only owner edits or submits, draft edit replaces contributor membership", async () => {
      const v = await create(), id = v.proposal.agreementId;
      await assert.rejects(agreementsService.edit(id,b.publicKey(),terms));
      await assert.rejects(agreementsService.submit(id,b.publicKey()));
      await agreementsService.edit(id,a.publicKey(),{ recipients: [{ walletAddress: a.publicKey(), role: "artist",shareBps: 10000 }], terms: "Solo" });
      await assert.rejects(agreementsService.get(id,b.publicKey()));
      await agreementsService.submit(id,a.publicKey());
      await assert.rejects(agreementsService.edit(id,a.publicKey(),terms));
    });
    await t.test("two concurrent identical responses produce one response and event", async () => {
      const v = await create(), id = v.proposal.agreementId;
      await agreementsService.submit(id,a.publicKey());
      const c = await agreementsService.challenge(id,a.publicKey(),{ action: "accept" });
      const request = { challengeId: c.id,signedTransaction: sign(c.transaction,a) };
      await Promise.all([agreementsService.respond(id,a.publicKey(),request),agreementsService.respond(id,a.publicKey(),request)]);
      const record = await agreementsService.get(id,a.publicKey());
      assert.equal(record.versions[0]!.responses.length,1);
      assert.equal(record.events.filter(e => e.action === "accept").length,1);
    });
    await t.test("independent concurrent contributor responses reach ready without losing consent", async () => {
      const v = await create(), id = v.proposal.agreementId;
      await agreementsService.submit(id,a.publicKey());
      const ca = await agreementsService.challenge(id,a.publicKey(),{ action: "accept" });
      const cb = await agreementsService.challenge(id,b.publicKey(),{ action: "accept" });
      await Promise.all([
        agreementsService.respond(id,a.publicKey(),{ challengeId: ca.id,signedTransaction: sign(ca.transaction,a) }),
        agreementsService.respond(id,b.publicKey(),{ challengeId: cb.id,signedTransaction: sign(cb.transaction,b) }),
      ]);
      const current = (await agreementsService.get(id,a.publicKey())).versions[0]!;
      assert.equal(current.state,"ready"); assert.equal(current.responses.length,2);
    });
    await t.test("invalid signature rolls back and does not consume challenge", async () => {
      const v = await create(), id = v.proposal.agreementId;
      await agreementsService.submit(id,a.publicKey());
      const c = await agreementsService.challenge(id,a.publicKey(),{ action: "accept" });
      await assert.rejects(agreementsService.respond(id,a.publicKey(),{ challengeId: c.id,signedTransaction: sign(c.transaction,outsider) }));
      const state = await databaseService.transaction(client => client.query("SELECT consumed_at FROM agreement_challenges WHERE id=$1",[c.id]));
      assert.equal(state.rows[0].consumed_at,null);
      await agreementsService.respond(id,a.publicKey(),{ challengeId: c.id,signedTransaction: sign(c.transaction,a) });
    });
    await t.test("database audit failure rolls back consent, readiness and challenge consumption", async () => {
      const v = await create(), id = v.proposal.agreementId;
      await agreementsService.submit(id,a.publicKey());
      const ca = await agreementsService.challenge(id,a.publicKey(),{ action: "accept" });
      await agreementsService.respond(id,a.publicKey(),{ challengeId: ca.id,signedTransaction: sign(ca.transaction,a) });
      const cb = await agreementsService.challenge(id,b.publicKey(),{ action: "accept" });
      const before = await agreementsService.get(id,a.publicKey());
      // Inject a real PostgreSQL failure after response insertion, readiness and
      // challenge consumption, at the final audit write in the same transaction.
      await databaseService.transaction(async client => {
        await client.query("CREATE FUNCTION agreement_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected audit failure'; END $$");
        assert.match(id,/^[a-f0-9-]+$/);
        await client.query(`CREATE TRIGGER agreement_test_fail_audit BEFORE INSERT ON agreement_events FOR EACH ROW WHEN (NEW.agreement_id='${id}') EXECUTE FUNCTION agreement_test_fail_audit()`);
      });
      const request = { challengeId: cb.id,signedTransaction: sign(cb.transaction,b) };
      try {
        await assert.rejects(agreementsService.respond(id,b.publicKey(),request),/Injected audit failure/);
        assert.deepEqual(await agreementsService.get(id,a.publicKey()),before);
        await databaseService.transaction(async client => {
          assert.equal((await client.query("SELECT consumed_at FROM agreement_challenges WHERE id=$1",[cb.id])).rows[0].consumed_at,null);
          assert.equal((await client.query("SELECT 1 FROM agreement_responses WHERE challenge_id=$1",[cb.id])).rowCount,0);
        });
      } finally {
        await databaseService.transaction(async client => {
          await client.query("DROP TRIGGER agreement_test_fail_audit ON agreement_events");
          await client.query("DROP FUNCTION agreement_test_fail_audit()");
        });
      }
      assert.equal((await agreementsService.respond(id,b.publicKey(),request)).state,"ready");
    });
    await t.test("database rejects submitted payload mutation and evidence update/deletion", async () => {
      const v = await create(), id = v.proposal.agreementId;
      await agreementsService.submit(id,a.publicKey());
      await assert.rejects(databaseService.transaction(client => client.query("UPDATE agreement_versions SET payload=jsonb_set(payload,'{proposal,terms}','\"Forged\"') WHERE agreement_id=$1",[id])));
      await assert.rejects(databaseService.transaction(client => client.query("DELETE FROM agreement_events WHERE agreement_id=$1",[id])));
    });
    await t.test("rejection blocks consent; revision preserves evidence and collects fresh consent", async () => {
      const v = await create(), id = v.proposal.agreementId;
      await agreementsService.submit(id,a.publicKey());
      const c = await agreementsService.challenge(id,b.publicKey(),{ action: "reject",reason: "Change the terms" });
      await agreementsService.respond(id,b.publicKey(),{ challengeId: c.id,signedTransaction: sign(c.transaction,b) });
      await assert.rejects(agreementsService.challenge(id,a.publicKey(),{ action: "accept" }));
      const next = await agreementsService.revise(id,a.publicKey(),{ ...terms,terms: "Updated terms",resolution: "Corrected terms following rejection" });
      assert.equal(next.proposal.version,2); assert.equal(next.responses.length,0);
      const record = await agreementsService.get(id,b.publicKey());
      assert.equal(record.versions[0]!.state,"rejected"); assert.equal(record.versions[0]!.responses.length,1);
      assert.equal(record.effectiveVersion,null);
      await assert.rejects(agreementsService.get(id,outsider.publicKey()));
    });
    await t.test("removed contributors retain only their submitted versions and authorized context",async()=>{
      const v=await create(),id=v.proposal.agreementId;
      await assert.rejects(agreementsService.get(id,b.publicKey()),/not been sent/);
      assert.equal((await agreementsService.list(b.publicKey())).some(x=>x.id===id),false);
      await agreementsService.submit(id,a.publicKey());
      const c=await agreementsService.challenge(id,b.publicKey(),{action:"reject",reason:"Revise attribution"});
      await agreementsService.respond(id,b.publicKey(),{challengeId:c.id,signedTransaction:sign(c.transaction,b)});
      await agreementsService.revise(id,a.publicKey(),{recipients:[{walletAddress:a.publicKey(),role:"artist",shareBps:8000},{walletAddress:outsider.publicKey(),role:"producer",shareBps:2000}],terms:"New private terms",resolution:"Contributor removed"},1);
      await assert.rejects(agreementsService.submit(id,a.publicKey(),1),/agreement changed/);
      await agreementsService.submit(id,a.publicKey(),2);
      const old=await agreementsService.get(id,b.publicKey());
      assert.equal(old.currentVersion,1); assert.equal(old.versions.length,1);
      assert.ok(!JSON.stringify(old).includes("New private terms"));
      assert.equal(old.permissions.accept,false);assert.equal(old.permissions.revise,false);
      assert.equal(old.context.track.title,"Untitled recording");
      const summary=(await agreementsService.list(b.publicKey())).find(x=>x.id===id)!;
      assert.equal(summary.current.proposal.version,1);
      assert.equal((await agreementsService.get(id,outsider.publicKey())).currentVersion,2);
    });
    await t.test("same draft preparation and submission retries preserve a single agreement and audit event",async()=>{
      const v=await create(),id=v.proposal.agreementId;
      const retry=await agreementsService.create(a.publicKey(),{trackId:v.proposal.trackId,...terms});
      assert.equal(retry.proposal.agreementId,id);
      await agreementsService.submit(id,a.publicKey(),1);
      await agreementsService.submit(id,a.publicKey(),1);
      assert.equal((await agreementsService.get(id,a.publicKey())).events.filter(e=>e.action==='proposed').length,1);
    });
    await t.test("cancelled unsent drafts stay private but cancelled sent versions remain in participant history",async()=>{
      const unsent=await create(),id=unsent.proposal.agreementId;
      await agreementsService.cancel(id,a.publicKey());
      await assert.rejects(agreementsService.get(id,b.publicKey()),/not been sent/);
      assert.equal((await agreementsService.list(b.publicKey())).some(x=>x.id===id),false);
      const sent=await create(),sentId=sent.proposal.agreementId;
      await agreementsService.submit(sentId,a.publicKey());
      await agreementsService.cancel(sentId,a.publicKey());
      assert.equal((await agreementsService.get(sentId,b.publicKey())).versions[0]!.state,'cancelled');
    });
    await t.test("draft hash preconditions reject stale edits and stale submission within the same version",async()=>{
      const v=await create(),id=v.proposal.agreementId;
      const changed=await agreementsService.edit(id,a.publicKey(),{...terms,terms:'Reviewed new terms'},1,v.proposalHash);
      assert.notEqual(changed.proposalHash,v.proposalHash);
      await assert.rejects(agreementsService.edit(id,a.publicKey(),terms,1,v.proposalHash),/draft changed/);
      await assert.rejects(agreementsService.submit(id,a.publicKey(),1,v.proposalHash),/draft changed/);
      await agreementsService.submit(id,a.publicKey(),1,changed.proposalHash);
    });
    await t.test("a release-bound track snapshots its owned release into the signed proposal", async () => {
      const trackId = randomUUID(), releaseId = randomUUID();
      await databaseService.transaction(async client => {
        await client.query("INSERT INTO tracks(id,artist_id,status,visibility,payload) VALUES($1,$2,'draft','unpublished',$3)",[trackId,ownerId,{}]);
        await client.query("INSERT INTO releases(id,artist_id,type,status,payload) VALUES($1,$2,'single','draft',$3)",[releaseId,ownerId,{}]);
        await client.query("INSERT INTO release_tracks(release_id,track_id,track_number) VALUES($1,$2,1)",[releaseId,trackId]);
      });
      const version = await agreementsService.create(a.publicKey(),{ trackId,...terms });
      assert.equal(version.proposal.releaseId,releaseId);
      const submitted = await agreementsService.submit(version.proposal.agreementId,a.publicKey());
      assert.equal(submitted.proposal.releaseId,releaseId);
      assert.equal(submitted.proposalHash,version.proposalHash);
    });
  } finally { await databaseService.close(); }
});
