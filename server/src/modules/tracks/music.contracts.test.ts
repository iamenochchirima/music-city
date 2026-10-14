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
      releasePlacement: "existing",
    }),
  );
});

test("track metadata accepts credits and normalizes ISRC formatting before persistence", () => {
  const parsed = trackMetadataUpdateSchema.parse({
    isrc: "US-RC1-76-07839",
    credits: [
      { role: "composer", name: "A Composer" },
      { role: "producer", name: "A Producer" },
    ],
    isExplicit: true,
  });

  assert.equal(parsed.isrc, "USRC17607839");
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

test("release record label remains independent of track metadata", () => {
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

test("track metadata normalizes optional values and all requested credit roles", () => {
  const credits = ["composer", "lyricist", "producer", "engineer", "publisher", "songwriter", "remixer"].map(role => ({ role, name: " Contributor " }));
  const created = trackCreateSchema.parse({ title: "Song", genre: "Pop", credits, recordLabel: " Label ", isrc: "us-rc1-76-07839" });
  const updated = trackMetadataUpdateSchema.parse({ credits, recordLabel: " Label ", isrc: "us-rc1-76-07839" });
  assert.deepEqual(created.credits, updated.credits);
  assert.equal(created.recordLabel, "Label");
  assert.equal(updated.isrc, "USRC17607839");
  assert.equal(created.credits?.[1]?.role, "lyricist");
  assert.equal(created.credits?.[0]?.name, "Contributor");
  assert.deepEqual(trackMetadataUpdateSchema.parse({ credits: [], isrc: "  ", recordLabel: "  " }), { credits: [], isrc: "", recordLabel: "" });
  assert.deepEqual(trackMetadataUpdateSchema.parse({}), {});
});

test("credits reject incomplete, duplicate, overlong, and excessive entries", () => {
  const invalid = [
    [{ role: "composer", name: "   " }],
    [{ role: "composer", name: "Name" }, { role: "composer", name: " name " }],
    [{ role: "composer", name: "X".repeat(121) }],
    Array.from({ length: 33 }, (_, i) => ({ role: "composer", name: String(i) })),
  ];
  for (const credits of invalid) {
    assert.equal(trackCreateSchema.safeParse({ title: "Song", genre: "Pop", credits }).success, false);
    assert.equal(trackMetadataUpdateSchema.safeParse({ credits }).success, false);
  }
  assert.equal(trackMetadataUpdateSchema.safeParse({ recordLabel: "X".repeat(121) }).success, false);
  assert.equal(trackMetadataUpdateSchema.safeParse({ credits: [{ role: "composer", name: "Person" }, { role: "producer", name: "Person" }] }).success, true);
});
