import type { ReleaseSummary, ReleaseDetail } from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export type StoredRelease = ReleaseSummary & { liveVersion?: ReleaseDetail };

export const releasesRepository = {
  async list() {
    return databaseService.listPayloads<StoredRelease>("releases");
  },

  async listByArtist(artistId: string) {
    return databaseService.listReleasesByArtist<StoredRelease>(artistId);
  },

  async findById(releaseId: string) {
    return databaseService.findPayloadById<StoredRelease>("releases", releaseId);
  },

  async upsert(release: StoredRelease) {
    await databaseService.upsertRelease(
      release.id,
      release.artistId,
      release.type,
      release.status,
      release.releaseDate ?? null,
      release,
    );

    return release;
  },

  async delete(releaseId: string) {
    await databaseService.deleteRelease(releaseId);
  },

  async assignTrack(
    releaseId: string,
    trackId: string,
    trackNumber: number,
    discNumber: number,
    isFocusTrack: boolean,
  ) {
    await databaseService.assignTrackToRelease(
      releaseId,
      trackId,
      trackNumber,
      discNumber,
      isFocusTrack,
    );
  },

  async removeTrack(releaseId: string, trackId: string) {
    await databaseService.removeTrackFromRelease(releaseId, trackId);
  },

  async listTracks(releaseId: string) {
    return databaseService.listReleaseTracks(releaseId);
  },
};
