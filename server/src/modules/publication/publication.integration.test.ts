import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
const url = process.env.MEDIA_WORKER_TEST_DATABASE_URL;
test("durable media processing and publication", { skip: !url }, async (t) => {
  const parsed = new URL(url!);
  assert.ok(
    ["localhost", "127.0.0.1"].includes(parsed.hostname) &&
      parsed.pathname.endsWith("_test"),
  );
  process.env.DATABASE_URL = url!;
  const { databaseService: db } =
    await import("../../services/database.service.js");
  const { publicationService: pub, publicationFingerprint } =
    await import("./publication.service.js");
  const { mediaWorker } = await import("./media-worker.js");
  const { releasesService } = await import("../releases/releases.service.js");
  const { mediaService } = await import("../media/media.service.js");
  const { tracksService } = await import("../tracks/tracks.service.js");
  const { muxService } = await import("../../services/mux.service.js");
  const owner = `pub-owner-${randomUUID()}`;
  const wallet = Keypair.random().publicKey();
  await db.initialize();
  await db.transaction(async (c) => {
    await c.query(
      "INSERT INTO users(id,wallet_address,primary_intent,payload) VALUES($1,$2,'artist',$3)",
      [
        owner,
        wallet,
        JSON.stringify({
          id: owner,
          walletAddress: wallet,
          displayName: "Artist",
          primaryIntent: "artist",
          onboardingStatus: "complete",
          onboardingStep: "complete",
          artistAccess: true,
        }),
      ],
    );
  });
  const create = async (count = 1) => {
    const id = `pub-${randomUUID()}`;
    const tracks = Array.from({ length: count }, (_, i) => ({
      id: `audio-${randomUUID()}`,
      artistId: owner,
      title: `Song ${i + 1}`,
      artistName: "Artist",
      genre: "Pop",
      status: "processing",
      visibility: "unpublished",
      playbackReady: false,
      masterStorageKey: `audio/${randomUUID()}.wav`,
      credits: [],
      recordLabel: "Label",
      runtime: "0:00",
    }));
    const release = {
      id,
      artistId: owner,
      title: "Release",
      artistName: "Artist",
      genre: "Pop",
      type: count === 1 ? "single" : "ep",
      status: "draft",
      coverStorageKey: "cover/test.png",
      trackCount: count,
      updatedAt: new Date().toISOString(),
    };
    await db.transaction(async (c) => {
      await c.query(
        "INSERT INTO releases(id,artist_id,type,status,payload) VALUES($1,$2,$3,'draft',$4)",
        [id, owner, release.type, JSON.stringify(release)],
      );
      for (const [i, track] of tracks.entries()) {
        await c.query(
          "INSERT INTO tracks(id,artist_id,status,visibility,payload) VALUES($1,$2,'processing','unpublished',$3)",
          [track.id, owner, JSON.stringify(track)],
        );
        await c.query(
          "INSERT INTO release_tracks(release_id,track_id,track_number) VALUES($1,$2,$3)",
          [id, track.id, i + 1],
        );
      }
    });
    return { id, tracks, release };
  };
  const ready = async (id: string) =>
    db.transaction((c) =>
      c.query(
        'UPDATE tracks SET payload=payload || \'{"playbackReady":true,"status":"published"}\'::jsonb WHERE id=$1',
        [id],
      ),
    );
  try {
    await t.test(
      "accepts processing, survives a view closing, and publishes every song atomically",
      async () => {
        const r = await create(2);
        const request = await pub.request(wallet, r.id, { mode: "published" });
        assert.equal(request.state, "processing");
        assert.equal(await releasesService.getRelease(r.id), null);
        const duplicate = await pub.request(wallet, r.id, {
          mode: "published",
        });
        assert.equal(duplicate.id, request.id);
        await ready(r.tracks[0].id);
        await pub.process(r.id);
        assert.equal((await pub.latest(r.id))?.state, "processing");
        assert.equal(await releasesService.getRelease(r.id), null);
        await ready(r.tracks[1].id);
        await mediaWorker.scan();
        while (await mediaWorker.runOne()) {}
        assert.equal((await pub.latest(r.id))?.state, "published");
        assert.equal(
          (await releasesService.getRelease(r.id))?.tracks.length,
          2,
        );
        await pub.process(r.id);
        assert.equal((await pub.latest(r.id))?.id, request.id);
      },
    );
    await t.test("failed audio blocks the entire collection", async () => {
      const r = await create(2);
      await pub.request(wallet, r.id, { mode: "published" });
      await ready(r.tracks[0].id);
      await db.transaction((c) =>
        c.query(
          'UPDATE tracks SET payload=payload || \'{"status":"failed"}\'::jsonb WHERE id=$1',
          [r.tracks[1].id],
        ),
      );
      await pub.process(r.id);
      assert.equal((await pub.latest(r.id))?.state, "failed");
      assert.equal(await releasesService.getRelease(r.id), null);
    });
    await t.test("cancelled and changed targets cannot publish", async () => {
      for (const cancel of [true, false]) {
        const r = await create();
        await pub.request(wallet, r.id, { mode: "published" });
        if (cancel) await pub.cancel(wallet, r.id);
        else
          await db.transaction((c) =>
            c.query(
              'UPDATE releases SET payload=payload || \'{"title":"Changed"}\'::jsonb WHERE id=$1',
              [r.id],
            ),
          );
        await ready(r.tracks[0].id);
        await pub.process(r.id);
        assert.equal((await pub.latest(r.id))?.state, "cancelled");
        assert.equal(await releasesService.getRelease(r.id), null);
      }
    });
    await t.test(
      "schedule is worker-owned and missed processing requires attention",
      async () => {
        for (const makeReady of [true, false]) {
          const r = await create();
          await pub.request(wallet, r.id, {
            mode: "scheduled",
            releaseAt: new Date(Date.now() + 60000).toISOString(),
          });
          if (makeReady) await ready(r.tracks[0].id);
          await pub.process(r.id);
          assert.equal(
            (await pub.latest(r.id))?.state,
            makeReady ? "scheduled" : "processing",
          );
          await db.transaction((c) =>
            c.query(
              "UPDATE publication_requests SET release_at=NOW()-INTERVAL '1 second' WHERE release_id=$1",
              [r.id],
            ),
          );
          await pub.process(r.id);
          assert.equal(
            (await pub.latest(r.id))?.state,
            makeReady ? "published" : "failed",
          );
        }
      },
    );
    await t.test(
      "real restart leases and duplicate event delivery retain one durable job",
      async () => {
        const event = {
          id: `event-${randomUUID()}`,
          type: "video.asset.ready",
          data: { id: "obsolete", passthrough: "missing" },
        };
        await mediaWorker.receive(event as never);
        await mediaWorker.receive(event as never);
        const count = await db.transaction((c) =>
          c.query("SELECT COUNT(*) FROM media_jobs WHERE id=$1", [
            `event:${event.id}`,
          ]),
        );
        assert.equal(count.rows[0].count, "1");
        await db.transaction((c) =>
          c.query(
            "UPDATE media_jobs SET state='running',lease_until=NOW()-INTERVAL '1 second' WHERE id=$1",
            [`event:${event.id}`],
          ),
        );
        while (await mediaWorker.runOne()) {}
        const job = await db.transaction((c) =>
          c.query("SELECT state FROM media_jobs WHERE id=$1", [
            `event:${event.id}`,
          ]),
        );
        assert.equal(job.rows[0].state, "done");
      },
    );
    await t.test(
      "replacement generation ignores old assets and provider patches preserve metadata",
      async () => {
        const r = await create();
        await db.transaction((c) =>
          c.query(
            "UPDATE tracks SET payload=payload || $2::jsonb WHERE id=$1",
            [
              r.tracks[0].id,
              JSON.stringify({
                mediaProvider: "mux",
                muxUploadId: "new-upload",
                muxAssetId: "new-asset",
              }),
            ],
          ),
        );
        await mediaService.handleMuxWebhook({
          type: "video.asset.errored",
          data: { id: "old-asset", passthrough: r.tracks[0].id },
        } as never);
        await tracksService.applyMediaPatch(r.tracks[0].id, "old-upload", {
          status: "failed",
        });
        let track = await db.findPayloadById<any>("tracks", r.tracks[0].id);
        assert.equal(track.status, "processing");
        await tracksService.applyMediaPatch(r.tracks[0].id, "new-upload", {
          playbackReady: true,
        });
        track = await db.findPayloadById<any>("tracks", r.tracks[0].id);
        assert.equal(track.recordLabel, "Label");
        assert.equal(track.playbackReady, true);
      },
    );
    await t.test(
      "failed revision preserves old public content and successful retry swaps once",
      async () => {
        const r = await create();
        await ready(r.tracks[0].id);
        await pub.request(wallet, r.id, { mode: "published" });
        const old = await releasesService.getRelease(r.id);
        await releasesService.beginRevision(wallet, r.id);
        await db.transaction((c) =>
          c.query(
            'UPDATE releases SET payload=payload || \'{"title":"New title"}\'::jsonb WHERE id=$1',
            [r.id],
          ),
        );
        await db.transaction((c) =>
          c.query(
            'UPDATE tracks SET payload=payload || \'{"playbackReady":false,"status":"processing"}\'::jsonb WHERE id=$1',
            [r.tracks[0].id],
          ),
        );
        await pub.request(wallet, r.id, { mode: "published" });
        assert.equal(
          (await releasesService.getRelease(r.id))?.title,
          old?.title,
        );
        await ready(r.tracks[0].id);
        await Promise.all([pub.process(r.id), pub.process(r.id)]);
        assert.equal(
          (await releasesService.getRelease(r.id))?.title,
          "New title",
        );
        assert.equal((await pub.latest(r.id))?.state, "published");
      },
    );
    await t.test("asset ingestion is durable and uncertain creation never creates a second asset",async()=>{
      const {storageService}=await import("../../services/storage.service.js");
      const saved={find:muxService.findAssetByPassthrough,create:muxService.createAssetFromUrl,get:muxService.getAsset,url:storageService.getDownloadUrl};
      let creations=0;
      muxService.findAssetByPassthrough=async()=>null;
      muxService.createAssetFromUrl=async()=>{creations++;return {id:"ingested-asset",status:"preparing"} as never;};
      muxService.getAsset=async()=>({id:"ingested-asset",status:"ready",playback_ids:[{id:"playback"}],duration:1} as never);
      storageService.getDownloadUrl=()=>"https://example.com/audio.wav";
      try{
        for(const uncertain of [false,true]){
          const r=await create();const sid=`upload-${randomUUID()}`;
          await db.transaction(async c=>{
            await c.query("UPDATE tracks SET payload=payload || '{\"mediaProvider\":\"mux\"}'::jsonb WHERE id=$1",[r.tracks[0].id]);
            await c.query("INSERT INTO upload_sessions(id,track_id,provider,expires_at,payload) VALUES($1,$2,'s3',NOW()+INTERVAL '1 hour',$3)",[sid,r.tracks[0].id,JSON.stringify({id:sid,trackId:r.tracks[0].id,storageKey:r.tracks[0].masterStorageKey,provider:"s3"})]);
            await c.query("INSERT INTO media_jobs(id,kind,payload,attempts,available_at) VALUES($1,'ingest',$2,$3,NOW()-INTERVAL '1 day')",[`ingest:${sid}`,JSON.stringify({sessionId:sid,trackId:r.tracks[0].id}),uncertain?1:0]);
          });
          await mediaWorker.runOne();
          const t=await db.findPayloadById<any>("tracks",r.tracks[0].id);
          if(!uncertain){assert.equal(t.playbackReady,true);assert.equal(t.muxAssetId,"ingested-asset");assert.equal(t.recordLabel,"Label");}else assert.equal(t.playbackReady,false);
        }
        assert.equal(creations,1);
      }finally{muxService.findAssetByPassthrough=saved.find;muxService.createAssetFromUrl=saved.create;muxService.getAsset=saved.get;storageService.getDownloadUrl=saved.url;}
    });
  } finally {
    await db.transaction(async (c) => {
      await c.query("DELETE FROM releases WHERE artist_id=$1", [owner]);
      await c.query("DELETE FROM tracks WHERE artist_id=$1", [owner]);
      await c.query("DELETE FROM users WHERE id=$1", [owner]);
    });
    await db.close();
  }
});
