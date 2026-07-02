import type {
  PlaylistCreateInput,
  PlaylistDetail,
  PlaylistSummary,
  PlaylistTrackAssignInput,
  PlaylistTrackReorderInput,
  PlaylistUpdateInput,
} from "@music-city/shared";

import { httpClient } from "@/lib/api/http-client";

export const playlistsApi = {
  async listPlaylists() {
    const response = await httpClient.get<{ items: PlaylistSummary[] }>("/playlists");
    return response.items;
  },

  async listMyPlaylists(token: string) {
    const response = await httpClient.get<{ items: PlaylistSummary[] }>(
      "/playlists/mine",
      token,
    );
    return response.items;
  },

  async getPlaylist(playlistId: string) {
    const response = await httpClient.get<{ playlist: PlaylistDetail | null }>(
      `/playlists/${playlistId}`,
    );
    return response.playlist;
  },

  async getManagePlaylist(token: string, playlistId: string) {
    const response = await httpClient.get<{ playlist: PlaylistDetail | null }>(
      `/playlists/${playlistId}/manage`,
      token,
    );
    return response.playlist;
  },

  async createPlaylist(token: string, input: PlaylistCreateInput) {
    const response = await httpClient.post<{ playlist: PlaylistDetail }>(
      "/playlists",
      input,
      token,
    );
    return response.playlist;
  },

  async updatePlaylist(
    token: string,
    playlistId: string,
    input: PlaylistUpdateInput,
  ) {
    const response = await httpClient.put<{ playlist: PlaylistDetail }>(
      `/playlists/${playlistId}`,
      input,
      token,
    );
    return response.playlist;
  },

  async addTrackToPlaylist(
    token: string,
    playlistId: string,
    input: PlaylistTrackAssignInput,
  ) {
    const response = await httpClient.post<{ playlist: PlaylistDetail }>(
      `/playlists/${playlistId}/tracks`,
      input,
      token,
    );
    return response.playlist;
  },

  async reorderPlaylistTracks(
    token: string,
    playlistId: string,
    input: PlaylistTrackReorderInput,
  ) {
    const response = await httpClient.put<{ playlist: PlaylistDetail }>(
      `/playlists/${playlistId}/tracks/order`,
      input,
      token,
    );
    return response.playlist;
  },

  async removeTrackFromPlaylist(token: string, playlistId: string, trackId: string) {
    await httpClient.delete(`/playlists/${playlistId}/tracks/${trackId}`, token);
  },
};
