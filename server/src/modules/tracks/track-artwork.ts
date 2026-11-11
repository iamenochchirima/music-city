import type { PoolClient } from "pg";

type ArtworkSource = {
  coverStorageKey?: string;
  coverImageUrl?: string;
};

type TrackArtwork = {
  coverStorageKey: string;
  coverImageUrl?: string;
};

/**
 * Artwork describes the whole release, so a track that has no image of its own
 * inherits the release artwork. Tracks that already carry artwork keep it.
 */
export const releaseArtworkPatch = (
  release: ArtworkSource,
  track: ArtworkSource,
): Partial<TrackArtwork> => {
  if (!release.coverStorageKey) return {};
  if (track.coverStorageKey || track.coverImageUrl) return {};
  return {
    coverStorageKey: release.coverStorageKey,
    ...(release.coverImageUrl ? { coverImageUrl: release.coverImageUrl } : {}),
  };
};

/**
 * Copies release artwork onto the given tracks, skipping any track that already
 * has a cover. Safe to repeat.
 */
export const applyReleaseArtworkToTracks = async (
  client: PoolClient,
  trackIds: string[],
  artwork: ArtworkSource,
) => {
  if (!trackIds.length || !artwork.coverStorageKey) return 0;
  const patch: TrackArtwork = {
    coverStorageKey: artwork.coverStorageKey,
    ...(artwork.coverImageUrl ? { coverImageUrl: artwork.coverImageUrl } : {}),
  };
  const result = await client.query(
    `UPDATE tracks
        SET payload = payload || $2::jsonb
      WHERE id = ANY($1::text[])
        AND payload->>'coverStorageKey' IS NULL
        AND payload->>'coverImageUrl' IS NULL`,
    [trackIds, JSON.stringify(patch)],
  );
  return result.rowCount ?? 0;
};
