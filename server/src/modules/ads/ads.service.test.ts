import assert from "node:assert/strict";
import test from "node:test";
import type { AdImpressionRecord } from "@music-city/shared";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const { adsService } = await import("./ads.service.js");
const { adsRepository } = await import("./ads.repository.js");
const { entitlementsService } = await import("../entitlements/entitlements.service.js");
const { subscriptionsService } = await import("../subscriptions/subscriptions.service.js");
const { tracksService } = await import("../tracks/tracks.service.js");
const { usersService } = await import("../users/users.service.js");

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

const fanWallet = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const artistWallet = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

const createTrack = () => ({
  id: "trk_public_1",
  title: "City Lights",
  artistId: "artist_1",
  artistName: "Artist One",
  genre: "Pop",
  runtime: "3:20",
  priceLabel: "Public",
  status: "published" as const,
  access: "public" as const,
  plays: 0,
  likes: 0,
  playbackReady: true,
});

const createActiveAd = () => ({
  id: "ad_1",
  name: "Weekend Launch",
  brandName: "Brand One",
  status: "active" as const,
  slot: "preroll" as const,
  audioUrl: "https://cdn.example.com/ad-1.mp3",
  priority: 100,
  weight: 10,
  targetAccess: "public" as const,
  maxImpressionsPerWalletPerDay: 3,
  createdAt: "2026-07-02T10:00:00.000Z",
  updatedAt: "2026-07-02T10:00:00.000Z",
 });

