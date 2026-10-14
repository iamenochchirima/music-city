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
      credits: [{ role: "producer", name: " Producer " }],
      recordLabel: " Track Label ",
      isrc: "us-rc1-76-07839",
    });

    const savedTrack = persistedTrack as unknown as Record<string, unknown>;
    assert.equal(savedTrack["isExplicit"], true);
    assert.deepEqual(savedTrack["credits"], [
      { role: "producer", name: "Producer" },
    ]);
    assert.equal(savedTrack["recordLabel"], "Track Label");
    assert.equal(savedTrack["isrc"], "USRC17607839");
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
      "updateMetadata",
      (async (_trackId, _artistId, patch) => {
        const track = { ...existingTrack, ...patch };
        persistedTrack = track as unknown as Record<string, unknown>;
        return track;
      }) as typeof tracksRepository.updateMetadata,
    ),
  ];

  try {
    await tracksService.updateTrackMetadata(walletAddress, "trk-1", {
      title: "Renamed track",
      isrc: "US-RC1-76-07839",
      credits: [{ role: "composer", name: "Composer", artistId: "artist-1" }],
      isExplicit: true,
    });

    const savedTrack = persistedTrack as unknown as Record<string, unknown>;
    assert.equal(savedTrack["title"], "Renamed track");
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

test("track title updates do not revalidate unrelated existing metadata", async () => {
  let persistedTrack: Record<string, unknown> | null = null;
  const existingTrack = {
    id: "trk-title-only",
    title: "Old title",
    artistId: "artist-1",
    artistName: "Artist",
    genre: "Pop",
    runtime: "3:00",
    priceLabel: "Unpublished",
    status: "uploaded" as const,
    visibility: "unpublished" as const,
    plays: 0,
    likes: 0,
    isrc: "legacy-invalid-isrc",
  };
  const cleanup = [
    restore(
      usersService,
      "requireArtistOnboardingAccess",
      (async () => artistProfile) as typeof usersService.requireArtistOnboardingAccess,
    ),
    restore(
      tracksRepository,
      "findById",
      (async () => existingTrack) as typeof tracksRepository.findById,
    ),
    restore(
      tracksRepository,
      "updateMetadata",
      (async (_trackId, _artistId, patch) => {
        const track = { ...existingTrack, ...patch };
        persistedTrack = track as unknown as Record<string, unknown>;
        return track;
      }) as typeof tracksRepository.updateMetadata,
    ),
  ];

  try {
    await tracksService.updateTrackMetadata(walletAddress, "trk-title-only", {
      title: "New title",
    });

    assert.equal(persistedTrack?.["title"], "New title");
    assert.equal(persistedTrack?.["isrc"], "legacy-invalid-isrc");
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("both metadata writes reject nonexistent linked contributors before persisting", async () => {
  let writes = 0;
  const existing = { id: "owned", artistId: artistProfile.id };
  const cleanup = [
    restore(usersService, "requireArtistOnboardingAccess", async () => artistProfile),
    restore(usersService, "getProfileById", async () => null),
    restore(tracksRepository, "findById", async () => existing as never),
    restore(tracksRepository, "upsert", async track => { writes++; return track; }),
    restore(tracksRepository, "updateMetadata", async () => { writes++; return existing as never; }),
  ];
  try {
    const credits = [{ role: "composer" as const, name: "Composer", artistId: "missing" }];
    await assert.rejects(tracksService.createTrack(walletAddress, { title: "Song", genre: "Pop", isExplicit: false, credits }), /Linked credit profile/);
    await assert.rejects(tracksService.updateTrackMetadata(walletAddress, "owned", { credits }), /Linked credit profile/);
    assert.equal(writes, 0);
  } finally { cleanup.reverse().forEach(fn => fn()); }
});

test("clearing optional metadata preserves publication and unrelated track values", async () => {
  let existing = { id: "owned", artistId: artistProfile.id, status: "published", isrc: "USRC17607839", recordLabel: "Label", credits: [{ role: "producer", name: "Producer" }], playbackReady: true, masterStorageKey: "audio.wav" };
  const cleanup = [
    restore(usersService, "requireArtistOnboardingAccess", async () => artistProfile),
    restore(tracksRepository, "findById", async () => existing as never),
    restore(tracksRepository, "updateMetadata", async (_id, _owner, patch) => { existing = { ...existing, ...patch } as never; return existing as never; }),
  ];
  try {
    await tracksService.updateTrackMetadata(walletAddress, "owned", { credits: [] });
    assert.equal(existing.recordLabel, "Label");
    assert.equal(existing.isrc, "USRC17607839");
    const cleared = await tracksService.updateTrackMetadata(walletAddress, "owned", { recordLabel: " ", isrc: " " });
    assert.equal(cleared.recordLabel, undefined);
    assert.equal(cleared.isrc, undefined);
    assert.deepEqual(cleared.credits, []);
    assert.equal(cleared.status, "published");
    assert.equal(cleared.playbackReady, true);
    assert.equal(cleared.masterStorageKey, "audio.wav");
  } finally { cleanup.reverse().forEach(fn => fn()); }
});
