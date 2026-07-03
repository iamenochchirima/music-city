import {
  artistAnalyticsSummarySchema,
  artistFollowStateSchema,
  trackLikeStateSchema,
  trackSaveStateSchema,
  type AnalyticsEvent,
  type ArtistAnalyticsSummary,
  type PlaybackSession,
  type RecordPlaybackEventInput,
  type TrackSummary,
} from "@music-city/shared";

import { createId } from "../../services/id.service.js";
import { playbackRepository } from "../playback/playback.repository.js";
import { releasesRepository } from "../releases/releases.repository.js";
import { tracksRepository } from "../tracks/tracks.repository.js";
import { usersService } from "../users/users.service.js";
import { engagementRepository } from "./engagement.repository.js";

const QUALIFIED_STREAM_MIN_SECONDS = 30;
const QUALIFIED_STREAM_FRACTION = 0.5;
const ANALYTICS_WINDOWS = new Set([7, 30, 90]);

const nowIso = () => new Date().toISOString();
const ANALYTICS_SOURCE = "server.engagement";

const ensureProfile = async (walletAddress: string) => {
  const profile = await usersService.getProfile(walletAddress);

  if (!profile) {
    throw new Error("Create a profile before using engagement features");
  }

  return profile;
};

const ensureArtist = async (artistId: string) => {
  const artist = await usersService.getProfileById(artistId);

  if (!artist || artist.role !== "artist") {
    throw new Error("Artist not found");
  }

  return artist;
};

const syncTrackLikeCount = async (track: TrackSummary) => {
  const likeCount = await engagementRepository.countTrackLikes(track.id);

  await tracksRepository.upsert({
    ...track,
    likes: likeCount,
    updatedAt: nowIso(),
  });

  return likeCount;
};

const syncTrackPlayCount = async (track: TrackSummary) => {
  const playCount = await engagementRepository.countQualifiedStreamsByTrack(track.id);

  await tracksRepository.upsert({
    ...track,
    plays: playCount,
    updatedAt: nowIso(),
  });

  return playCount;
};

const shouldCountQualifiedStream = (
  maxPositionSeconds: number,
  durationSeconds?: number,
) => {
  const fractionThreshold =
    durationSeconds && durationSeconds > 0
      ? durationSeconds * QUALIFIED_STREAM_FRACTION
      : Number.POSITIVE_INFINITY;

  return (
    maxPositionSeconds >= QUALIFIED_STREAM_MIN_SECONDS ||
    maxPositionSeconds >= fractionThreshold
  );
};

const recordAnalyticsEvent = async (event: AnalyticsEvent) => {
  await engagementRepository.insertAnalyticsEvent(event);
};

