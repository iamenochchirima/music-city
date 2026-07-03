import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const { playlistsService } = await import("./playlists.service.js");
const { playlistsRepository } = await import("./playlists.repository.js");
const { engagementService } = await import("../engagement/engagement.service.js");
const { usersService } = await import("../users/users.service.js");
const { tracksRepository } = await import("../tracks/tracks.repository.js");

const baseTimestamp = new Date(0).toISOString();

const createProfile = () => ({
  id: "usr-listener",
  walletAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  email: "",
  displayName: "Playlist Fan",
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

test("createPlaylist records a playlist-created analytics event", async () => {
  const analyticsCalls: Array<{ actorUserId: string; playlistId: string }> = [];

  const cleanup = [
    restore(
      usersService,
      "getProfile",
      (async () => createProfile()) as typeof usersService.getProfile,
    ),
    restore(
      playlistsRepository,
      "upsert",
      (async (playlist) => playlist) as typeof playlistsRepository.upsert,
    ),
    restore(
      playlistsRepository,
      "listTracks",
      (async () => []) as typeof playlistsRepository.listTracks,
    ),
    restore(
      engagementService,
      "recordPlaylistCreated",
      (async (input) => {
        analyticsCalls.push({
          actorUserId: input.actorUserId,
          playlistId: input.playlistId,
        });
      }) as typeof engagementService.recordPlaylistCreated,
    ),
  ];

  try {
    const playlist = await playlistsService.createPlaylist("wallet-1", {
      title: "QA Playlist",
      visibility: "public",
    });

    assert.equal(playlist.title, "QA Playlist");
    assert.deepEqual(analyticsCalls, [
      {
        actorUserId: "usr-listener",
        playlistId: playlist.id,
      },
    ]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("addTrackToPlaylist records a playlist-track-added analytics event", async () => {
  const analyticsCalls: Array<{ actorUserId: string; playlistId: string; trackId: string }> = [];

  const cleanup = [
    restore(
      usersService,
      "getProfile",
      (async () => createProfile()) as typeof usersService.getProfile,
    ),
    restore(
      playlistsRepository,
      "findById",
      (async () => ({
        id: "pl-1",
        ownerUserId: "usr-listener",
        ownerDisplayName: "Playlist Fan",
        title: "QA Playlist",
        visibility: "public",
        trackCount: 0,
        createdAt: baseTimestamp,
        updatedAt: baseTimestamp,
      })) as typeof playlistsRepository.findById,
    ),
    restore(
      playlistsRepository,
      "listTracks",
      (async () => []) as typeof playlistsRepository.listTracks,
    ),
    restore(
      playlistsRepository,
      "assignTrack",
      (async () => undefined) as typeof playlistsRepository.assignTrack,
    ),
    restore(
      playlistsRepository,
      "upsert",
      (async (playlist) => playlist) as typeof playlistsRepository.upsert,
    ),
    restore(
      tracksRepository,
      "findById",
      (async () => ({
        id: "trk-1",
        title: "Track",
        artistId: "usr-artist",
        artistName: "Artist",
        genre: "Pop",
        runtime: "3:00",
        priceLabel: "Public",
        status: "published",
        access: "public",
        plays: 0,
        likes: 0,
        playbackReady: true,
      })) as typeof tracksRepository.findById,
    ),
    restore(
      engagementService,
      "recordPlaylistTrackAdded",
      (async (input) => {
        analyticsCalls.push({
          actorUserId: input.actorUserId,
          playlistId: input.playlistId,
          trackId: input.trackId,
        });
      }) as typeof engagementService.recordPlaylistTrackAdded,
    ),
  ];

  try {
    await playlistsService.addTrackToPlaylist("wallet-1", "pl-1", {
      trackId: "trk-1",
    });

    assert.deepEqual(analyticsCalls, [
      {
        actorUserId: "usr-listener",
        playlistId: "pl-1",
        trackId: "trk-1",
      },
    ]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("removeTrackFromPlaylist records a playlist-track-removed analytics event", async () => {
  const analyticsCalls: Array<{ actorUserId: string; playlistId: string; trackId: string }> = [];

  const cleanup = [
    restore(
      usersService,
      "getProfile",
      (async () => createProfile()) as typeof usersService.getProfile,
    ),
    restore(
      playlistsRepository,
      "findById",
      (async () => ({
        id: "pl-1",
        ownerUserId: "usr-listener",
        ownerDisplayName: "Playlist Fan",
        title: "QA Playlist",
        visibility: "public",
        trackCount: 1,
        createdAt: baseTimestamp,
        updatedAt: baseTimestamp,
      })) as typeof playlistsRepository.findById,
    ),
    restore(
      playlistsRepository,
      "removeTrack",
      (async () => undefined) as typeof playlistsRepository.removeTrack,
    ),
    restore(
      playlistsRepository,
      "listTracks",
      (async () => []) as typeof playlistsRepository.listTracks,
    ),
    restore(
      playlistsRepository,
      "upsert",
      (async (playlist) => playlist) as typeof playlistsRepository.upsert,
    ),
    restore(
      tracksRepository,
      "findById",
      (async () => ({
        id: "trk-1",
        title: "Track",
        artistId: "usr-artist",
        artistName: "Artist",
        genre: "Pop",
        runtime: "3:00",
        priceLabel: "Public",
        status: "published",
        access: "public",
        plays: 0,
        likes: 0,
        playbackReady: true,
      })) as typeof tracksRepository.findById,
    ),
    restore(
      engagementService,
      "recordPlaylistTrackRemoved",
      (async (input) => {
        analyticsCalls.push({
          actorUserId: input.actorUserId,
          playlistId: input.playlistId,
          trackId: input.trackId,
        });
      }) as typeof engagementService.recordPlaylistTrackRemoved,
    ),
  ];

  try {
    await playlistsService.removeTrackFromPlaylist("wallet-1", "pl-1", "trk-1");

    assert.deepEqual(analyticsCalls, [
      {
        actorUserId: "usr-listener",
        playlistId: "pl-1",
        trackId: "trk-1",
      },
    ]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});
