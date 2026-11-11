import { notifyTrackProcessing } from "../notifications/notifications.service.js";
import type { TrackSummary, TrackMetadataUpdateInput } from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";
import { applyReleaseArtworkToTracks } from "./track-artwork.js";

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

  async findReleaseContext(trackId: string) {
    return databaseService.getTrackReleaseContext(trackId);
  },

  async findReleaseContexts(trackIds: string[]) {
    return databaseService.getTrackReleaseContexts(trackIds);
  },

  async findById(trackId: string) {
    return databaseService.findPayloadById<TrackSummary>("tracks", trackId);
  },

  async applyReleaseArtwork(
    releaseId: string,
    artwork: { coverStorageKey: string; coverImageUrl?: string },
  ) {
    return databaseService.transaction(async (client) => {
      const trackIds = (
        await client.query<{ track_id: string }>(
          "SELECT track_id FROM release_tracks WHERE release_id=$1",
          [releaseId],
        )
      ).rows.map((row) => row.track_id);

      return applyReleaseArtworkToTracks(client, trackIds, artwork);
    });
  },

  async updateMetadata(trackId: string, artistId: string, patch: TrackMetadataUpdateInput & { updatedAt: string }) {
    return databaseService.updateTrackMetadata(trackId, artistId, patch);
  },

  async upsert(track: TrackSummary) {
    await databaseService.transaction(async client => {
      const current = (await client.query<{ payload: TrackSummary }>("SELECT payload FROM tracks WHERE id=$1 FOR UPDATE",[track.id])).rows[0]?.payload;
      await databaseService.upsertTrack(
        track.id,
        track.artistId,
        track.status,
        track.visibility ?? "unpublished",
        track.mediaProvider ?? null,
        track,
        client,
      );
      await notifyTrackProcessing(client,current,track);
    });
    return track;
  },

  async delete(trackId: string) {
    await databaseService.deleteTrack(trackId);
  },
};
