import type { PlaylistSummary } from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export const playlistsRepository = {
  async list() {
    return databaseService.listPayloads<PlaylistSummary>("playlists");
  },

  async listByOwner(ownerUserId: string) {
    return databaseService.listPlaylistsByOwner<PlaylistSummary>(ownerUserId);
  },

  async findById(playlistId: string) {
    return databaseService.findPayloadById<PlaylistSummary>("playlists", playlistId);
  },

  async upsert(playlist: PlaylistSummary) {
    await databaseService.upsertPlaylist(
      playlist.id,
      playlist.ownerUserId,
      playlist.visibility,
      playlist,
    );

    return playlist;
  },

  async delete(playlistId: string) {
    await databaseService.deletePlaylist(playlistId);
  },

  async assignTrack(playlistId: string, trackId: string, position: number) {
    await databaseService.assignTrackToPlaylist(playlistId, trackId, position);
  },

  async removeTrack(playlistId: string, trackId: string) {
    await databaseService.removeTrackFromPlaylist(playlistId, trackId);
  },

  async listTracks(playlistId: string) {
    return databaseService.listPlaylistTracks(playlistId);
  },
};
