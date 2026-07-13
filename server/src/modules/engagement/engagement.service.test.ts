import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const { engagementService } = await import("./engagement.service.js");
const { engagementRepository } = await import("./engagement.repository.js");
const { releasesRepository } = await import("../releases/releases.repository.js");
const { usersService } = await import("../users/users.service.js");
const { tracksRepository } = await import("../tracks/tracks.repository.js");
const { playbackRepository } = await import("../playback/playback.repository.js");

const baseTimestamp = new Date(0).toISOString();

const createFanProfile = () => ({
  id: "usr-listener",
  walletAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  email: "",
  displayName: "Listener",
  role: "fan" as const,
  artistOnboardingFeePaid: false,
  location: "",
  profileImageUrl: undefined,
  profileImageStorageKey: undefined,
  headerImageUrl: undefined,
  headerImageStorageKey: undefined,
  verified: false,
  createdAt: baseTimestamp,
  updatedAt: baseTimestamp,
});

const createArtistProfile = () => ({
  id: "usr-artist",
  walletAddress: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
  email: "",
  displayName: "Artist",
  role: "artist" as const,
  artistOnboardingFeePaid: true,
  location: "",
  profileImageUrl: undefined,
  profileImageStorageKey: undefined,
  headerImageUrl: undefined,
  headerImageStorageKey: undefined,
  verified: true,
  createdAt: baseTimestamp,
  updatedAt: baseTimestamp,
});

const restore = <T extends object, K extends keyof T>(
  target: T,
  key: K,
  replacement: T[K],
) => {
  const original = target[key];
  target[key] = replacement;
  return () => {
    target[key] = original;
  };
};

