import test from "node:test";
import assert from "node:assert/strict";
import { createDecipheriv } from "node:crypto";
import { Readable } from "node:stream";
import type { TrackSummary } from "@music-city/shared";
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/preload_test";
const { playbackPreload, PRELOAD_BYTES } = await import(
  "./playback-preload.js"
);
const { storageService } = await import("../../services/storage.service.js");
const { muxService } = await import("../../services/mux.service.js");
const track = {
  id: "track",
  playbackReady: true,
  mediaProvider: "local",
  masterStorageKey: "track/audio.mp3",
  sourceFileName: "audio.mp3",
} as TrackSummary;
function decrypt(prepared: { iv: string; ciphertext: string }, key: string) {
  const body = Buffer.from(prepared.ciphertext, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "base64"),
    Buffer.from(prepared.iv, "base64"),
  );
  decipher.setAuthTag(body.subarray(-16));
  const clear = Buffer.concat([
    decipher.update(body.subarray(0, -16)),
    decipher.final(),
  ]);
  const length = clear.readUInt32BE();
  const bundle = JSON.parse(clear.subarray(4, 4 + length).toString());
  return {
    resources: bundle.resources.map((r: any) => ({
      ...r,
      body: clear
        .subarray(4 + length + r.offset, 4 + length + r.offset + r.length)
        .toString("base64"),
    })),
  };
}
test("preparation reads only a bounded prefix, encrypts it and binds unlocking to actor and current media", async () => {
  const original = {
    metadata: storageService.getStoredObjectMetadata,
    range: storageService.openStoredObjectRange,
  };
  const ranges: number[][] = [];
  storageService.getStoredObjectMetadata = async () =>
    ({ sizeBytes: 10 * 1024 * 1024, contentType: "audio/mpeg" }) as never;
  storageService.openStoredObjectRange = async (_key, start, end) => {
    ranges.push([start, end]);
    return {
      stream: Readable.from([Buffer.alloc(end - start + 1, 7)]),
      contentType: "audio/mpeg",
      sizeBytes: 10 * 1024 * 1024,
    };
  };
  try {
    const prepared = await playbackPreload.prepare(track, "wallet:one");
    assert.deepEqual(ranges, [[0, PRELOAD_BYTES - 1]]);
    assert.equal(
      playbackPreload.unlock(prepared.ticket, track, "wallet:other"),
      null,
    );
    assert.equal(
      playbackPreload.unlock(
        prepared.ticket,
        { ...track, masterStorageKey: "replacement.mp3" },
        "wallet:one",
      ),
      null,
    );
    assert.equal(
      playbackPreload.unlock(prepared.ticket + "x", track, "wallet:one"),
      null,
    );
    const key = playbackPreload.unlock(prepared.ticket, track, "wallet:one");
    assert.ok(key);
    const bundle = decrypt(prepared, key);
    assert.equal(
      Buffer.from(bundle.resources[0].body, "base64").length,
      PRELOAD_BYTES,
    );
    assert.equal(bundle.resources[0].totalBytes, 10 * 1024 * 1024);
    const tampered = {
      ...prepared,
      ciphertext: Buffer.alloc(
        Buffer.from(prepared.ciphertext, "base64").length,
      ).toString("base64"),
    };
    assert.throws(() => decrypt(tampered, key));
  } finally {
    storageService.getStoredObjectMetadata = original.metadata;
    storageService.openStoredObjectRange = original.range;
  }
});
test("guest HLS preparation keeps full-playlist URLs and provider access tokens out of the unlocked bundle", async () => {
  const original = {
    fetch: globalThis.fetch,
    url: muxService.createPlaybackUrl,
  };
  const calls: string[] = [];
  muxService.createPlaybackUrl = async () =>
    "https://stream.mux.com/asset.m3u8?token=provider-secret";
  globalThis.fetch = (async (value) => {
    const url = String(value);
    calls.push(url);
    if (url.includes("asset.m3u8"))
      return new Response(
        "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=128000\naudio.m3u8?token=provider-secret\n",
      );
    if (url.includes("audio.m3u8"))
      return new Response(
        "#EXTM3U\n#EXTINF:5.0,\nfirst.ts?token=provider-secret\n#EXTINF:5.0,\nsecond.ts\n",
      );
    return new Response(new Uint8Array(50000), {
      headers: { "content-type": "audio/mp2t" },
    });
  }) as typeof fetch;
  try {
    const muxTrack = {
      ...track,
      mediaProvider: "mux",
      muxPlaybackId: "asset",
    } as TrackSummary;
    const prepared = await playbackPreload.prepare(muxTrack, "guest:one");
    const bundle = decrypt(
      prepared,
      playbackPreload.unlock(prepared.ticket, muxTrack, "guest:one")!,
    );
    assert.equal(calls.length, 3);
    assert.equal(bundle.resources.length, 1);
    assert.equal(bundle.resources[0].endSeconds, 5);
    assert.ok(!JSON.stringify(bundle).includes("provider-secret"));
    assert.ok(!JSON.stringify(bundle).includes(".m3u8"));
    assert.ok(!calls.some((url) => url.includes("second.ts")));
  } finally {
    globalThis.fetch = original.fetch;
    muxService.createPlaybackUrl = original.url;
  }
});
