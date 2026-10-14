import { expect, it } from "vitest";
import { restoreTrackUploadDraft } from "./track-upload-draft";
const base = { savedAt: 1000, title: "Song", artistName: "Artist", genre: "Pop", isExplicit: true, featuredArtists: ["Featured"] };
it("converts previous saved drafts without losing text or confusing review with the new credits step", () => {
  const converted = restoreTrackUploadDraft({ ...base, version: 1, stepIndex: 2 }, 2000);
  expect(converted).toEqual({ ...base, version: 2, stepId: "review", credits: [], isrc: "", recordLabel: "" });
});
it("preserves unfinished contributor rows for correction and expires drafts after seven days", () => {
  const draft = { ...base, version: 2, stepId: "credits", credits: [{ role: "composer", name: "" }], isrc: "unfinished", recordLabel: "Label" };
  expect(restoreTrackUploadDraft(draft, 2000)).toEqual(draft);
  expect(restoreTrackUploadDraft(draft, 1000 + 7 * 86400000)).toBeNull();
  expect(restoreTrackUploadDraft(draft, 999)).toBeNull();
  expect(restoreTrackUploadDraft({ version: 999 }, 2000)).toBeNull();
});
