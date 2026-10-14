import assert from "node:assert/strict";
import test from "node:test";
import type { TrackSummary } from "@music-city/shared";
import { liveRecording } from "./live-recording.js";
test("release snapshots keep content while current counters and sale settings stay effective", () => {
  const snapshot = {
    id: "song",
    title: "Original",
    credits: [{ role: "composer", name: "Original Composer" }],
    plays: 3,
    likes: 2,
    purchaseEnabled: true,
    purchasePrice: "10",
  } as TrackSummary;
  const current = {
    ...snapshot,
    title: "Unapplied title",
    plays: 9,
    likes: 4,
    purchaseEnabled: false,
    purchasePrice: undefined,
  };
  const visible = liveRecording(current, snapshot);
  assert.equal(visible.title, "Original");
  assert.equal(visible.plays, 9);
  assert.equal(visible.likes, 4);
  assert.equal(visible.purchaseEnabled, false);
  assert.equal(visible.purchasePrice, undefined);
});