test("getPlaybackAdDecision skips ads for subscribed listeners", async () => {
  const cleanup = [
    restore(
      tracksService,
      "getTrackForPlayback",
      (async () => createTrack()) as typeof tracksService.getTrackForPlayback,
    ),
    restore(
      usersService,
      "getProfile",
      (async () => ({
        id: "fan_1",
      })) as unknown as typeof usersService.getProfile,
    ),
    restore(
      subscriptionsService,
      "hasActivePlatformSubscription",
      (async () => true) as typeof subscriptionsService.hasActivePlatformSubscription,
    ),
    restore(
      entitlementsService,
      "findMineForTrack",
      (async () => undefined) as typeof entitlementsService.findMineForTrack,
    ),
    restore(
      adsRepository,
      "listAds",
      (async () => [createActiveAd()]) as typeof adsRepository.listAds,
    ),
  ];

  try {
    const decision = await adsService.getPlaybackAdDecision(fanWallet, "trk_public_1");

    assert.equal(decision.serveAd, false);
    assert.match(decision.reason ?? "", /active platform subscription/i);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("getPlaybackAdDecision returns an eligible ad and creates a pending impression", async () => {
  const insertedImpressions: string[] = [];

  const cleanup = [
    restore(
      tracksService,
      "getTrackForPlayback",
      (async () => createTrack()) as typeof tracksService.getTrackForPlayback,
    ),
    restore(
      usersService,
      "getProfile",
      (async () => ({
        id: "fan_1",
      })) as unknown as typeof usersService.getProfile,
    ),
    restore(
      subscriptionsService,
      "hasActivePlatformSubscription",
      (async () => false) as typeof subscriptionsService.hasActivePlatformSubscription,
    ),
    restore(
      entitlementsService,
      "findMineForTrack",
      (async () => undefined) as typeof entitlementsService.findMineForTrack,
    ),
    restore(
      adsRepository,
      "listAds",
      (async () => [createActiveAd()]) as typeof adsRepository.listAds,
    ),
    restore(
      adsRepository,
      "countAdImpressionsForWalletSince",
      (async () => 0) as typeof adsRepository.countAdImpressionsForWalletSince,
    ),
    restore(
      adsRepository,
      "upsertAdImpression",
      (async (impression) => {
        insertedImpressions.push(impression.status);
        return impression;
      }) as typeof adsRepository.upsertAdImpression,
    ),
  ];

  try {
    const decision = await adsService.getPlaybackAdDecision(fanWallet, "trk_public_1");

    assert.equal(decision.serveAd, true);
    assert.equal(decision.ad?.id, "ad_1");
    assert.ok(decision.impressionId);
    assert.deepEqual(insertedImpressions, ["pending"]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("getPlaybackAdDecision skips ads for purchased-track playback", async () => {
  const cleanup = [
    restore(
      tracksService,
      "getTrackForPlayback",
      (async () => createTrack()) as typeof tracksService.getTrackForPlayback,
    ),
    restore(
      usersService,
      "getProfile",
      (async () => ({
        id: "fan_1",
      })) as unknown as typeof usersService.getProfile,
    ),
    restore(
      subscriptionsService,
      "hasActivePlatformSubscription",
      (async () => false) as typeof subscriptionsService.hasActivePlatformSubscription,
    ),
    restore(
      entitlementsService,
      "findMineForTrack",
      (async () => ({
        id: "ent_1",
        walletAddress: fanWallet,
        trackId: "trk_public_1",
        source: "purchase" as const,
        startsAt: "2026-07-02T10:00:00.000Z",
      })) as typeof entitlementsService.findMineForTrack,
    ),
    restore(
      adsRepository,
      "listAds",
      (async () => [createActiveAd()]) as typeof adsRepository.listAds,
    ),
  ];

  try {
    const decision = await adsService.getPlaybackAdDecision(fanWallet, "trk_public_1");

    assert.equal(decision.serveAd, false);
    assert.match(decision.reason ?? "", /ad-free/i);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("getPlaybackAdDecision skips ads when the listener reached the daily cap", async () => {
  let impressionInserted = false;

  const cleanup = [
    restore(
      tracksService,
      "getTrackForPlayback",
      (async () => createTrack()) as typeof tracksService.getTrackForPlayback,
    ),
    restore(
      usersService,
      "getProfile",
      (async () => ({
        id: "fan_1",
      })) as unknown as typeof usersService.getProfile,
    ),
    restore(
      subscriptionsService,
      "hasActivePlatformSubscription",
      (async () => false) as typeof subscriptionsService.hasActivePlatformSubscription,
    ),
    restore(
      entitlementsService,
      "findMineForTrack",
      (async () => undefined) as typeof entitlementsService.findMineForTrack,
    ),
    restore(
      adsRepository,
      "listAds",
      (async () => [createActiveAd()]) as typeof adsRepository.listAds,
    ),
    restore(
      adsRepository,
      "countAdImpressionsForWalletSince",
      (async () => 3) as typeof adsRepository.countAdImpressionsForWalletSince,
    ),
    restore(
      adsRepository,
      "upsertAdImpression",
      (async (impression) => {
        impressionInserted = true;
        return impression;
      }) as typeof adsRepository.upsertAdImpression,
    ),
  ];

  try {
    const decision = await adsService.getPlaybackAdDecision(fanWallet, "trk_public_1");

    assert.equal(decision.serveAd, false);
    assert.match(decision.reason ?? "", /frequency cap/i);
    assert.equal(impressionInserted, false);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("startImpression and updateImpression advance the impression lifecycle", async () => {
  let storedImpression: AdImpressionRecord = {
    id: "adimp_1",
    adId: "ad_1",
    walletAddress: fanWallet,
    trackId: "trk_public_1",
    status: "pending" as const,
    slot: "preroll" as const,
    createdAt: "2026-07-02T10:00:00.000Z",
    updatedAt: "2026-07-02T10:00:00.000Z",
  };

  const cleanup = [
    restore(
      adsRepository,
      "findAdImpressionById",
      (async () => storedImpression) as typeof adsRepository.findAdImpressionById,
    ),
    restore(
      adsRepository,
      "upsertAdImpression",
      (async (impression) => {
        storedImpression = impression;
        return impression;
      }) as typeof adsRepository.upsertAdImpression,
    ),
  ];

  try {
    const started = await adsService.startImpression(fanWallet, {
      impressionId: "adimp_1",
    });
    const completed = await adsService.updateImpression(fanWallet, "adimp_1", {
      status: "completed",
    });

    assert.equal(started.status, "started");
    assert.ok(started.startedAt);
    assert.equal(completed.status, "completed");
    assert.ok(completed.completedAt);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("getPlaybackAdDecision skips ads when artists preview their own tracks", async () => {
  const cleanup = [
    restore(
      tracksService,
      "getTrackForPlayback",
      (async () => createTrack()) as typeof tracksService.getTrackForPlayback,
    ),
    restore(
      usersService,
      "getProfile",
      (async () => ({
        id: "artist_1",
      })) as unknown as typeof usersService.getProfile,
    ),
    restore(
      subscriptionsService,
      "hasActivePlatformSubscription",
      (async () => false) as typeof subscriptionsService.hasActivePlatformSubscription,
    ),
    restore(
      entitlementsService,
      "findMineForTrack",
      (async () => undefined) as typeof entitlementsService.findMineForTrack,
    ),
    restore(
      adsRepository,
      "listAds",
      (async () => [createActiveAd()]) as typeof adsRepository.listAds,
    ),
  ];

  try {
    const decision = await adsService.getPlaybackAdDecision(artistWallet, "trk_public_1");

    assert.equal(decision.serveAd, false);
    assert.match(decision.reason ?? "", /own tracks/i);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});
