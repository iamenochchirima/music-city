import { databaseService } from "../services/database.service.js";
import { storageService } from "../services/storage.service.js";
import { applyReleaseArtworkToTracks } from "../modules/tracks/track-artwork.js";
import type { StoredRelease } from "../modules/releases/releases.repository.js";

type TrackRow = { track_id: string };

try {
  const releases = await databaseService.listPayloads<StoredRelease>("releases");
  let releasesUpdated = 0;
  let tracksUpdated = 0;
  const failures: string[] = [];

  for (const [index, release] of releases.entries()) {
    const coverStorageKey = release.coverStorageKey;
    if (!coverStorageKey) continue;
    try {
      const updated = await databaseService.transaction(async (client) => {
        const trackIds = (
          await client.query<TrackRow>(
            "SELECT track_id FROM release_tracks WHERE release_id=$1",
            [release.id],
          )
        ).rows.map((row) => row.track_id);

        return applyReleaseArtworkToTracks(client, trackIds, {
          coverStorageKey,
          coverImageUrl: storageService.getImageUrl(coverStorageKey),
        });
      });
      if (updated) releasesUpdated++;
      tracksUpdated += updated;
      console.log(
        JSON.stringify({
          release: index + 1,
          total: releases.length,
          id: release.id,
          tracks: updated,
          ok: true,
        }),
      );
    } catch (error) {
      failures.push(release.id);
      console.log(
        JSON.stringify({
          release: index + 1,
          total: releases.length,
          id: release.id,
          ok: false,
          reason: error instanceof Error ? error.message : "Backfill failed",
        }),
      );
    }
  }

  console.log(
    JSON.stringify({
      releases: releases.length,
      releasesUpdated,
      tracksUpdated,
      failures: failures.length,
    }),
  );
  if (failures.length) process.exitCode = 1;
} finally {
  await databaseService.close();
}
