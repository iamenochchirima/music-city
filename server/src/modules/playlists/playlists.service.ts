import {
  playlistCreateSchema,
  playlistTrackAssignSchema,
  playlistTrackReorderSchema,
  playlistUpdateSchema,
  type PlaylistDetail,
  type PlaylistSummary,
  type TrackSummary,
} from "@music-city/shared";

import { createId } from "../../services/id.service.js";
import { storageService } from "../../services/storage.service.js";
import { engagementService } from "../engagement/engagement.service.js";
import { tracksRepository } from "../tracks/tracks.repository.js";
import { usersService } from "../users/users.service.js";
import { playlistsRepository } from "./playlists.repository.js";

const hydrateTrackUrls = <T extends { coverStorageKey?: string; coverImageUrl?: string }>(
  track: T,
) => {
  const nextTrack = {
    ...track,
    coverImageUrl: track.coverStorageKey
      ? storageService.getDownloadUrl(track.coverStorageKey)
      : track.coverImageUrl,
  } as T & {
    masterStorageKey?: string;
    mediaProvider?: "local" | "mux";
    streamMediaUrl?: string;
    playbackUrl?: string;
  };

  if (nextTrack.masterStorageKey && nextTrack.mediaProvider !== "mux") {
    const mediaUrl = storageService.getDownloadUrl(nextTrack.masterStorageKey);
    nextTrack.streamMediaUrl = mediaUrl;
    nextTrack.playbackUrl = mediaUrl;
  }

  return nextTrack;
};

const ensureOwnerProfile = async (walletAddress: string) => {
  const profile = await usersService.getProfile(walletAddress);

  if (!profile) {
    throw new Error("Create a profile before managing playlists");
  }

  return profile;
};

const toPlaylistDetail = async (
  playlist: PlaylistSummary,
  includePrivateTracks: boolean,
): Promise<PlaylistDetail> => {
  const assignments = await playlistsRepository.listTracks(playlist.id);
  const tracks = await Promise.all(
    assignments.map(async (assignment) => {
      const track = await tracksRepository.findById(assignment.track_id);
      return track
        ? {
            trackId: assignment.track_id,
            position: assignment.position,
            track: hydrateTrackUrls(track),
          }
        : null;
    }),
  );

  return {
    ...playlist,
    tracks: tracks.filter(
      (
        item,
      ): item is {
        trackId: string;
        position: number;
        track: TrackSummary;
      } =>
        item !== null &&
        (includePrivateTracks ||
          Boolean(item.track.playbackReady && item.track.visibility === "published")),
    ),
  };
};

const syncPlaylistTrackCount = async (playlist: PlaylistSummary) => {
  const assignments = await playlistsRepository.listTracks(playlist.id);

  return playlistsRepository.upsert({
    ...playlist,
    trackCount: assignments.length,
    updatedAt: new Date().toISOString(),
  });
};

