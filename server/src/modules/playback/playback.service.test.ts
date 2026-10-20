import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const { playbackService } = await import("./playback.service.js");
const { engagementRepository } = await import("../engagement/engagement.repository.js");
const { tracksService } = await import("../tracks/tracks.service.js");
const { playbackRepository } = await import("./playback.repository.js");
const { storageService } = await import("../../services/storage.service.js");
const { tokenService } = await import("../../services/token.service.js");
const { guestPlaybackRepository } = await import("./guest-playback.repository.js");

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

test("createSession returns a tokenized local media proxy URL", async () => {
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

    assert.match(session.streamUrl, /\/api\/v1\/playback\/sessions\/ply_/);
    assert.match(session.streamUrl, /\/media\?token=/);
    assert.equal(session.provider, "local");
    assert.ok(session.token.length > 0);
    assert.equal(capturedSession?.streamUrl, session.streamUrl);
    assert.deepEqual(recordedEvents, ["started"]);
    assert.deepEqual(analyticsEvents, ["track_playback_started"]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("createSession keeps signed storage URLs behind the local media proxy", async () => {
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

    assert.match(session.streamUrl, /\/api\/v1\/playback\/sessions\/ply_/);
    assert.match(session.streamUrl, /\/media\?token=/);
    assert.equal(capturedSession?.streamUrl, session.streamUrl);
    assert.deepEqual(analyticsEvents, ["track_playback_started"]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("guest sessions are bound to their remaining listening time", async () => {
  const cleanup = [
    restore(
      tracksService,
      "getTrackForPlayback",
      (async () => ({
        id: "trk_guest",
        title: "Guest track",
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
        masterStorageKey: "masters/trk_guest/audio.mp3",
      })) as typeof tracksService.getTrackForPlayback,
    ),
    restore(guestPlaybackRepository, "claimTime", (async () => ({
      maximumSeconds: 195,
      budgetRemainingSeconds: 1500,
      remainingSeconds: 195,
    })) as typeof guestPlaybackRepository.claimTime),
    restore(playbackRepository, "upsert", (async (session) => session) as typeof playbackRepository.upsert),
    restore(engagementRepository, "insertPlaybackEvent", (async () => undefined) as typeof engagementRepository.insertPlaybackEvent),
    restore(engagementRepository, "insertAnalyticsEvent", (async () => undefined) as typeof engagementRepository.insertAnalyticsEvent),
  ];
  try {
    const session = await playbackService.createSession("trk_guest", undefined, "guest-identity");
    assert.equal(session.isGuest, true);
    assert.equal(session.listenerUserId, undefined);
    assert.match(session.streamUrl, /\/media\?token=/);
    assert.doesNotMatch(session.streamUrl, /masters\/trk_guest/);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("guest Mux manifests expose no segments after the remaining allowance", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.includes("mux-playback-id.m3u8")) {
      return new Response(
        "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=128000\nhttps://manifest-oci-us-phoenix-1-vop1.fastly.mux.com/K17/rendition.m3u8?cdn=fastly&expires=123&signature=signed\n",
        { status: 200 },
      );
    }
    return new Response([
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXT-X-TARGETDURATION:4",
      "#EXT-X-MEDIA-SEQUENCE:0",
      "#EXTINF:4.0,",
      "segment-1.ts",
      "#EXTINF:4.0,",
      "segment-2.ts",
      "#EXTINF:4.0,",
      "segment-3.ts",
      "#EXTINF:4.0,",
      "segment-4.ts",
      "#EXT-X-ENDLIST",
    ].join("\n"), { status: 200 });
  }) as typeof fetch;

  try {
    const manifest = await playbackService.getMuxManifest({
      id: "ply_guest",
      trackId: "trk_guest",
      artistId: "artist-1",
      provider: "mux",
      playbackId: "mux-playback-id",
      streamUrl: "https://stream.mux.com/mux-playback-id.m3u8?token=private-mux-token",
      token: "api-playback-token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      guestIdHash: "guest-hash",
      isGuest: true,
      guestRemainingSeconds: 8,
      guestTrackDurationSeconds: 16,
    }, "api-playback-token");

    assert.equal((manifest.match(/#EXTINF:/g) ?? []).length, 2);
    assert.match(manifest, /segment-1\.ts/);
    assert.match(manifest, /segment-2\.ts/);
    assert.doesNotMatch(manifest, /segment-3\.ts|segment-4\.ts/);
    assert.doesNotMatch(manifest, /private-mux-token/);
    assert.ok(requestedUrls.some((url) => url.includes("signature=signed")));
    assert.ok(!requestedUrls[1]?.includes("private-mux-token"));
    assert.match(manifest, /manifest-oci-us-phoenix-1-vop1\.fastly\.mux\.com/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("guest Mux segment proxy preserves Fastly signed chunk URLs", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const session = {
    id: "ply_guest_mux_segment",
    trackId: "trk_guest_mux_segment",
    artistId: "artist-1",
    provider: "mux" as const,
    streamUrl: "https://stream.mux.com/mux-playback-id.m3u8?token=private-mux-token",
    playbackId: "mux-playback-id",
    token: "api-playback-token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    maxPositionSeconds: 0,
    listenedSeconds: 0,
    lastPlaybackEventAt: new Date().toISOString(),
    guestIdHash: "guest-hash",
    isGuest: true,
    guestRemainingSeconds: 16,
    guestTrackDurationSeconds: 16,
  };
  const apiToken = tokenService.issuePlaybackToken({
    playbackSessionId: session.id,
    trackId: session.trackId,
    guestIdHash: session.guestIdHash,
  });
  const cleanup = [
    restore(playbackRepository, "findById", (async () => session) as typeof playbackRepository.findById),
  ];
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.includes("mux-playback-id.m3u8")) {
      return new Response(
        "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=128000\nhttps://manifest-oci-us-phoenix-1-vop1.fastly.mux.com/K17/rendition.m3u8?cdn=fastly&expires=123&signature=signed\n",
        { status: 200 },
      );
    }
    if (url.includes("rendition.m3u8")) {
      return new Response([
        "#EXTM3U",
        "#EXT-X-TARGETDURATION:4",
        "#EXTINF:4.0,",
        "https://chunk-oci-us-phoenix-1-vop1.fastly.mux.com/v1/chunk/signed-chunk/0.ts?signature=signed&zone=phx",
        "#EXT-X-ENDLIST",
      ].join("\n"), { status: 200 });
    }
    return new Response(new Uint8Array([71, 64, 0, 48]), {
      status: 200,
      headers: { "Content-Type": "video/MP2T" },
    });
  }) as typeof fetch;

  try {
    const chunkUrl = "https://chunk-oci-us-phoenix-1-vop1.fastly.mux.com/v1/chunk/signed-chunk/0.ts?signature=signed&zone=phx";
    const response = await playbackService.getMuxSegment(session.id, apiToken, chunkUrl);
    assert.equal(response.status, 200);
    assert.ok(requestedUrls.at(-1)?.includes("signature=signed"));
    assert.ok(!requestedUrls.at(-1)?.includes("private-mux-token"));
  } finally {
    globalThis.fetch = originalFetch;
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
