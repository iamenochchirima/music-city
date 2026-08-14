import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const walletAddress = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

const artistProfile = {
  id: "artist-1",
  walletAddress,
  email: "",
  displayName: "Artist",
  primaryIntent: "artist" as const,
  artistAccess: true,
  onboardingStatus: "complete" as const,
  onboardingStep: "complete" as const,
  onboardingVersion: 1,
  onboardingCompletedAt: new Date(0).toISOString(),
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
  hasReleasedMusic: false,
  verified: false,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const { tracksService } = await import("./tracks.service.js");
const { usersService } = await import("../users/users.service.js");
const { tracksRepository } = await import("./tracks.repository.js");

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

test("createTrack rejects subscriber-only access from creator-controlled input", async () => {
  const cleanup = [
    restore(
      usersService,
      "requireArtistOnboardingAccess",
      (async () => artistProfile) as typeof usersService.requireArtistOnboardingAccess,
    ),
  ];

  try {
    await assert.rejects(
      () =>
        tracksService.createTrack(walletAddress, {
          title: "Locked track",
          genre: "Pop",
          access: "subscribers",
        } as never),
    );
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("updateTrackAccess rejects subscriber-only access from creator-controlled input", async () => {
  const cleanup = [
    restore(
      usersService,
      "requireArtistOnboardingAccess",
      (async () => artistProfile) as typeof usersService.requireArtistOnboardingAccess,
    ),
    restore(
      tracksRepository,
      "findById",
      (async () => ({
        id: "trk-1",
        title: "Track",
        artistId: "artist-1",
        artistName: "Artist",
        genre: "Pop",
        runtime: "4:05",
        priceLabel: "Private",
        status: "published" as const,
        access: "public" as const,
        plays: 0,
        likes: 0,
        playbackReady: true,
      })) as typeof tracksRepository.findById,
    ),
  ];

  try {
    await assert.rejects(
      () =>
        tracksService.updateTrackVisibility(walletAddress, "trk-1", {
          visibility: "published",
        } as never),
    );
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});
