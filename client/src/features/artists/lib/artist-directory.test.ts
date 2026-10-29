import { describe, expect, it } from "vitest";
import type { ArtistSummary, ReleaseSummary } from "@music-city/shared";

import { artistsWithPublicReleases } from "./artist-directory";

const artist = (id: string): ArtistSummary => ({
  id,
  walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  name: id,
  genre: "Independent",
  city: "Remote",
  monthlyListeners: "0",
  verified: false,
});

const release = (
  artistId: string,
  status: ReleaseSummary["status"],
): ReleaseSummary => ({
  id: `${artistId}-${status}`,
  artistId,
  artistName: artistId,
  title: `${artistId} ${status}`,
  type: "single",
  status,
  genre: "Hip-Hop",
  trackCount: 1,
});

describe("artistsWithPublicReleases", () => {
  it("keeps artists with published or scheduled releases and hides empty or draft-only profiles", () => {
    const artists = [
      artist("published-artist"),
      artist("scheduled-artist"),
      artist("draft-only-artist"),
      artist("empty-artist"),
    ];

    expect(
      artistsWithPublicReleases(artists, [
        release("published-artist", "published"),
        release("scheduled-artist", "scheduled"),
        release("draft-only-artist", "draft"),
        release("draft-only-artist", "archived"),
      ]).map(({ id }) => id),
    ).toEqual(["published-artist", "scheduled-artist"]);
  });
});
