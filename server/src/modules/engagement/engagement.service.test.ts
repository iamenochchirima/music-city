import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const { engagementService } = await import("./engagement.service.js");
const { engagementRepository } = await import("./engagement.repository.js");
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
