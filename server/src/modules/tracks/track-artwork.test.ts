import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";

import {
  applyReleaseArtworkToTracks,
  releaseArtworkPatch,
} from "./track-artwork.js";

test("a track without artwork inherits the release artwork", () => {
  assert.deepEqual(
    releaseArtworkPatch(
      {
        coverStorageKey: "covers/releases/rel-1.png",
        coverImageUrl: "https://cdn.example/rel-1.webp",
      },
      {},
    ),
    {
      coverStorageKey: "covers/releases/rel-1.png",
      coverImageUrl: "https://cdn.example/rel-1.webp",
    },
  );
});

test("a track with its own artwork keeps it", () => {
  const release = {
    coverStorageKey: "covers/releases/rel-1.png",
    coverImageUrl: "https://cdn.example/rel-1.webp",
  };

  assert.deepEqual(
    releaseArtworkPatch(release, { coverStorageKey: "covers/tracks/trk-1.png" }),
    {},
  );
  assert.deepEqual(
    releaseArtworkPatch(release, { coverImageUrl: "https://cdn.example/trk-1.webp" }),
    {},
  );
});

test("a release without artwork leaves tracks untouched", () => {
  assert.deepEqual(releaseArtworkPatch({}, {}), {});
});

test("backfill copies artwork only when a track has none", async () => {
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const client = {
    query: async (text: string, values: unknown[]) => {
      queries.push({ text, values });
      return { rowCount: 2 };
    },
  } as unknown as PoolClient;

  const updated = await applyReleaseArtworkToTracks(client, ["trk-1", "trk-2"], {
    coverStorageKey: "covers/releases/rel-1.png",
    coverImageUrl: "https://cdn.example/rel-1.webp",
  });

  assert.equal(updated, 2);
  assert.equal(queries.length, 1);
  assert.match(queries[0]!.text, /payload->>'coverStorageKey' IS NULL/);
  assert.match(queries[0]!.text, /payload->>'coverImageUrl' IS NULL/);
  assert.deepEqual(queries[0]!.values[0], ["trk-1", "trk-2"]);
  assert.deepEqual(JSON.parse(String(queries[0]!.values[1])), {
    coverStorageKey: "covers/releases/rel-1.png",
    coverImageUrl: "https://cdn.example/rel-1.webp",
  });
});

test("backfill does nothing without tracks or artwork", async () => {
  const client = {
    query: async () => {
      throw new Error("should not query");
    },
  } as unknown as PoolClient;

  assert.equal(await applyReleaseArtworkToTracks(client, [], { coverStorageKey: "covers/a.png" }), 0);
  assert.equal(await applyReleaseArtworkToTracks(client, ["trk-1"], {}), 0);
});
