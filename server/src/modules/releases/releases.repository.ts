import type { ReleaseSummary } from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export const releasesRepository = {
  async list() {
    return databaseService.listPayloads<ReleaseSummary>("releases");
  },

  async listByArtist(artistId: string) {
    return databaseService.listReleasesByArtist<ReleaseSummary>(artistId);
  },

  async findById(releaseId: string) {
    return databaseService.findPayloadById<ReleaseSummary>("releases", releaseId);
  },

  async upsert(release: ReleaseSummary) {
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
