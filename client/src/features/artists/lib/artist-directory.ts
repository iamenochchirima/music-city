import type { ArtistSummary, ReleaseSummary } from "@music-city/shared";

const publicReleaseStatuses = new Set<ReleaseSummary["status"]>([
  "published",
  "scheduled",
]);

export const artistsWithPublicReleases = (
  artists: ArtistSummary[],
  releases: ReleaseSummary[],
) => {
  const discoverableArtistIds = new Set(
    releases
      .filter((release) => publicReleaseStatuses.has(release.status))
      .map((release) => release.artistId),
  );

  return artists.filter((artist) => discoverableArtistIds.has(artist.id));
};