export const playlistsService = {
  async listPlaylists() {
    return (await playlistsRepository.list()).filter(
      (playlist) => playlist.visibility === "public",
    );
  },

  async listMyPlaylists(walletAddress: string) {
    const profile = await ensureOwnerProfile(walletAddress);
    return playlistsRepository.listByOwner(profile.id);
  },

  async getPlaylist(playlistId: string) {
    const playlist = await playlistsRepository.findById(playlistId);

    if (!playlist || playlist.visibility !== "public") {
      return null;
    }

    return toPlaylistDetail(playlist, false);
  },

  async getManagePlaylist(walletAddress: string, playlistId: string) {
    const profile = await ensureOwnerProfile(walletAddress);
    const playlist = await playlistsRepository.findById(playlistId);

    if (!playlist || playlist.ownerUserId !== profile.id) {
      return null;
    }

    return toPlaylistDetail(playlist, true);
  },

  async createPlaylist(walletAddress: string, input: unknown) {
    const profile = await ensureOwnerProfile(walletAddress);
    const parsed = playlistCreateSchema.parse(input);
    const timestamp = new Date().toISOString();

    const playlist = await playlistsRepository.upsert({
      id: createId("pl"),
      ownerUserId: profile.id,
      ownerDisplayName: profile.displayName,
      title: parsed.title.trim(),
      description: parsed.description?.trim() || undefined,
      visibility: parsed.visibility,
      trackCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await engagementService.recordPlaylistCreated({
      actorUserId: profile.id,
      playlistId: playlist.id,
      visibility: playlist.visibility,
    });

    return toPlaylistDetail(playlist, true);
  },

  async updatePlaylist(walletAddress: string, playlistId: string, input: unknown) {
    const profile = await ensureOwnerProfile(walletAddress);
    const existing = await playlistsRepository.findById(playlistId);

    if (!existing || existing.ownerUserId !== profile.id) {
      throw new Error("Playlist not found");
    }

    const parsed = playlistUpdateSchema.parse(input);
    const updated = await playlistsRepository.upsert({
      ...existing,
      title: parsed.title?.trim() || existing.title,
      description:
        parsed.description !== undefined
          ? parsed.description.trim() || undefined
          : existing.description,
      visibility: parsed.visibility ?? existing.visibility,
      updatedAt: new Date().toISOString(),
    });

    return toPlaylistDetail(updated, true);
  },

  async addTrackToPlaylist(walletAddress: string, playlistId: string, input: unknown) {
    const profile = await ensureOwnerProfile(walletAddress);
    const playlist = await playlistsRepository.findById(playlistId);

    if (!playlist || playlist.ownerUserId !== profile.id) {
      throw new Error("Playlist not found");
    }

    const parsed = playlistTrackAssignSchema.parse(input);
    const track = await tracksRepository.findById(parsed.trackId);

    if (!track) {
      throw new Error("Track not found");
    }

    if (track.visibility === "unpublished" && track.artistId !== profile.id) {
      throw new Error("Private tracks cannot be added to this playlist");
    }

    const existingAssignments = await playlistsRepository.listTracks(playlistId);
    const existingItem = existingAssignments.find(
      (assignment) => assignment.track_id === parsed.trackId,
    );
    const position =
      parsed.position ?? existingItem?.position ?? existingAssignments.length + 1;

    await playlistsRepository.assignTrack(playlistId, parsed.trackId, position);
    await engagementService.recordPlaylistTrackAdded({
      actorUserId: profile.id,
      playlistId,
      trackId: parsed.trackId,
      artistId: track.artistId,
    });
    const syncedPlaylist = await syncPlaylistTrackCount(playlist);

    return toPlaylistDetail(syncedPlaylist, true);
  },

  async reorderPlaylistTracks(walletAddress: string, playlistId: string, input: unknown) {
    const profile = await ensureOwnerProfile(walletAddress);
    const playlist = await playlistsRepository.findById(playlistId);

    if (!playlist || playlist.ownerUserId !== profile.id) {
      throw new Error("Playlist not found");
    }

    const parsed = playlistTrackReorderSchema.parse(input);

    for (const item of parsed.items) {
      const track = await tracksRepository.findById(item.trackId);

      if (!track) {
        throw new Error("Track not found");
      }

      await playlistsRepository.assignTrack(playlistId, item.trackId, item.position);
    }

    const syncedPlaylist = await syncPlaylistTrackCount(playlist);
    return toPlaylistDetail(syncedPlaylist, true);
  },

  async removeTrackFromPlaylist(walletAddress: string, playlistId: string, trackId: string) {
    const profile = await ensureOwnerProfile(walletAddress);
    const playlist = await playlistsRepository.findById(playlistId);
    const track = await tracksRepository.findById(trackId);

    if (!playlist || playlist.ownerUserId !== profile.id || !track) {
      throw new Error("Playlist not found");
    }

    await playlistsRepository.removeTrack(playlistId, trackId);
    await engagementService.recordPlaylistTrackRemoved({
      actorUserId: profile.id,
      playlistId,
      trackId,
      artistId: track.artistId,
    });
    const syncedPlaylist = await syncPlaylistTrackCount(playlist);

    return toPlaylistDetail(syncedPlaylist, true);
  },
};