export const engagementService = {
  async recordReleaseView(releaseId: string, walletAddress?: string) {
    const release = await releasesRepository.findById(releaseId);

    if (!release || release.status !== "published") {
      throw new Error("Release not found");
    }

    const profile = walletAddress ? await usersService.getProfile(walletAddress) : null;

    await recordAnalyticsEvent({
      id: createId("anl"),
      eventType: "view_release",
      occurredAt: nowIso(),
      actorUserId: profile?.id,
      artistId: release.artistId,
      releaseId: release.id,
      source: ANALYTICS_SOURCE,
      surface: "release_detail",
    });
  },

  async getArtistFollowState(walletAddress: string, artistId: string) {
    const profile = await ensureProfile(walletAddress);
    await ensureArtist(artistId);

    return artistFollowStateSchema.parse({
      following: await engagementRepository.hasArtistFollow(profile.id, artistId),
      followerCount: await engagementRepository.countArtistFollowers(artistId),
    });
  },

  async followArtist(walletAddress: string, artistId: string) {
    const profile = await ensureProfile(walletAddress);
    const artist = await ensureArtist(artistId);
    const occurredAt = nowIso();

    if (profile.id === artist.id) {
      throw new Error("You cannot follow yourself");
    }

    await engagementRepository.upsertArtistFollow(profile.id, artist.id, occurredAt);
    await recordAnalyticsEvent({
      id: createId("anl"),
      eventType: "follow_artist",
      occurredAt,
      actorUserId: profile.id,
      artistId: artist.id,
      source: ANALYTICS_SOURCE,
      surface: "artist_profile",
    });
    return this.getArtistFollowState(walletAddress, artist.id);
  },

  async unfollowArtist(walletAddress: string, artistId: string) {
    const profile = await ensureProfile(walletAddress);
    const artist = await ensureArtist(artistId);
    const occurredAt = nowIso();

    await engagementRepository.deleteArtistFollow(profile.id, artist.id);
    await recordAnalyticsEvent({
      id: createId("anl"),
      eventType: "unfollow_artist",
      occurredAt,
      actorUserId: profile.id,
      artistId: artist.id,
      source: ANALYTICS_SOURCE,
      surface: "artist_profile",
    });
    return this.getArtistFollowState(walletAddress, artist.id);
  },

  async getTrackLikeState(walletAddress: string, trackId: string) {
    const profile = await ensureProfile(walletAddress);
    const track = await tracksRepository.findById(trackId);

    if (!track) {
      throw new Error("Track not found");
    }

    return trackLikeStateSchema.parse({
      liked: await engagementRepository.hasTrackLike(profile.id, trackId),
      likeCount: await engagementRepository.countTrackLikes(trackId),
    });
  },

  async likeTrack(walletAddress: string, trackId: string) {
    const profile = await ensureProfile(walletAddress);
    const track = await tracksRepository.findById(trackId);
    const occurredAt = nowIso();

    if (!track) {
      throw new Error("Track not found");
    }

    if (track.artistId === profile.id) {
      throw new Error("You cannot like your own track");
    }

    await engagementRepository.upsertTrackLike(profile.id, trackId, occurredAt);
    await syncTrackLikeCount(track);
    await recordAnalyticsEvent({
      id: createId("anl"),
      eventType: "like_track",
      occurredAt,
      actorUserId: profile.id,
      artistId: track.artistId,
      trackId: track.id,
      source: ANALYTICS_SOURCE,
      surface: "track_detail",
    });

    return this.getTrackLikeState(walletAddress, trackId);
  },

  async unlikeTrack(walletAddress: string, trackId: string) {
    const profile = await ensureProfile(walletAddress);
    const track = await tracksRepository.findById(trackId);
    const occurredAt = nowIso();

    if (!track) {
      throw new Error("Track not found");
    }

    await engagementRepository.deleteTrackLike(profile.id, trackId);
    await syncTrackLikeCount(track);
    await recordAnalyticsEvent({
      id: createId("anl"),
      eventType: "unlike_track",
      occurredAt,
      actorUserId: profile.id,
      artistId: track.artistId,
      trackId: track.id,
      source: ANALYTICS_SOURCE,
      surface: "track_detail",
    });

    return this.getTrackLikeState(walletAddress, trackId);
  },

  async getTrackSaveState(walletAddress: string, trackId: string) {
    const profile = await ensureProfile(walletAddress);
    const track = await tracksRepository.findById(trackId);

    if (!track) {
      throw new Error("Track not found");
    }

    return trackSaveStateSchema.parse({
      saved: await engagementRepository.hasTrackSave(profile.id, trackId),
      saveCount: await engagementRepository.countTrackSaves(trackId),
    });
  },

  async saveTrack(walletAddress: string, trackId: string) {
    const profile = await ensureProfile(walletAddress);
    const track = await tracksRepository.findById(trackId);
    const occurredAt = nowIso();

    if (!track) {
      throw new Error("Track not found");
    }

    await engagementRepository.upsertTrackSave(profile.id, trackId, occurredAt);
    await recordAnalyticsEvent({
      id: createId("anl"),
      eventType: "save_track",
      occurredAt,
      actorUserId: profile.id,
      artistId: track.artistId,
      trackId: track.id,
      source: ANALYTICS_SOURCE,
      surface: "track_detail",
    });
    return this.getTrackSaveState(walletAddress, trackId);
  },

  async unsaveTrack(walletAddress: string, trackId: string) {
    const profile = await ensureProfile(walletAddress);
    const track = await tracksRepository.findById(trackId);
    const occurredAt = nowIso();

    if (!track) {
      throw new Error("Track not found");
    }

    await engagementRepository.deleteTrackSave(profile.id, trackId);
    await recordAnalyticsEvent({
      id: createId("anl"),
      eventType: "unsave_track",
      occurredAt,
      actorUserId: profile.id,
      artistId: track.artistId,
      trackId: track.id,
      source: ANALYTICS_SOURCE,
      surface: "track_detail",
    });
    return this.getTrackSaveState(walletAddress, trackId);
  },

  async recordPlaybackEvent(
    session: PlaybackSession,
    input: RecordPlaybackEventInput,
  ) {
    const track = await tracksRepository.findById(session.trackId);

    if (!track) {
      throw new Error("Track not found");
    }

    const positionSeconds = Math.max(
      session.maxPositionSeconds ?? 0,
      input.positionSeconds ?? 0,
    );
    const occurredAt = nowIso();

    await engagementRepository.insertPlaybackEvent(
      createId("evt"),
      session.id,
      session.trackId,
      track.artistId,
      session.listenerUserId ?? null,
      input.eventType,
      input.positionSeconds ?? null,
      input.durationSeconds ?? null,
      occurredAt,
      {
        trackId: session.trackId,
        artistId: track.artistId,
        listenerUserId: session.listenerUserId ?? null,
        positionSeconds: input.positionSeconds ?? null,
        durationSeconds: input.durationSeconds ?? null,
      },
    );
    await recordAnalyticsEvent({
      id: createId("anl"),
      eventType:
        input.eventType === "progress"
          ? "track_playback_progress"
          : "track_playback_completed",
      occurredAt,
      actorUserId: session.listenerUserId ?? undefined,
      artistId: track.artistId,
      trackId: session.trackId,
      sessionId: session.id,
      source: ANALYTICS_SOURCE,
      surface: "global_playback_provider",
      positionSeconds: input.positionSeconds ?? undefined,
      durationSeconds: input.durationSeconds ?? undefined,
    });

    let updatedSession: PlaybackSession = {
      ...session,
      artistId: track.artistId,
      maxPositionSeconds: positionSeconds,
    };

    if (input.eventType === "completed") {
      updatedSession = {
        ...updatedSession,
        completedAt: occurredAt,
      };
    }

    const qualifies =
      !updatedSession.qualifiedStreamCountedAt &&
      shouldCountQualifiedStream(positionSeconds, input.durationSeconds);

    if (qualifies) {
      const qualifiedInserted = await engagementRepository.insertQualifiedPlaybackEvent(
        createId("evt"),
        session.id,
        session.trackId,
        track.artistId,
        session.listenerUserId ?? null,
        positionSeconds,
        input.durationSeconds ?? null,
        occurredAt,
        {
          qualifiedBy: input.eventType,
          positionSeconds,
          durationSeconds: input.durationSeconds ?? null,
        },
      );

      if (qualifiedInserted) {
        updatedSession = {
          ...updatedSession,
          qualifiedStreamCountedAt: occurredAt,
        };

        await recordAnalyticsEvent({
          id: createId("anl"),
          eventType: "track_playback_qualified",
          occurredAt,
          actorUserId: session.listenerUserId ?? undefined,
          artistId: track.artistId,
          trackId: session.trackId,
          sessionId: session.id,
          source: ANALYTICS_SOURCE,
          surface: "global_playback_provider",
          positionSeconds,
          durationSeconds: input.durationSeconds ?? undefined,
          qualifiedBy: input.eventType,
        });
        await syncTrackPlayCount(track);
      } else {
        updatedSession = {
          ...updatedSession,
          qualifiedStreamCountedAt:
            (await engagementRepository.findQualifiedStreamCountedAt(session.id)) ??
            updatedSession.qualifiedStreamCountedAt,
        };
      }
    }

    await playbackRepository.upsert(updatedSession);

    return updatedSession;
  },

  async getArtistAnalytics(
    walletAddress: string,
    windowDays?: number | null,
  ): Promise<ArtistAnalyticsSummary> {
    const profile = await ensureProfile(walletAddress);

    if (profile.role !== "artist") {
      throw new Error("Artist analytics are only available for artist accounts");
    }

    const selectedWindowDays =
      windowDays && ANALYTICS_WINDOWS.has(windowDays) ? windowDays : null;

    const tracks = await tracksRepository.listByArtist(profile.id);
    const trackAnalytics = await Promise.all(
      tracks.map(async (track) => {
        const [saves, uniqueListeners, playbackStarts, playbackCompletions] =
          await Promise.all([
            engagementRepository.countTrackSaves(track.id),
            engagementRepository.countUniqueListenersByTrack(track.id),
            engagementRepository.countPlaybackStartsByTrack(track.id),
            engagementRepository.countPlaybackCompletionsByTrack(track.id),
          ]);

        return {
          trackId: track.id,
          title: track.title,
          releaseId: track.releaseId,
          releaseTitle: track.releaseTitle,
          access: track.access,
          status: track.status,
          plays: track.plays,
          likes: track.likes,
          saves,
          uniqueListeners,
          completionRate:
            playbackStarts > 0
              ? Number(((playbackCompletions / playbackStarts) * 100).toFixed(1))
              : 0,
        };
      }),
    );

    const topTracks = [...trackAnalytics]
      .sort((left, right) => right.plays - left.plays || right.likes - left.likes)
      .slice(0, 8);

    const releases = await releasesRepository.listByArtist(profile.id);
    const releaseLookup = new Map(releases.map((release) => [release.id, release]));
    const topReleases = Array.from(
      trackAnalytics.reduce<
        Map<
          string,
          {
            releaseId: string;
            title: string;
            type: "single" | "ep" | "album";
            streams: number;
            likes: number;
            saves: number;
          }
        >
      >((accumulator, track) => {
        if (!track.releaseId) {
          return accumulator;
        }

        const release = releaseLookup.get(track.releaseId);

        if (!release) {
          return accumulator;
        }

        const existing = accumulator.get(track.releaseId);

        if (existing) {
          existing.streams += track.plays;
          existing.likes += track.likes;
          existing.saves += track.saves;
          return accumulator;
        }

        accumulator.set(track.releaseId, {
          releaseId: track.releaseId,
          title: release.title,
          type: release.type,
          streams: track.plays,
          likes: track.likes,
          saves: track.saves,
        });

        return accumulator;
      }, new Map()),
    )
      .map(([, release]) => release)
      .sort((left, right) => right.streams - left.streams || right.likes - left.likes)
      .slice(0, 5);

    const [
      followerCount,
      totalStreams,
      uniqueListeners,
      streamsLast7Days,
      streamsLast30Days,
      dailyStreams,
      dailyFollowerGrowth,
      selectedWindowStreams,
      selectedWindowUniqueListeners,
    ] =
      await Promise.all([
        engagementRepository.countArtistFollowers(profile.id),
        engagementRepository.countQualifiedStreamsByArtist(profile.id),
        engagementRepository.countUniqueListenersByArtist(profile.id),
        engagementRepository.countQualifiedStreamsByArtistSince(profile.id, 7),
        engagementRepository.countQualifiedStreamsByArtistSince(profile.id, 30),
        engagementRepository.listArtistDailyQualifiedStreams(profile.id, selectedWindowDays),
        engagementRepository.listArtistDailyFollowerGrowth(profile.id, selectedWindowDays),
        engagementRepository.countQualifiedStreamsByArtistSince(
          profile.id,
          selectedWindowDays,
        ),
        engagementRepository.countUniqueListenersByArtistSince(
          profile.id,
          selectedWindowDays,
        ),
      ]);

    const followersGainedInSelectedWindow = dailyFollowerGrowth.reduce(
      (sum, point) => sum + point.newFollowers,
      0,
    );
    const followerBaseline = followerCount - followersGainedInSelectedWindow;
    const dailyFollowers = dailyFollowerGrowth.map((point) => ({
      ...point,
      followers: point.followers + Math.max(0, followerBaseline),
    }));

    return artistAnalyticsSummarySchema.parse({
      artistId: profile.id,
      followerCount,
      totalStreams,
      totalLikes: tracks.reduce((sum, track) => sum + track.likes, 0),
      totalSaves: trackAnalytics.reduce((sum, track) => sum + track.saves, 0),
      uniqueListeners,
      totalTracks: tracks.length,
      publishedTracks: tracks.filter((track) => track.access !== "private").length,
      streamsLast7Days,
      streamsLast30Days,
      selectedWindowDays,
      selectedWindowStreams,
      selectedWindowUniqueListeners,
      followersGainedInSelectedWindow,
      topTracks,
      topReleases,
      dailyStreams,
      dailyFollowers,
    });
  },

  async recordPlaylistCreated(input: {
    actorUserId: string;
    playlistId: string;
    visibility: "private" | "public";
  }) {
    await recordAnalyticsEvent({
      id: createId("anl"),
      eventType: "create_playlist",
      occurredAt: nowIso(),
      actorUserId: input.actorUserId,
      playlistId: input.playlistId,
      source: ANALYTICS_SOURCE,
      surface: input.visibility === "public" ? "account_playlist_create_public" : "account_playlist_create_private",
    });
  },

  async recordPlaylistTrackAdded(input: {
    actorUserId: string;
    playlistId: string;
    trackId: string;
    artistId?: string;
  }) {
    await recordAnalyticsEvent({
      id: createId("anl"),
      eventType: "add_playlist_track",
      occurredAt: nowIso(),
      actorUserId: input.actorUserId,
      playlistId: input.playlistId,
      trackId: input.trackId,
      artistId: input.artistId,
      source: ANALYTICS_SOURCE,
      surface: "playlist_manage",
    });
  },

  async recordPlaylistTrackRemoved(input: {
    actorUserId: string;
    playlistId: string;
    trackId: string;
    artistId?: string;
  }) {
    await recordAnalyticsEvent({
      id: createId("anl"),
      eventType: "remove_playlist_track",
      occurredAt: nowIso(),
      actorUserId: input.actorUserId,
      playlistId: input.playlistId,
      trackId: input.trackId,
      artistId: input.artistId,
      source: ANALYTICS_SOURCE,
      surface: "playlist_manage",
    });
  },
};
