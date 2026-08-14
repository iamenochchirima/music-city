import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const { playbackService } = await import("./playback.service.js");
const { engagementRepository } = await import("../engagement/engagement.repository.js");
const { tracksService } = await import("../tracks/tracks.service.js");
const { playbackRepository } = await import("./playback.repository.js");
const { storageService } = await import("../../services/storage.service.js");

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

test("createSession returns the direct local media URL for local playback", async () => {
  let capturedSession:
    | Awaited<ReturnType<typeof playbackRepository.upsert>>
    | undefined;
  const recordedEvents: string[] = [];
  const analyticsEvents: string[] = [];

  const cleanup = [
    restore(
      tracksService,
      "getTrackForPlayback",
      (async () => ({
        id: "trk_local",
        title: "Local track",
        artistId: "artist-1",
        artistName: "Artist",
        genre: "Pop",
        runtime: "3:15",
        priceLabel: "Public",
        status: "published" as const,
        access: "public" as const,
        plays: 0,
        likes: 0,
        coverImageUrl: undefined,
        mediaProvider: "local" as const,
        playbackReady: true,
        streamMediaUrl:
          "http://localhost:4319/api/v1/uploads/content/tracks%2Ftrk_local%2Faudio.mp3",
      })) as typeof tracksService.getTrackForPlayback,
    ),
    restore(
      playbackRepository,
      "upsert",
      (async (session) => {
        capturedSession = session;
        return session;
      }) as typeof playbackRepository.upsert,
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
        recordedEvents.push(eventType);
      }) as typeof engagementRepository.insertPlaybackEvent,
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
    const session = await playbackService.createSession("trk_local", "usr_listener");

    assert.equal(
      session.streamUrl,
      "http://localhost:4319/api/v1/uploads/content/tracks%2Ftrk_local%2Faudio.mp3",
    );
    assert.equal(session.provider, "local");
    assert.ok(session.token.length > 0);
    assert.equal(capturedSession?.streamUrl, session.streamUrl);
    assert.deepEqual(recordedEvents, ["started"]);
    assert.deepEqual(analyticsEvents, ["track_playback_started"]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("createSession refreshes signed local media URLs from storage keys", async () => {
  let capturedSession:
    | Awaited<ReturnType<typeof playbackRepository.upsert>>
    | undefined;
  const analyticsEvents: string[] = [];

  const cleanup = [
    restore(
      tracksService,
      "getTrackForPlayback",
      (async () => ({
        id: "trk_signed",
        title: "Signed track",
        artistId: "artist-1",
        artistName: "Artist",
        genre: "Pop",
        runtime: "3:15",
        priceLabel: "Public",
        status: "published" as const,
        access: "public" as const,
        plays: 0,
        likes: 0,
        coverImageUrl: undefined,
        mediaProvider: "local" as const,
        playbackReady: true,
        masterStorageKey: "masters/trk_signed/audio.mp3",
        streamMediaUrl:
          "https://old.example.com/audio.mp3?X-Amz-Expires=300&expired=true",
      })) as typeof tracksService.getTrackForPlayback,
    ),
    restore(
      storageService,
      "getDownloadUrl",
      ((storageKey: string) => `https://fresh.example.com/${encodeURIComponent(storageKey)}`) as typeof storageService.getDownloadUrl,
    ),
    restore(
      playbackRepository,
      "upsert",
      (async (session) => {
        capturedSession = session;
        return session;
      }) as typeof playbackRepository.upsert,
    ),
    restore(
      engagementRepository,
      "insertPlaybackEvent",
      (async () => undefined) as typeof engagementRepository.insertPlaybackEvent,
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
    const session = await playbackService.createSession("trk_signed", "usr_listener");

    assert.equal(
      session.streamUrl,
      "https://fresh.example.com/masters%2Ftrk_signed%2Faudio.mp3",
    );
    assert.equal(capturedSession?.streamUrl, session.streamUrl);
    assert.deepEqual(analyticsEvents, ["track_playback_started"]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("createSession still succeeds when analytics persistence fails", async () => {
  const warnings: string[] = [];
  const cleanup = [
    restore(
      tracksService,
      "getTrackForPlayback",
      (async () => ({
        id: "trk_resilient",
        title: "Resilient track",
        artistId: "artist-1",
        artistName: "Artist",
        genre: "Pop",
        runtime: "3:15",
        priceLabel: "Public",
        status: "published" as const,
        access: "public" as const,
        plays: 0,
        likes: 0,
        mediaProvider: "local" as const,
        playbackReady: true,
        streamMediaUrl: "http://localhost:4319/tracks/trk_resilient.mp3",
      })) as typeof tracksService.getTrackForPlayback,
    ),
    restore(
      playbackRepository,
      "upsert",
      (async (session) => session) as typeof playbackRepository.upsert,
    ),
    restore(
      engagementRepository,
      "insertPlaybackEvent",
      (async () => {
        throw new Error("playback event insert failed");
      }) as typeof engagementRepository.insertPlaybackEvent,
    ),
    restore(
      engagementRepository,
      "insertAnalyticsEvent",
      (async () => {
        throw new Error("analytics event insert failed");
      }) as typeof engagementRepository.insertAnalyticsEvent,
    ),
    restore(
      console,
      "warn",
      ((message?: unknown) => {
        warnings.push(String(message));
      }) as typeof console.warn,
    ),
  ];

  try {
    const session = await playbackService.createSession(
      "trk_resilient",
      "usr_listener",
    );

    assert.equal(session.trackId, "trk_resilient");
    assert.equal(session.provider, "local");
    assert.ok(warnings.some((message) => message.includes("Playback session started")));
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});
