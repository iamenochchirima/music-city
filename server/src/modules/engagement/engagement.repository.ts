import type { AnalyticsEvent } from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export const engagementRepository = {
  async insertAnalyticsEvent(event: AnalyticsEvent) {
    await databaseService.insertAnalyticsEvent(
      event.id,
      event.eventType,
      event.actorUserId ?? null,
      event.artistId ?? null,
      event.trackId ?? null,
      event.releaseId ?? null,
      event.playlistId ?? null,
      event.sessionId ?? null,
      event.occurredAt,
      event,
    );
  },

  async upsertArtistFollow(userId: string, artistId: string, createdAt: string) {
    await databaseService.upsertArtistFollow(userId, artistId, createdAt);
  },

  async deleteArtistFollow(userId: string, artistId: string) {
    await databaseService.deleteArtistFollow(userId, artistId);
  },

  async hasArtistFollow(userId: string, artistId: string) {
    return databaseService.hasArtistFollow(userId, artistId);
  },

  async countArtistFollowers(artistId: string) {
    return databaseService.countArtistFollowers(artistId);
  },

  async upsertTrackLike(userId: string, trackId: string, createdAt: string) {
    await databaseService.upsertTrackLike(userId, trackId, createdAt);
  },

  async deleteTrackLike(userId: string, trackId: string) {
    await databaseService.deleteTrackLike(userId, trackId);
  },

  async hasTrackLike(userId: string, trackId: string) {
    return databaseService.hasTrackLike(userId, trackId);
  },

  async countTrackLikes(trackId: string) {
    return databaseService.countTrackLikes(trackId);
  },

  async upsertTrackSave(userId: string, trackId: string, createdAt: string) {
    await databaseService.upsertTrackSave(userId, trackId, createdAt);
  },

  async deleteTrackSave(userId: string, trackId: string) {
    await databaseService.deleteTrackSave(userId, trackId);
  },

  async hasTrackSave(userId: string, trackId: string) {
    return databaseService.hasTrackSave(userId, trackId);
  },

  async countTrackSaves(trackId: string) {
    return databaseService.countTrackSaves(trackId);
  },

  async insertPlaybackEvent(
    id: string,
    playbackSessionId: string,
    trackId: string,
    artistId: string,
    listenerUserId: string | null,
    eventType: "started" | "progress" | "completed" | "qualified_stream",
    positionSeconds: number | null,
    durationSeconds: number | null,
    occurredAt: string,
    payload: unknown,
  ) {
    await databaseService.insertPlaybackEvent(
      id,
      playbackSessionId,
      trackId,
      artistId,
      listenerUserId,
      eventType,
      positionSeconds,
      durationSeconds,
      occurredAt,
      payload,
    );
  },

  async insertQualifiedPlaybackEvent(
    id: string,
    playbackSessionId: string,
    trackId: string,
    artistId: string,
    listenerUserId: string | null,
    positionSeconds: number | null,
    durationSeconds: number | null,
    occurredAt: string,
    payload: unknown,
  ) {
    return databaseService.insertQualifiedPlaybackEvent(
      id,
      playbackSessionId,
      trackId,
      artistId,
      listenerUserId,
      positionSeconds,
      durationSeconds,
      occurredAt,
      payload,
    );
  },

  async findQualifiedStreamCountedAt(playbackSessionId: string) {
    return databaseService.findQualifiedStreamCountedAt(playbackSessionId);
  },

  async countQualifiedStreamsByTrack(trackId: string) {
    return databaseService.countQualifiedStreamsByTrack(trackId);
  },

  async countPlaybackStartsByTrack(trackId: string) {
    return databaseService.countPlaybackStartsByTrack(trackId);
  },

  async countPlaybackCompletionsByTrack(trackId: string) {
    return databaseService.countPlaybackCompletionsByTrack(trackId);
  },

  async countQualifiedStreamsByArtist(artistId: string) {
    return databaseService.countQualifiedStreamsByArtist(artistId);
  },

  async countQualifiedStreamsByArtistSince(artistId: string, days?: number | null) {
    return databaseService.countQualifiedStreamsByArtistSince(artistId, days);
  },

  async countUniqueListenersByArtist(artistId: string) {
    return databaseService.countUniqueListenersByArtist(artistId);
  },

  async countUniqueListenersByArtistSince(artistId: string, days?: number | null) {
    return databaseService.countUniqueListenersByArtistSince(artistId, days);
  },

  async countUniqueListenersByTrack(trackId: string) {
    return databaseService.countUniqueListenersByTrack(trackId);
  },

  async listArtistDailyQualifiedStreams(artistId: string, days?: number | null) {
    return databaseService.listArtistDailyQualifiedStreams(artistId, days);
  },

  async listArtistDailyFollowerGrowth(artistId: string, days?: number | null) {
    return databaseService.listArtistDailyFollowerGrowth(artistId, days);
  },
};
