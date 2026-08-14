import type { TrackSummary } from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export const tracksRepository = {
  async list() {
    return databaseService.listPayloads<TrackSummary>("tracks");
  },

  async listByArtist(artistId: string) {
    return databaseService.listTracksByArtist<TrackSummary>(artistId);
  },

  async listPublicTrackIds(artistId?: string) {
    return databaseService.listPublicTrackIds(artistId);
  },

  async isTrackInPublicRelease(trackId: string) {
    return databaseService.isTrackInPublicRelease(trackId);
  },

  async findById(trackId: string) {
    return databaseService.findPayloadById<TrackSummary>("tracks", trackId);
  },

  async upsert(track: TrackSummary) {
    await databaseService.upsertTrack(
      track.id,
      track.artistId,
      track.status,
      track.visibility ?? "unpublished",
      track.mediaProvider ?? null,
      track,
    );
    return track;
  },

  async delete(trackId: string) {
    await databaseService.deleteTrack(trackId);
  },
};
