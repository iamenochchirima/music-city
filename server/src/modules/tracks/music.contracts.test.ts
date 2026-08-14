import assert from "node:assert/strict";
import test from "node:test";

import {
  createUploadSessionSchema,
  releaseCreateSchema,
  trackCreateSchema,
  trackMetadataUpdateSchema,
} from "@music-city/shared";

test("track creation keeps release metadata out of the upload contract", () => {
  const parsed = trackCreateSchema.parse({
    title: "First Light",
    genre: "Electronic",
  });

  assert.equal(parsed.isExplicit, false);
  assert.equal("visibility" in parsed, false);
  assert.throws(() =>
    trackCreateSchema.parse({
      title: "First Light",
      genre: "Electronic",
      country: "ZA",
      recordLabel: "Old Label",
    }),
  );
});

test("track metadata accepts credits and normalizes ISRC formatting at the service boundary", () => {
  const parsed = trackMetadataUpdateSchema.parse({
    isrc: "US-RC1-76-07839",
    credits: [
      { role: "composer", name: "A Composer" },
      { role: "producer", name: "A Producer" },
    ],
    isExplicit: true,
  });

  assert.equal(parsed.isrc, "US-RC1-76-07839");
  assert.equal(parsed.credits?.length, 2);
  assert.equal(parsed.isExplicit, true);
});

test("track metadata rejects malformed ISRCs with a field-level issue", () => {
  const result = trackMetadataUpdateSchema.safeParse({ isrc: "not-an-isrc" });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0]?.path.join("."), "isrc");
  }
});

test("record label belongs to the release contract", () => {
  const parsed = releaseCreateSchema.parse({
    title: "First Light EP",
    type: "ep",
    genre: "Electronic",
    recordLabel: "Music City Records",
  });

  assert.equal(parsed.recordLabel, "Music City Records");
});

test("upload contracts enforce media type and size guidance", () => {
  const audioResult = createUploadSessionSchema.safeParse({
    trackId: "trk-1",
    purpose: "audio",
    fileName: "cover.jpg",
    contentType: "image/jpeg",
    sizeBytes: 1024,
  });
  const oversizedCoverResult = createUploadSessionSchema.safeParse({
    releaseId: "rel-1",
    purpose: "cover",
    fileName: "cover.jpg",
    contentType: "image/jpeg",
    sizeBytes: 11 * 1024 * 1024,
  });

  assert.equal(audioResult.success, false);
  assert.equal(oversizedCoverResult.success, false);
});
