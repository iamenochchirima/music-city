import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const { adminService } = await import("./admin.service.js");
const { databaseService } = await import("../../services/database.service.js");
const { usersService } = await import("../users/users.service.js");
const { tracksRepository } = await import("../tracks/tracks.repository.js");

const baseTimestamp = new Date(0).toISOString();

const profileDefaults = {
  email: "",
  location: "",
  genres: [],
  favoriteArtistIds: [],
  interestedInLocalMusic: false,
  notificationPreferences: {
    releaseNotifications: true,
    artistUpdates: true,
    productUpdates: false,
  },
  bio: "",
  socialLinks: {
    website: "",
    instagram: "",
    youtube: "",
    soundcloud: "",
    x: "",
  },
  profileImageUrl: undefined,
  profileImageStorageKey: undefined,
  headerImageUrl: undefined,
  headerImageStorageKey: undefined,
  onboardingStatus: "complete" as const,
  onboardingStep: "complete" as const,
  onboardingVersion: 1,
  onboardingCompletedAt: baseTimestamp,
  verified: false,
  createdAt: baseTimestamp,
  updatedAt: baseTimestamp,
};

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

test("getAnalyticsOverview aggregates platform metrics and top entities", async () => {
  const cleanup = [
    restore(
      usersService,
      "listAllProfiles",
      (async () => [
        {
        id: "usr-artist-1",
        walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          ...profileDefaults,
          displayName: "Artist One",
          primaryIntent: "artist" as const,
          artistAccess: true,
          verified: true,
        },
        {
          id: "usr-artist-2",
          walletAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
          ...profileDefaults,
          displayName: "Artist Two",
          primaryIntent: "artist" as const,
          artistAccess: true,
          verified: true,
        },
        {
          id: "usr-fan-1",
          walletAddress: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
          ...profileDefaults,
          displayName: "Listener",
          primaryIntent: "listener" as const,
          artistAccess: false,
        },
      ]) as typeof usersService.listAllProfiles,
    ),
    restore(
      tracksRepository,
      "list",
      (async () => [
        {
          id: "trk-1",
          title: "First Track",
          artistId: "usr-artist-1",
          artistName: "Artist One",
          releaseId: "rel-1",
          releaseTitle: "First Release",
          genre: "Pop",
          runtime: "3:00",
          priceLabel: "Public",
          status: "published",
          access: "public",
          plays: 25,
          likes: 4,
        },
        {
          id: "trk-2",
          title: "Second Track",
          artistId: "usr-artist-1",
          artistName: "Artist One",
          releaseId: "rel-1",
          releaseTitle: "First Release",
          genre: "Pop",
          runtime: "3:30",
          priceLabel: "Public",
          status: "published",
          access: "public",
          plays: 18,
          likes: 3,
        },
        {
          id: "trk-3",
          title: "Third Track",
          artistId: "usr-artist-2",
          artistName: "Artist Two",
          releaseId: "rel-2",
          releaseTitle: "Second Release",
          genre: "Soul",
          runtime: "4:10",
          priceLabel: "Subscribers",
          status: "published",
          access: "subscribers",
          plays: 8,
          likes: 2,
        },
      ]) as typeof tracksRepository.list,
    ),
    restore(
      databaseService,
      "countQualifiedStreamsPlatform",
      (async () => 51) as typeof databaseService.countQualifiedStreamsPlatform,
    ),
    restore(
      databaseService,
      "countPlatformActiveListeners",
      (async () => 17) as typeof databaseService.countPlatformActiveListeners,
    ),
    restore(
      databaseService,
      "countAnalyticsEventsByType",
      (async (eventType: string) =>
        eventType === "view_release" ? 9 : 4) as typeof databaseService.countAnalyticsEventsByType,
    ),
    restore(
      databaseService,
      "listTopArtistsByQualifiedStreams",
      (async () => [
        {
          artistId: "usr-artist-1",
          artistName: "Artist One",
          streams: 43,
        },
        {
          artistId: "usr-artist-2",
          artistName: "Artist Two",
          streams: 8,
        },
      ]) as typeof databaseService.listTopArtistsByQualifiedStreams,
    ),
    restore(
      databaseService,
      "listTopTracksByQualifiedStreams",
      (async () => [
        {
          trackId: "trk-1",
          title: "First Track",
          artistName: "Artist One",
          streams: 25,
        },
        {
          trackId: "trk-2",
          title: "Second Track",
          artistName: "Artist One",
          streams: 18,
        },
        {
          trackId: "trk-3",
          title: "Third Track",
          artistName: "Artist Two",
          streams: 8,
        },
      ]) as typeof databaseService.listTopTracksByQualifiedStreams,
    ),
    restore(
      databaseService,
      "listTopReleasesByQualifiedStreams",
      (async () => [
        {
          releaseId: "rel-1",
          title: "First Release",
          artistName: "Artist One",
          streams: 43,
        },
        {
          releaseId: "rel-2",
          title: "Second Release",
          artistName: "Artist Two",
          streams: 8,
        },
      ]) as typeof databaseService.listTopReleasesByQualifiedStreams,
    ),
  ];

  try {
    const analytics = await adminService.getAnalyticsOverview(90);

    assert.equal(analytics.selectedWindowDays, 90);
    assert.equal(analytics.totalStreams, 51);
    assert.equal(analytics.activeListeners, 17);
    assert.equal(analytics.releaseViews, 9);
    assert.equal(analytics.newFollows, 4);
    assert.equal(analytics.totalArtists, 2);
    assert.equal(analytics.totalTracks, 3);
    assert.deepEqual(analytics.topArtists, [
      {
        artistId: "usr-artist-1",
        artistName: "Artist One",
        streams: 43,
      },
      {
        artistId: "usr-artist-2",
        artistName: "Artist Two",
        streams: 8,
      },
    ]);
    assert.deepEqual(analytics.topTracks, [
      {
        trackId: "trk-1",
        title: "First Track",
        artistName: "Artist One",
        streams: 25,
      },
      {
        trackId: "trk-2",
        title: "Second Track",
        artistName: "Artist One",
        streams: 18,
      },
      {
        trackId: "trk-3",
        title: "Third Track",
        artistName: "Artist Two",
        streams: 8,
      },
    ]);
    assert.deepEqual(analytics.topReleases, [
      {
        releaseId: "rel-1",
        title: "First Release",
        artistName: "Artist One",
        streams: 43,
      },
      {
        releaseId: "rel-2",
        title: "Second Release",
        artistName: "Artist Two",
        streams: 8,
      },
    ]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});
