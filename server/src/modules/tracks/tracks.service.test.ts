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

test("track creation rejects standalone publication input", async () => {
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
          title: "Track",
          genre: "Pop",
          visibility: "published",
        } as never),
      /Unrecognized key/,
    );
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("createTrack persists recording-owned metadata only", async () => {
  let persistedTrack: Record<string, unknown> | null = null;
  const cleanup = [
    restore(
      usersService,
      "requireArtistOnboardingAccess",
      (async () => artistProfile) as typeof usersService.requireArtistOnboardingAccess,
    ),
    restore(
      tracksRepository,
      "upsert",
      (async (track) => {
        persistedTrack = track as unknown as Record<string, unknown>;
        return track;
      }) as typeof tracksRepository.upsert,
    ),
  ];

  try {
    await tracksService.createTrack(walletAddress, {
      title: "Recording-owned fields",
      artistName: "Artist",
      genre: "Pop",
      isExplicit: true,
      credits: [{ role: "producer", name: "Producer" }],
    });

    const savedTrack = persistedTrack as unknown as Record<string, unknown>;
    assert.equal(savedTrack["isExplicit"], true);
    assert.deepEqual(savedTrack["credits"], [
      { role: "producer", name: "Producer" },
    ]);
    assert.equal("recordLabel" in savedTrack, false);
    assert.equal("country" in savedTrack, false);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("track metadata updates normalize identifiers and validate linked artist credits", async () => {
  let persistedTrack: Record<string, unknown> | null = null;
  const existingTrack = {
    id: "trk-1",
    title: "Track",
    artistId: "artist-1",
    artistName: "Artist",
    genre: "Pop",
    runtime: "4:05",
    priceLabel: "Unpublished",
    status: "uploaded" as const,
    visibility: "unpublished" as const,
    plays: 0,
    likes: 0,
    playbackReady: true,
  };
  const cleanup = [
    restore(
      usersService,
      "requireArtistOnboardingAccess",
      (async () => artistProfile) as typeof usersService.requireArtistOnboardingAccess,
    ),
    restore(
      usersService,
      "getProfileById",
      (async () => artistProfile) as typeof usersService.getProfileById,
    ),
    restore(
      tracksRepository,
      "findById",
      (async () => existingTrack) as typeof tracksRepository.findById,
    ),
    restore(
      tracksRepository,
      "upsert",
      (async (track) => {
        persistedTrack = track as unknown as Record<string, unknown>;
        return track;
      }) as typeof tracksRepository.upsert,
    ),
  ];

  try {
    await tracksService.updateTrackMetadata(walletAddress, "trk-1", {
      isrc: "US-RC1-76-07839",
      credits: [{ role: "composer", name: "Composer", artistId: "artist-1" }],
      isExplicit: true,
    });

    const savedTrack = persistedTrack as unknown as Record<string, unknown>;
    assert.equal(savedTrack["isrc"], "USRC17607839");
    assert.equal(savedTrack["isExplicit"], true);
    assert.deepEqual(savedTrack["credits"], [
      { role: "composer", name: "Composer", artistId: "artist-1" },
    ]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("track metadata updates reject edits from another artist", async () => {
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
        id: "trk-other",
        title: "Another artist track",
        artistId: "artist-2",
        artistName: "Another Artist",
        genre: "Pop",
        runtime: "3:00",
        priceLabel: "Unpublished",
        status: "uploaded" as const,
        visibility: "unpublished" as const,
        plays: 0,
        likes: 0,
      })) as typeof tracksRepository.findById,
    ),
  ];

  try {
    await assert.rejects(
      () =>
        tracksService.updateTrackMetadata(walletAddress, "trk-other", {
          isExplicit: true,
        }),
      /Track not found/,
    );
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});
