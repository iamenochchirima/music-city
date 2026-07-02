import type {
  ArtistAnalyticsSummary,
  ArtistFollowState,
  PlaybackSession,
  RecordPlaybackEventInput,
  TrackLikeState,
  TrackSaveState,
} from "@music-city/shared";

import { httpClient } from "@/lib/api/http-client";

export const engagementApi = {
  async getArtistFollowState(token: string, artistId: string) {
    const response = await httpClient.get<{ state: ArtistFollowState }>(
      `/engagement/artists/${artistId}/follow-state`,
      token,
    );

    return response.state;
  },

  async followArtist(token: string, artistId: string) {
    const response = await httpClient.post<{ state: ArtistFollowState }>(
      `/engagement/artists/${artistId}/follow`,
      {},
      token,
    );

    return response.state;
  },

  async unfollowArtist(token: string, artistId: string) {
    const response = await httpClient.delete<{ state: ArtistFollowState }>(
      `/engagement/artists/${artistId}/follow`,
      token,
    );
    return response.state;
  },

  async getTrackLikeState(token: string, trackId: string) {
    const response = await httpClient.get<{ state: TrackLikeState }>(
      `/engagement/tracks/${trackId}/like-state`,
      token,
    );

    return response.state;
  },

  async likeTrack(token: string, trackId: string) {
    const response = await httpClient.post<{ state: TrackLikeState }>(
      `/engagement/tracks/${trackId}/like`,
      {},
      token,
    );

    return response.state;
  },

  async unlikeTrack(token: string, trackId: string) {
    const response = await httpClient.delete<{ state: TrackLikeState }>(
      `/engagement/tracks/${trackId}/like`,
      token,
    );
    return response.state;
  },

  async getTrackSaveState(token: string, trackId: string) {
    const response = await httpClient.get<{ state: TrackSaveState }>(
      `/engagement/tracks/${trackId}/save-state`,
      token,
    );

    return response.state;
  },

  async saveTrack(token: string, trackId: string) {
    const response = await httpClient.post<{ state: TrackSaveState }>(
      `/engagement/tracks/${trackId}/save`,
      {},
      token,
    );

    return response.state;
  },

  async unsaveTrack(token: string, trackId: string) {
    const response = await httpClient.delete<{ state: TrackSaveState }>(
      `/engagement/tracks/${trackId}/save`,
      token,
    );

    return response.state;
  },

  async recordReleaseView(releaseId: string, token?: string) {
    await httpClient.post(`/engagement/releases/${releaseId}/view`, {}, token);
  },

  async getMyArtistAnalytics(token: string, windowDays?: 7 | 30 | 90) {
    const response = await httpClient.get<{ analytics: ArtistAnalyticsSummary }>(
      `/engagement/analytics/me/artist${
        windowDays ? `?windowDays=${windowDays}` : ""
      }`,
      token,
    );

    return response.analytics;
  },

  async recordPlaybackEvent(
    token: string,
    playbackSession: PlaybackSession,
    input: RecordPlaybackEventInput,
  ) {
    const response = await httpClient.post<{ playbackSession: PlaybackSession }>(
      `/playback/sessions/${playbackSession.id}/events`,
      {
        ...input,
        token: playbackSession.token,
      },
      token,
    );

    return response.playbackSession;
  },
};