test("followArtist stores the follow and returns the refreshed state", async () => {
  const analyticsEvents: string[] = [];
  const cleanup = [
    restore(
      usersService,
      "getProfile",
      (async () => createFanProfile()) as typeof usersService.getProfile,
    ),
    restore(
      usersService,
      "getProfileById",
      (async () => createArtistProfile()) as typeof usersService.getProfileById,
    ),
    restore(
      engagementRepository,
      "upsertArtistFollow",
      (async () => undefined) as typeof engagementRepository.upsertArtistFollow,
    ),
    restore(
      engagementRepository,
      "hasArtistFollow",
      (async () => true) as typeof engagementRepository.hasArtistFollow,
    ),
    restore(
      engagementRepository,
      "countArtistFollowers",
      (async () => 7) as typeof engagementRepository.countArtistFollowers,
    ),
    restore(
      engagementRepository,
      "insertAnalyticsEvent",
      (async (event) => {
        analyticsEvents.push(event.eventType);
      }) as typeof engagementRepository.insertAnalyticsEvent,
    ),
  ];

  try {
    const state = await engagementService.followArtist("wallet-1", "usr-artist");

    assert.deepEqual(state, {
      following: true,
      followerCount: 7,
    });
    assert.deepEqual(analyticsEvents, ["follow_artist"]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("unfollowArtist removes the follow and returns the refreshed state", async () => {
  const analyticsEvents: string[] = [];
  const cleanup = [
    restore(
      usersService,
      "getProfile",
      (async () => createFanProfile()) as typeof usersService.getProfile,
    ),
    restore(
      usersService,
      "getProfileById",
      (async () => createArtistProfile()) as typeof usersService.getProfileById,
    ),
    restore(
      engagementRepository,
      "deleteArtistFollow",
      (async () => undefined) as typeof engagementRepository.deleteArtistFollow,
    ),
    restore(
      engagementRepository,
      "hasArtistFollow",
      (async () => false) as typeof engagementRepository.hasArtistFollow,
    ),
    restore(
      engagementRepository,
      "countArtistFollowers",
      (async () => 6) as typeof engagementRepository.countArtistFollowers,
    ),
    restore(
      engagementRepository,
      "insertAnalyticsEvent",
      (async (event) => {
        analyticsEvents.push(event.eventType);
      }) as typeof engagementRepository.insertAnalyticsEvent,
    ),
  ];

  try {
    const state = await engagementService.unfollowArtist("wallet-1", "usr-artist");

    assert.deepEqual(state, {
      following: false,
      followerCount: 6,
    });
    assert.deepEqual(analyticsEvents, ["unfollow_artist"]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("likeTrack updates the authoritative like count before returning state", async () => {
  const upserts: unknown[] = [];
  const analyticsEvents: string[] = [];

  const cleanup = [
    restore(
      usersService,
      "getProfile",
      (async () => createFanProfile()) as typeof usersService.getProfile,
    ),
    restore(
      tracksRepository,
      "findById",
      (async () => ({
        id: "trk-1",
        title: "First",
        artistId: "usr-artist",
        artistName: "Artist",
        genre: "Pop",
        runtime: "3:00",
        priceLabel: "Public",
        status: "published",
        access: "public",
        plays: 2,
        likes: 0,
      })) as typeof tracksRepository.findById,
    ),
    restore(
      tracksRepository,
      "upsert",
      (async (track) => {
        upserts.push(track);
        return track;
      }) as typeof tracksRepository.upsert,
    ),
    restore(
      engagementRepository,
      "upsertTrackLike",
      (async () => undefined) as typeof engagementRepository.upsertTrackLike,
    ),
    restore(
      engagementRepository,
      "countTrackLikes",
      (async () => 4) as typeof engagementRepository.countTrackLikes,
    ),
    restore(
      engagementRepository,
      "hasTrackLike",
      (async () => true) as typeof engagementRepository.hasTrackLike,
    ),
    restore(
      engagementRepository,
      "insertAnalyticsEvent",
      (async (event) => {
        analyticsEvents.push(event.eventType);
      }) as typeof engagementRepository.insertAnalyticsEvent,
    ),
  ];

  try {
    const state = await engagementService.likeTrack("wallet-1", "trk-1");

    assert.deepEqual(state, {
      liked: true,
      likeCount: 4,
    });
    assert.equal(upserts.length, 1);
    assert.equal((upserts[0] as { likes: number }).likes, 4);
    assert.deepEqual(analyticsEvents, ["like_track"]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("unlikeTrack updates the authoritative like count before returning state", async () => {
  const upserts: unknown[] = [];
  const analyticsEvents: string[] = [];

  const cleanup = [
    restore(
      usersService,
      "getProfile",
      (async () => createFanProfile()) as typeof usersService.getProfile,
    ),
    restore(
      tracksRepository,
      "findById",
      (async () => ({
        id: "trk-1",
        title: "First",
        artistId: "usr-artist",
        artistName: "Artist",
        genre: "Pop",
        runtime: "3:00",
        priceLabel: "Public",
        status: "published",
        access: "public",
        plays: 2,
        likes: 5,
      })) as typeof tracksRepository.findById,
    ),
    restore(
      tracksRepository,
      "upsert",
      (async (track) => {
        upserts.push(track);
        return track;
      }) as typeof tracksRepository.upsert,
    ),
    restore(
      engagementRepository,
      "deleteTrackLike",
      (async () => undefined) as typeof engagementRepository.deleteTrackLike,
    ),
    restore(
      engagementRepository,
      "countTrackLikes",
      (async () => 4) as typeof engagementRepository.countTrackLikes,
    ),
    restore(
      engagementRepository,
      "hasTrackLike",
      (async () => false) as typeof engagementRepository.hasTrackLike,
    ),
    restore(
      engagementRepository,
      "insertAnalyticsEvent",
      (async (event) => {
        analyticsEvents.push(event.eventType);
      }) as typeof engagementRepository.insertAnalyticsEvent,
    ),
  ];

  try {
    const state = await engagementService.unlikeTrack("wallet-1", "trk-1");

    assert.deepEqual(state, {
      liked: false,
      likeCount: 4,
    });
    assert.equal(upserts.length, 1);
    assert.equal((upserts[0] as { likes: number }).likes, 4);
    assert.deepEqual(analyticsEvents, ["unlike_track"]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("saveTrack and unsaveTrack return the refreshed saved state", async () => {
  let saved = false;
  const analyticsEvents: string[] = [];

  const cleanup = [
    restore(
      usersService,
      "getProfile",
      (async () => createFanProfile()) as typeof usersService.getProfile,
    ),
    restore(
      tracksRepository,
      "findById",
      (async () => ({
        id: "trk-1",
        title: "First",
        artistId: "usr-artist",
        artistName: "Artist",
        genre: "Pop",
        runtime: "3:00",
        priceLabel: "Public",
        status: "published",
        access: "public",
        plays: 2,
        likes: 0,
      })) as typeof tracksRepository.findById,
    ),
    restore(
      engagementRepository,
      "upsertTrackSave",
      (async () => {
        saved = true;
      }) as typeof engagementRepository.upsertTrackSave,
    ),
    restore(
      engagementRepository,
      "deleteTrackSave",
      (async () => {
        saved = false;
      }) as typeof engagementRepository.deleteTrackSave,
    ),
    restore(
      engagementRepository,
      "hasTrackSave",
      (async () => saved) as typeof engagementRepository.hasTrackSave,
    ),
    restore(
      engagementRepository,
      "countTrackSaves",
      (async () => (saved ? 5 : 4)) as typeof engagementRepository.countTrackSaves,
    ),
    restore(
      engagementRepository,
      "insertAnalyticsEvent",
      (async (event) => {
        analyticsEvents.push(event.eventType);
      }) as typeof engagementRepository.insertAnalyticsEvent,
    ),
  ];

  try {
    const savedState = await engagementService.saveTrack("wallet-1", "trk-1");
    assert.deepEqual(savedState, {
      saved: true,
      saveCount: 5,
    });

    const unsavedState = await engagementService.unsaveTrack("wallet-1", "trk-1");
    assert.deepEqual(unsavedState, {
      saved: false,
      saveCount: 4,
    });
    assert.deepEqual(analyticsEvents, ["save_track", "unsave_track"]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("recordReleaseView stores a release analytics event for anonymous or signed-in listeners", async () => {
  const analyticsEvents: Array<{
    eventType: string;
    actorUserId?: string;
    artistId?: string;
    releaseId?: string;
  }> = [];

  const cleanup = [
    restore(
      releasesRepository,
      "findById",
      (async () => ({
        id: "rel-1",
        artistId: "usr-artist",
        artistName: "Artist",
        title: "Release",
        type: "album",
        status: "published",
        genre: "Pop",
        trackCount: 3,
      })) as typeof releasesRepository.findById,
    ),
    restore(
      usersService,
      "getProfile",
      (async () => createFanProfile()) as typeof usersService.getProfile,
    ),
    restore(
      engagementRepository,
      "insertAnalyticsEvent",
      (async (event) => {
        analyticsEvents.push({
          eventType: event.eventType,
          actorUserId: event.actorUserId,
          artistId: event.artistId,
          releaseId: event.releaseId,
        });
      }) as typeof engagementRepository.insertAnalyticsEvent,
    ),
  ];

  try {
    await engagementService.recordReleaseView("rel-1");
    await engagementService.recordReleaseView("rel-1", "wallet-1");

    assert.deepEqual(analyticsEvents, [
      {
        eventType: "view_release",
        actorUserId: undefined,
        artistId: "usr-artist",
        releaseId: "rel-1",
      },
      {
        eventType: "view_release",
        actorUserId: "usr-listener",
        artistId: "usr-artist",
        releaseId: "rel-1",
      },
    ]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("getArtistAnalytics returns save totals and selected window metrics", async () => {
  const cleanup = [
    restore(
      usersService,
      "getProfile",
      (async () => createArtistProfile()) as typeof usersService.getProfile,
    ),
    restore(
      tracksRepository,
      "listByArtist",
      (async () => [
        {
          id: "trk-1",
          title: "First",
          artistId: "usr-artist",
          artistName: "Artist",
          releaseId: "rel-1",
          releaseTitle: "Release One",
          genre: "Pop",
          runtime: "3:00",
          priceLabel: "Public",
          status: "published",
          access: "public",
          plays: 20,
          likes: 5,
        },
        {
          id: "trk-2",
          title: "Second",
          artistId: "usr-artist",
          artistName: "Artist",
          releaseId: "rel-2",
          releaseTitle: "Release Two",
          genre: "Soul",
          runtime: "4:00",
          priceLabel: "Subscribers",
          status: "published",
          access: "subscribers",
          plays: 12,
          likes: 3,
        },
      ]) as typeof tracksRepository.listByArtist,
    ),
    restore(
      releasesRepository,
      "listByArtist",
      (async () => [
        {
          id: "rel-1",
          artistId: "usr-artist",
          artistName: "Artist",
          title: "Release One",
          type: "single",
          status: "published",
          genre: "Pop",
          trackCount: 1,
        },
        {
          id: "rel-2",
          artistId: "usr-artist",
          artistName: "Artist",
          title: "Release Two",
          type: "ep",
          status: "published",
          genre: "Soul",
          trackCount: 1,
        },
      ]) as typeof releasesRepository.listByArtist,
    ),
    restore(
      engagementRepository,
      "countTrackSaves",
      (async (trackId: string) => (trackId === "trk-1" ? 4 : 2)) as typeof engagementRepository.countTrackSaves,
    ),
    restore(
      engagementRepository,
      "countUniqueListenersByTrack",
      (async (trackId: string) => (trackId === "trk-1" ? 9 : 6)) as typeof engagementRepository.countUniqueListenersByTrack,
    ),
    restore(
      engagementRepository,
      "countPlaybackStartsByTrack",
      (async (trackId: string) => (trackId === "trk-1" ? 10 : 3)) as typeof engagementRepository.countPlaybackStartsByTrack,
    ),
    restore(
      engagementRepository,
      "countPlaybackCompletionsByTrack",
      (async (trackId: string) => (trackId === "trk-1" ? 8 : 1)) as typeof engagementRepository.countPlaybackCompletionsByTrack,
    ),
    restore(
      engagementRepository,
      "countArtistFollowers",
      (async () => 14) as typeof engagementRepository.countArtistFollowers,
    ),
    restore(
      engagementRepository,
      "countQualifiedStreamsByArtist",
      (async () => 32) as typeof engagementRepository.countQualifiedStreamsByArtist,
    ),
    restore(
      engagementRepository,
      "countUniqueListenersByArtist",
      (async () => 11) as typeof engagementRepository.countUniqueListenersByArtist,
    ),
    restore(
      engagementRepository,
      "countQualifiedStreamsByArtistSince",
      (async (_artistId: string, days?: number | null) =>
        days === 7 ? 7 : days === 30 ? 18 : days === 90 ? 27 : 32) as typeof engagementRepository.countQualifiedStreamsByArtistSince,
    ),
    restore(
      engagementRepository,
      "countUniqueListenersByArtistSince",
      (async (_artistId: string, days?: number | null) =>
        days === 90 ? 10 : days === 30 ? 8 : days === 7 ? 4 : 11) as typeof engagementRepository.countUniqueListenersByArtistSince,
    ),
    restore(
      engagementRepository,
      "listArtistDailyQualifiedStreams",
      (async (_artistId: string, days?: number | null) =>
        days === 90
          ? [
              { date: "2026-04-10", streams: 3 },
              { date: "2026-06-30", streams: 5 },
            ]
          : [{ date: "2026-06-30", streams: 5 }]) as typeof engagementRepository.listArtistDailyQualifiedStreams,
    ),
    restore(
      engagementRepository,
      "listArtistDailyFollowerGrowth",
      (async (_artistId: string, days?: number | null) =>
        days === 90
          ? [
              { date: "2026-04-10", newFollowers: 2, followers: 2 },
              { date: "2026-06-30", newFollowers: 1, followers: 3 },
            ]
          : [{ date: "2026-06-30", newFollowers: 1, followers: 1 }]) as typeof engagementRepository.listArtistDailyFollowerGrowth,
    ),
  ];

  try {
    const analytics = await engagementService.getArtistAnalytics("wallet-1", 90);

    assert.equal(analytics.totalSaves, 6);
    assert.equal(analytics.selectedWindowDays, 90);
    assert.equal(analytics.selectedWindowStreams, 27);
    assert.equal(analytics.selectedWindowUniqueListeners, 10);
    assert.equal(analytics.followersGainedInSelectedWindow, 3);
    assert.deepEqual(
      analytics.topTracks.map((track) => ({
        trackId: track.trackId,
        saves: track.saves,
        uniqueListeners: track.uniqueListeners,
        completionRate: track.completionRate,
      })),
      [
        {
          trackId: "trk-1",
          saves: 4,
          uniqueListeners: 9,
          completionRate: 80,
        },
        {
          trackId: "trk-2",
          saves: 2,
          uniqueListeners: 6,
          completionRate: 33.3,
        },
      ],
    );
    assert.deepEqual(analytics.topReleases, [
      {
        releaseId: "rel-1",
        title: "Release One",
        type: "single",
        streams: 20,
        likes: 5,
        saves: 4,
      },
      {
        releaseId: "rel-2",
        title: "Release Two",
        type: "ep",
        streams: 12,
        likes: 3,
        saves: 2,
      },
    ]);
    assert.deepEqual(analytics.dailyFollowers, [
      {
        date: "2026-04-10",
        newFollowers: 2,
        followers: 13,
      },
      {
        date: "2026-06-30",
        newFollowers: 1,
        followers: 14,
      },
    ]);
    assert.deepEqual(analytics.dailyStreams, [
      { date: "2026-04-10", streams: 3 },
      { date: "2026-06-30", streams: 5 },
    ]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("recordPlaybackEvent keeps partial plays without counting a qualified stream", async () => {
  const events: string[] = [];
  const analyticsEvents: string[] = [];
  let savedSession: unknown;

  const cleanup = [
    restore(
      tracksRepository,
      "findById",
      (async () => ({
        id: "trk-1",
        title: "First",
        artistId: "usr-artist",
        artistName: "Artist",
        genre: "Pop",
        runtime: "3:00",
        priceLabel: "Public",
        status: "published",
        access: "public",
        plays: 2,
        likes: 1,
      })) as typeof tracksRepository.findById,
    ),
    restore(
      engagementRepository,
      "insertPlaybackEvent",
      (async (
        _id,
        _sessionId,
        _trackId,
        _artistId,
        _listenerUserId,
        eventType,
      ) => {
        events.push(eventType);
      }) as typeof engagementRepository.insertPlaybackEvent,
    ),
    restore(
      engagementRepository,
      "insertQualifiedPlaybackEvent",
      (async () => {
        throw new Error("qualified stream should not be inserted");
      }) as typeof engagementRepository.insertQualifiedPlaybackEvent,
    ),
    restore(
      engagementRepository,
      "insertAnalyticsEvent",
      (async (event) => {
        analyticsEvents.push(event.eventType);
      }) as typeof engagementRepository.insertAnalyticsEvent,
    ),
    restore(
      playbackRepository,
      "upsert",
      (async (session) => {
        savedSession = session;
        return session;
      }) as typeof playbackRepository.upsert,
    ),
  ];

  try {
    const session = await engagementService.recordPlaybackEvent(
      {
        id: "ply-1",
        trackId: "trk-1",
        artistId: "usr-artist",
        listenerUserId: "usr-listener",
        provider: "local",
        streamUrl: "https://example.com/audio.mp3",
        token: "token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        maxPositionSeconds: 12,
      },
      {
        eventType: "progress",
        positionSeconds: 20,
        durationSeconds: 180,
      },
    );

    assert.deepEqual(events, ["progress"]);
    assert.deepEqual(analyticsEvents, ["track_playback_progress"]);
    assert.equal(session.qualifiedStreamCountedAt, undefined);
    assert.equal(session.maxPositionSeconds, 20);
    assert.equal((savedSession as { maxPositionSeconds: number }).maxPositionSeconds, 20);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("recordPlaybackEvent counts a qualified stream once when the threshold is first met", async () => {
  const events: string[] = [];
  const analyticsEvents: string[] = [];
  const trackUpserts: unknown[] = [];

  const cleanup = [
    restore(
      tracksRepository,
      "findById",
      (async () => ({
        id: "trk-1",
        title: "First",
        artistId: "usr-artist",
        artistName: "Artist",
        genre: "Pop",
        runtime: "3:00",
        priceLabel: "Public",
        status: "published",
        access: "public",
        plays: 2,
        likes: 1,
      })) as typeof tracksRepository.findById,
    ),
    restore(
      tracksRepository,
      "upsert",
      (async (track) => {
        trackUpserts.push(track);
        return track;
      }) as typeof tracksRepository.upsert,
    ),
    restore(
      engagementRepository,
      "insertPlaybackEvent",
      (async (
        _id,
        _sessionId,
        _trackId,
        _artistId,
        _listenerUserId,
        eventType,
      ) => {
        events.push(eventType);
      }) as typeof engagementRepository.insertPlaybackEvent,
    ),
    restore(
      engagementRepository,
      "insertQualifiedPlaybackEvent",
      (async (
        _id,
        _sessionId,
        _trackId,
        _artistId,
        _listenerUserId,
        _positionSeconds,
        _durationSeconds,
        _occurredAt,
      ) => {
        events.push("qualified_stream");
        return true;
      }) as typeof engagementRepository.insertQualifiedPlaybackEvent,
    ),
    restore(
      engagementRepository,
      "countQualifiedStreamsByTrack",
      (async () => 3) as typeof engagementRepository.countQualifiedStreamsByTrack,
    ),
    restore(
      engagementRepository,
      "insertAnalyticsEvent",
      (async (event) => {
        analyticsEvents.push(event.eventType);
      }) as typeof engagementRepository.insertAnalyticsEvent,
    ),
    restore(
      playbackRepository,
      "upsert",
      (async (session) => session) as typeof playbackRepository.upsert,
    ),
  ];

  try {
    const session = await engagementService.recordPlaybackEvent(
      {
        id: "ply-1",
        trackId: "trk-1",
        artistId: "usr-artist",
        listenerUserId: "usr-listener",
        provider: "local",
        streamUrl: "https://example.com/audio.mp3",
        token: "token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        maxPositionSeconds: 12,
      },
      {
        eventType: "progress",
        positionSeconds: 31,
        durationSeconds: 180,
      },
    );

    assert.deepEqual(events, ["progress", "qualified_stream"]);
    assert.deepEqual(analyticsEvents, [
      "track_playback_progress",
      "track_playback_qualified",
    ]);
    assert.ok(session.qualifiedStreamCountedAt);
    assert.equal(trackUpserts.length, 1);
    assert.equal((trackUpserts[0] as { plays: number }).plays, 3);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("recordPlaybackEvent preserves the original qualified timestamp when a duplicate is suppressed", async () => {
  const countedAt = new Date("2026-07-02T10:00:00.000Z").toISOString();
  const analyticsEvents: string[] = [];
  const trackUpserts: unknown[] = [];

  const cleanup = [
    restore(
      tracksRepository,
      "findById",
      (async () => ({
        id: "trk-1",
        title: "First",
        artistId: "usr-artist",
        artistName: "Artist",
        genre: "Pop",
        runtime: "3:00",
        priceLabel: "Public",
        status: "published",
        access: "public",
        plays: 2,
        likes: 1,
      })) as typeof tracksRepository.findById,
    ),
    restore(
      tracksRepository,
      "upsert",
      (async (track) => {
        trackUpserts.push(track);
        return track;
      }) as typeof tracksRepository.upsert,
    ),
    restore(
      engagementRepository,
      "insertPlaybackEvent",
      (async () => undefined) as typeof engagementRepository.insertPlaybackEvent,
    ),
    restore(
      engagementRepository,
      "insertQualifiedPlaybackEvent",
      (async () => false) as typeof engagementRepository.insertQualifiedPlaybackEvent,
    ),
    restore(
      engagementRepository,
      "findQualifiedStreamCountedAt",
      (async () => countedAt) as typeof engagementRepository.findQualifiedStreamCountedAt,
    ),
    restore(
      engagementRepository,
      "insertAnalyticsEvent",
      (async (event) => {
        analyticsEvents.push(event.eventType);
      }) as typeof engagementRepository.insertAnalyticsEvent,
    ),
    restore(
      playbackRepository,
      "upsert",
      (async (session) => session) as typeof playbackRepository.upsert,
    ),
  ];

  try {
    const session = await engagementService.recordPlaybackEvent(
      {
        id: "ply-1",
        trackId: "trk-1",
        artistId: "usr-artist",
        listenerUserId: "usr-listener",
        provider: "local",
        streamUrl: "https://example.com/audio.mp3",
        token: "token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        maxPositionSeconds: 12,
      },
      {
        eventType: "completed",
        positionSeconds: 180,
        durationSeconds: 180,
      },
    );

    assert.equal(session.qualifiedStreamCountedAt, countedAt);
    assert.ok(session.completedAt);
    assert.equal(trackUpserts.length, 0);
    assert.deepEqual(analyticsEvents, ["track_playback_completed"]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});
