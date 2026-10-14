import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { releaseTrackMetadataSchema, type ReleaseDetail, type ReleaseSummary, type TrackSummary } from "@music-city/shared";
import { Keypair } from "@stellar/stellar-sdk";

const url = process.env.TRACK_METADATA_TEST_DATABASE_URL;
test("PostgreSQL track metadata batches and one-time migration", { skip: !url }, async t => {
  const parsed = new URL(url!);
  assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname) && parsed.pathname.endsWith("_test"), "Use an isolated local database ending in _test");
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = "test";
  const { databaseService: db } = await import("../../services/database.service.js");
  const { migrateTrackMetadata } = await import("../../scripts/migrate-track-metadata.js");
  const owner = randomUUID(), other = randomUUID(), release = randomUUID();
  const ids = [randomUUID(), randomUUID()].sort();
  const outsider = randomUUID(), unassigned = randomUUID();
  const fixture = (id: string, artistId = owner, recordLabel?: string): TrackSummary => ({
    id, artistId, artistName: "Artist", title: id, genre: "Pop", runtime: "1:00", status: "published", visibility: "published", priceLabel: "Published", plays: 3, likes: 1,
    isrc: "USRC17607839", credits: [{ role: "composer", name: "Composer" }], recordLabel, playbackReady: true,
  });
  const read = (id: string) => db.findPayloadById<TrackSummary>("tracks", id);
  const apply = (trackIds: string[], expectedLabels: Record<string, string>, overwrite = false, recordLabel = "New Label", artistId = owner) =>
    db.applyReleaseTrackMetadata(artistId, release, releaseTrackMetadataSchema.parse({ trackIds, expectedLabels, overwrite, recordLabel }));
  try {
    await db.initialize({ repair: false });
    await db.transaction(async client => {
      for (const id of [owner, other]) await client.query("INSERT INTO users(id,wallet_address,primary_intent,payload) VALUES($1,$2,'artist','{}')", [id, Keypair.random().publicKey()]);
      await client.query("INSERT INTO releases(id,artist_id,type,status,payload) VALUES($1,$2,'ep','draft',$3)", [release, owner, { recordLabel: "Release Label" }]);
      for (const track of [fixture(ids[0]!), fixture(ids[1]!, owner, "Existing Label"), fixture(outsider, other), fixture(unassigned)]) {
        await client.query("INSERT INTO tracks(id,artist_id,status,visibility,payload) VALUES($1,$2,'published','published',$3)", [track.id, track.artistId, track]);
      }
      for (const [index, id] of [...ids, outsider].entries()) await client.query("INSERT INTO release_tracks(release_id,track_id,track_number) VALUES($1,$2,$3)", [release, id, index + 1]);
    });
    await t.test("selected blank labels persist while credits and identifiers remain independent", async () => {
      const before = await read(ids[0]!);
      const changed = await apply([ids[0]!], { [ids[0]!]: "" });
      assert.equal(changed[0]?.recordLabel, "New Label");
      assert.deepEqual(changed[0]?.credits, before?.credits);
      assert.equal(changed[0]?.isrc, before?.isrc);
      assert.equal(changed[0]?.status, "published");
      assert.equal((await read(ids[1]!))?.recordLabel, "Existing Label");
    });
    await t.test("existing labels require explicit overwrite and stale previews fail", async () => {
      await assert.rejects(apply(ids, { [ids[0]!]: "New Label", [ids[1]!]: "Existing Label" }), /overwrite/);
      await assert.rejects(apply(ids, { [ids[0]!]: "New Label", [ids[1]!]: "stale" }, true), /changed/);
      assert.equal((await read(ids[0]!))?.recordLabel, "New Label");
      await apply([ids[1]!], { [ids[1]!]: "Existing Label" }, true);
      assert.equal((await read(ids[1]!))?.recordLabel, "New Label");
    });
    await t.test("partial metadata writes preserve concurrent label changes and support explicit clears", async () => {
      await Promise.all([
        db.updateTrackMetadata(ids[0]!, owner, { credits: [{ role: "engineer", name: "Engineer" }], updatedAt: new Date().toISOString() }),
        apply([ids[0]!], { [ids[0]!]: "New Label" }, true, "Concurrent Label"),
      ]);
      const current = await read(ids[0]!);
      assert.equal(current?.recordLabel, "Concurrent Label");
      assert.deepEqual(current?.credits, [{ role: "engineer", name: "Engineer" }]);
      assert.equal(current?.status, "published");
      assert.equal(current?.isrc, "USRC17607839");
      const cleared = await db.updateTrackMetadata(unassigned, owner, { credits: [], isrc: undefined, recordLabel: undefined, updatedAt: new Date().toISOString() });
      assert.deepEqual(cleared?.credits, []);
      assert.equal(cleared?.isrc, undefined);
      assert.equal(cleared?.status, "published");
      assert.equal(await db.updateTrackMetadata(unassigned, other, { recordLabel: "Unauthorized", updatedAt: new Date().toISOString() }), null);
      await db.updateTrackMetadata(ids[0]!, owner, { recordLabel: "New Label", updatedAt: new Date().toISOString() });
    });
    await t.test("wrong ownership or membership rejects the whole batch", async () => {
      await assert.rejects(apply([ids[0]!, outsider], { [ids[0]!]: "New Label", [outsider]: "" }, true), /Track not found/);
      await assert.rejects(apply([ids[0]!, unassigned], { [ids[0]!]: "New Label", [unassigned]: "" }, true), /belong to this release/);
      await assert.rejects(apply([ids[0]!], { [ids[0]!]: "New Label" }, true, "Other", other), /Release not found/);
      assert.equal((await read(ids[0]!))?.recordLabel, "New Label");
    });
    await t.test("concurrent previews produce one write and one stale-preview failure", async () => {
      const outcomes = await Promise.allSettled([apply([ids[0]!], { [ids[0]!]: "New Label" }, true, "First"), apply([ids[0]!], { [ids[0]!]: "New Label" }, true, "Second")]);
      assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
      assert.equal(outcomes.filter(result => result.status === "rejected").length, 1);
    });
    await t.test("database failure rolls back every selected label", async () => {
      const before = await Promise.all(ids.map(id => read(id)));
      const name = `reject_label_${owner.replaceAll("-", "")}`;
      await db.transaction(async client => {
        await client.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${ids[1]}' THEN RAISE EXCEPTION 'injected label failure'; END IF; RETURN NEW; END $$`);
        await client.query(`CREATE TRIGGER ${name} BEFORE UPDATE ON tracks FOR EACH ROW EXECUTE FUNCTION ${name}()`);
      });
      try {
        await assert.rejects(apply(ids, Object.fromEntries(before.map(track => [track!.id, track!.recordLabel!])), true, "Failed Label"), /injected label failure/);
        assert.deepEqual(await Promise.all(ids.map(id => read(id))), before);
      } finally { await db.transaction(async client => { await client.query(`DROP TRIGGER ${name} ON tracks`); await client.query(`DROP FUNCTION ${name}()`); }); }
    });
    await t.test("release label edits do not implicitly rewrite track labels", async () => {
      const before = await read(ids[1]!);
      await db.transaction(client => client.query("UPDATE releases SET payload = payload || '{\"recordLabel\":\"Changed Release Label\"}' WHERE id=$1", [release]));
      assert.equal((await read(ids[1]!))?.recordLabel, before?.recordLabel);
    });
    await t.test("migration supports dry-run, preserves explicit labels and malformed identifiers, and is idempotent", async () => {
      await db.transaction(async client => {
        await client.query("UPDATE tracks SET payload = (payload - 'recordLabel') || '{\"isrc\":\"us-rc1-76-07839\"}' WHERE id=$1", [ids[0]]);
        await client.query("UPDATE tracks SET payload = payload || '{\"isrc\":\"malformed\"}' WHERE id=$1", [outsider]);
      });
      const run = async (applyMigration: boolean, migrationName?: string) => {
        // Migration controls its own transaction; use a dedicated client rather than nest transactions.
        const { Pool } = await import("pg"); const pool = new Pool({ connectionString: url }); const client = await pool.connect();
        try { return await migrateTrackMetadata(client, applyMigration, migrationName); } finally { client.release(); await pool.end(); }
      };
      const preview = await run(false);
      assert.ok(preview.labelsCopied >= 1);
      assert.equal((await read(ids[0]!))?.recordLabel, undefined);
      const report = await run(true);
      assert.ok(report.invalidIdentifiers.includes(outsider));
      assert.ok(report.skippedLabels.includes(outsider));
      assert.equal((await read(ids[0]!))?.recordLabel, "Changed Release Label");
      assert.equal((await read(ids[0]!))?.isrc, "USRC17607839");
      assert.equal((await read(ids[1]!))?.recordLabel, "New Label");
      assert.equal((await read(outsider))?.isrc, "malformed");
      const repeated = await run(true);
      assert.equal(repeated.labelsCopied, 0); assert.equal(repeated.identifiersNormalized, 0);
      const receiptName=`test-track-metadata-${owner}`;
      await run(true,receiptName);
      await db.transaction(client => client.query("UPDATE tracks SET payload=payload-'recordLabel' WHERE id=$1",[ids[0]]));
      const skipped=await run(true,receiptName);
      assert.ok('alreadyApplied' in skipped && skipped.alreadyApplied);
      assert.equal((await read(ids[0]!))?.recordLabel,undefined,"Recorded migration must not refill an intentionally cleared label on a later deploy");
      await db.transaction(client => client.query("DELETE FROM schema_migrations WHERE name=$1",[receiptName]));
    });
    await t.test("release revisions preserve live track membership and apply atomically", async () => {
      const rid=randomUUID(),first=randomUUID(),second=randomUUID();
      const original: ReleaseDetail={id:rid,artistId:owner,artistName:"Artist",title:"Live Single",type:"single",status:"published",genre:"Pop",trackCount:1,updatedAt:new Date().toISOString(),tracks:[{trackId:first,trackNumber:1,discNumber:1,isFocusTrack:false,track:fixture(first)}]};
      for (const id of [first,second]) {const track=fixture(id);await db.upsertTrack(id,owner,track.status,track.visibility ?? "published",null,track);}
      await db.upsertRelease(rid,owner,"single","published",null,original);
      await db.transaction(c=>c.query("INSERT INTO release_tracks(release_id,track_id,track_number,disc_number,is_focus_track) VALUES($1,$2,1,1,false)",[rid,first]));
      await assert.rejects(db.beginReleaseRevision(rid,other,original),/not found/);
      const revision=await db.beginReleaseRevision(rid,owner,original);
      assert.equal((await db.beginReleaseRevision(rid,owner,original)).liveVersion.title,"Live Single");
      await db.removeTrackFromRelease(rid,first);
      await db.assignTrackToRelease(rid,second,1,1,false);
      assert.ok((await db.listPublicTrackIds()).includes(first));
      assert.ok(!(await db.listPublicTrackIds()).includes(second));
      assert.ok((await db.listLiveTrackSnapshots()).some(track => track.id===first));
      await assert.rejects(db.deleteTrack(first),/live release revision/);
      const assignments=await db.listReleaseTracks(rid);
      const {tracks:_tracks,...summary}=original;
      const next: ReleaseSummary={...summary,title:"Updated Single",updatedAt:new Date().toISOString()};
      await assert.rejects(db.commitReleaseRevision(owner,"stale",next,assignments),/changed/);
      const trigger=`reject_revision_${rid.replaceAll("-","")}`;
      await db.transaction(async client => {await client.query(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${rid}' AND NOT (NEW.payload ? 'liveVersion') THEN RAISE EXCEPTION 'injected revision failure'; END IF; RETURN NEW; END $$`);await client.query(`CREATE TRIGGER ${trigger} BEFORE UPDATE ON releases FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);});
      try {
        await assert.rejects(db.commitReleaseRevision(owner,revision.updatedAt,next,assignments),/injected revision failure/);
        assert.ok((await db.listPublicTrackIds()).includes(first));
        assert.equal((await read(first))?.visibility,"published");
      } finally {await db.transaction(async client => {await client.query(`DROP TRIGGER ${trigger} ON releases`);await client.query(`DROP FUNCTION ${trigger}()`);});}
      await db.commitReleaseRevision(owner,revision.updatedAt,next,assignments);
      assert.ok(!(await db.listPublicTrackIds()).includes(first));assert.ok((await db.listPublicTrackIds()).includes(second));
      assert.equal((await read(first))?.visibility,"unpublished");assert.equal((await read(second))?.visibility,"published");
    });
  } finally {
    await db.transaction(client => client.query("DELETE FROM users WHERE id=ANY($1::text[])", [[owner, other]]));
    await db.close();
  }
});
