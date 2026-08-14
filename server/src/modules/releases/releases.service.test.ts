import assert from "node:assert/strict";
import test from "node:test";
import type { ReleaseSummary } from "@music-city/shared";

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

const { releasesService } = await import("./releases.service.js");
const { releasesRepository } = await import("./releases.repository.js");
const { tracksRepository } = await import("../tracks/tracks.repository.js");
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

const release = (type: "single" | "ep" | "album"): ReleaseSummary => ({
  id: "rel-1",
  artistId: "artist-1",
  artistName: "Artist",
  title: "A Release",
  type,
  status: "draft" as const,
  genre: "Electronic",
  coverStorageKey: "covers/rel-1.jpg",
  trackCount: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

const track = (id: string) => ({
  id,
  title: `Track ${id}`,
  artistId: "artist-1",
  artistName: "Artist",
  genre: "Electronic",
  runtime: "3:00",
  priceLabel: "Unpublished",
  status: "uploaded" as const,
  visibility: "unpublished" as const,
  plays: 0,
  likes: 0,
  playbackReady: true,
});

const runUpdate = async (
  currentRelease: ReturnType<typeof release>,
  assignments: Array<{
    release_id: string;
    track_id: string;
    track_number: number;
    disc_number: number;
    is_focus_track: boolean;
  }>,
  tracks: Record<string, ReturnType<typeof track>>,
) => {
  const cleanup = [
    restore(usersService, "getProfile", async () => artistProfile),
    restore(releasesRepository, "findById", async () => currentRelease),
    restore(releasesRepository, "listTracks", async () => assignments),
    restore(tracksRepository, "findById", async (trackId: string) => tracks[trackId] ?? null),
  ];

  try {
    await releasesService.updateRelease(walletAddress, currentRelease.id, {
      status: "published",
    });
  } finally {
    cleanup.reverse().forEach((restoreOriginal) => restoreOriginal());
  }
};

test("publishing a release requires artwork and a valid track count", async () => {
  const noArtworkRelease = {
    ...release("single"),
    coverStorageKey: undefined,
  };

  await assert.rejects(
    () => runUpdate(noArtworkRelease, [], {}),
    /Upload release artwork before publishing/,
  );

  await assert.rejects(
    () =>
      runUpdate(
        noArtworkRelease,
        [{ release_id: "rel-1", track_id: "trk-1", track_number: 1, disc_number: 1, is_focus_track: false }],
        { "trk-1": track("trk-1") },
      ),
    /Upload release artwork before publishing/,
  );
});

test("release creation persists release-owned metadata as a draft", async () => {
  let persistedRelease: ReleaseSummary | null = null;
  const cleanup = [
    restore(usersService, "getProfile", async () => artistProfile),
    restore(
      releasesRepository,
      "upsert",
      (async (nextRelease) => {
        persistedRelease = nextRelease;
        return nextRelease;
      }) as typeof releasesRepository.upsert,
    ),
    restore(releasesRepository, "listTracks", async () => []),
  ];

  try {
    const created = await releasesService.createRelease(walletAddress, {
      title: "Release-owned metadata",
      type: "single",
      genre: "Pop",
      recordLabel: "Music City Records",
    });

    assert.equal(created.status, "draft");
    const savedRelease = persistedRelease as unknown as ReleaseSummary;
    assert.equal(savedRelease.recordLabel, "Music City Records");
    assert.equal(savedRelease.trackCount, 0);
  } finally {
    cleanup.reverse().forEach((restoreOriginal) => restoreOriginal());
  }
});

test("album publishing rejects fewer than seven tracks", async () => {
  const currentRelease = release("album");

  await assert.rejects(
    () =>
      runUpdate(
        currentRelease,
        [
          { release_id: "rel-1", track_id: "trk-1", track_number: 1, disc_number: 1, is_focus_track: false },
        ],
        { "trk-1": track("trk-1") },
      ),
    /Albums must contain at least 7 tracks/,
  );
});

test("publishing a single rejects an empty tracklist even with artwork", async () => {
  const currentRelease = {
    ...release("single"),
    coverStorageKey: "covers/rel-1.jpg",
  };

  await assert.rejects(
    () => runUpdate(currentRelease, [], {}),
    /Add at least one track before releasing this project/,
  );
});

test("publishing a release is the only operation that publishes its tracks", async () => {
  const currentRelease = {
    ...release("single"),
    coverStorageKey: "covers/rel-1.jpg",
  };
  const assignments = [
    {
      release_id: "rel-1",
      track_id: "trk-1",
      track_number: 1,
      disc_number: 1,
      is_focus_track: true,
    },
  ];
  const publishedTracks: string[] = [];
  const cleanup = [
    restore(usersService, "getProfile", async () => artistProfile),
    restore(releasesRepository, "findById", async () => currentRelease),
    restore(releasesRepository, "listTracks", async () => assignments),
    restore(releasesRepository, "upsert", (async (nextRelease) => nextRelease) as typeof releasesRepository.upsert),
    restore(tracksRepository, "findById", async () => track("trk-1")),
    restore(
      tracksRepository,
      "upsert",
      (async (nextTrack) => {
        if (nextTrack.visibility === "published") {
          publishedTracks.push(nextTrack.id);
        }
        return nextTrack;
      }) as typeof tracksRepository.upsert,
    ),
  ];

  try {
    const updated = await releasesService.updateRelease(walletAddress, "rel-1", {
      status: "published",
    });

    assert.deepEqual(publishedTracks, ["trk-1"]);
    assert.equal(updated.tracks[0]?.track.visibility, "published");
  } finally {
    cleanup.reverse().forEach((restoreOriginal) => restoreOriginal());
  }
});

test("unpublishing a release removes public track visibility", async () => {
  const currentRelease = {
    ...release("single"),
    status: "published" as const,
    coverStorageKey: "covers/rel-1.jpg",
  };
  const assignments = [
    {
      release_id: "rel-1",
      track_id: "trk-1",
      track_number: 1,
      disc_number: 1,
      is_focus_track: true,
    },
  ];
  const unpublishedTracks: string[] = [];
  const cleanup = [
    restore(usersService, "getProfile", async () => artistProfile),
    restore(releasesRepository, "findById", async () => currentRelease),
    restore(releasesRepository, "listTracks", async () => assignments),
    restore(releasesRepository, "upsert", (async (nextRelease) => nextRelease) as typeof releasesRepository.upsert),
    restore(
      tracksRepository,
      "findById",
      async () => ({ ...track("trk-1"), visibility: "published" as const }),
    ),
    restore(
      tracksRepository,
      "upsert",
      (async (nextTrack) => {
        if (nextTrack.visibility === "unpublished") {
          unpublishedTracks.push(nextTrack.id);
        }
        return nextTrack;
      }) as typeof tracksRepository.upsert,
    ),
  ];

  try {
    const updated = await releasesService.updateRelease(walletAddress, "rel-1", {
      status: "draft",
    });

    assert.deepEqual(unpublishedTracks, ["trk-1"]);
    assert.equal(updated.tracks[0]?.track.visibility, "unpublished");
  } finally {
    cleanup.reverse().forEach((restoreOriginal) => restoreOriginal());
  }
});

test("release tracklists allow only one focus track and unique positions", async () => {
  const currentRelease = release("ep");
  const assignments = [
    { release_id: "rel-1", track_id: "trk-1", track_number: 1, disc_number: 1, is_focus_track: false },
    { release_id: "rel-1", track_id: "trk-2", track_number: 2, disc_number: 1, is_focus_track: false },
  ];
  const cleanup = [
    restore(usersService, "getProfile", async () => artistProfile),
    restore(releasesRepository, "findById", async () => currentRelease),
    restore(releasesRepository, "listTracks", async () => assignments),
    restore(tracksRepository, "findById", async (trackId: string) => track(trackId)),
  ];

  try {
    await assert.rejects(
      () =>
        releasesService.reorderReleaseTracks(walletAddress, currentRelease.id, {
          items: [
            { trackId: "trk-1", trackNumber: 1, discNumber: 1, isFocusTrack: true },
            { trackId: "trk-2", trackNumber: 2, discNumber: 1, isFocusTrack: true },
          ],
        }),
      /only one focus track/,
    );
  } finally {
    cleanup.reverse().forEach((restoreOriginal) => restoreOriginal());
  }
});
