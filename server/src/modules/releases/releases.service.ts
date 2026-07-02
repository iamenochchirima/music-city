import {
  releaseCreateSchema,
  releaseTrackAssignSchema,
  releaseTrackReorderSchema,
  releaseUpdateSchema,
  type ReleaseDetail,
  type ReleaseSummary,
  type TrackSummary,
} from "@music-city/shared";

import { createId } from "../../services/id.service.js";
import { storageService } from "../../services/storage.service.js";
import { tracksRepository } from "../tracks/tracks.repository.js";
import { usersService } from "../users/users.service.js";
import { releasesRepository } from "./releases.repository.js";

const hydrateReleaseUrls = <T extends { coverStorageKey?: string; coverImageUrl?: string }>(
  release: T,
) => ({
  ...release,
  coverImageUrl: release.coverStorageKey
    ? storageService.getDownloadUrl(release.coverStorageKey)
    : release.coverImageUrl,
});

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

const toReleaseDetail = async (
  release: ReleaseSummary,
  includePrivateTracks: boolean,
): Promise<ReleaseDetail> => {
  const assignments = [...(await releasesRepository.listTracks(release.id))].sort(
    (left, right) =>
      left.disc_number - right.disc_number ||
      left.track_number - right.track_number ||
      left.track_id.localeCompare(right.track_id),
  );
  const tracks = await Promise.all(
    assignments.map(async (assignment) => {
      const track = await tracksRepository.findById(assignment.track_id);
      return track
        ? {
            trackId: assignment.track_id,
            trackNumber: assignment.track_number,
            discNumber: assignment.disc_number,
            isFocusTrack: assignment.is_focus_track,
            track: hydrateTrackUrls(track),
          }
        : null;
    }),
  );

  return {
    ...hydrateReleaseUrls(release),
    tracks: tracks.filter(
      (
        item,
      ): item is {
        trackId: string;
        trackNumber: number;
        discNumber: number;
        isFocusTrack: boolean;
        track: TrackSummary;
      } =>
        item !== null &&
        (includePrivateTracks ||
          Boolean(item.track.playbackReady && item.track.access !== "private")),
    ),
  };
};

const syncReleaseTrackCount = async (release: ReleaseSummary) => {
  const assignments = await releasesRepository.listTracks(release.id);

  return releasesRepository.upsert({
    ...release,
    trackCount: assignments.length,
    updatedAt: new Date().toISOString(),
  });
};

const syncTrackReleaseFields = async (
  track: TrackSummary,
  release: ReleaseSummary | null,
  assignment?: {
    trackNumber: number;
    discNumber: number;
    isFocusTrack: boolean;
  },
) =>
  tracksRepository.upsert({
    ...track,
    updatedAt: new Date().toISOString(),
    ...(release
      ? {
          releaseId: release.id,
          releaseTitle: release.title,
        }
      : {
          releaseId: undefined,
          releaseTitle: undefined,
        }),
    ...(assignment
      ? {
          trackNumber: assignment.trackNumber,
          discNumber: assignment.discNumber,
          isFocusTrack: assignment.isFocusTrack,
        }
      : {
          trackNumber: undefined,
          discNumber: undefined,
          isFocusTrack: undefined,
        }),
  });

const ensureOwnerProfile = async (walletAddress: string) => {
  const profile = await usersService.getProfile(walletAddress);

  if (!profile) {
    throw new Error("Create a profile before managing releases");
  }

  return profile;
};

export const releasesService = {
  async listReleases() {
    const releases = await releasesRepository.list();
    return releases
      .filter((release) => release.status === "published")
      .map((release) => hydrateReleaseUrls(release));
  },

  async listPublicReleasesByArtist(artistId: string) {
    const releases = await releasesRepository.listByArtist(artistId);
    return releases
      .filter((release) => release.status === "published")
      .map((release) => hydrateReleaseUrls(release));
  },

  async listMyReleases(walletAddress: string) {
    const profile = await ensureOwnerProfile(walletAddress);
    return (await releasesRepository.listByArtist(profile.id)).map((release) =>
      hydrateReleaseUrls(release),
    );
  },

  async getRelease(releaseId: string) {
    const release = await releasesRepository.findById(releaseId);

    if (!release || release.status !== "published") {
      return null;
    }

    return toReleaseDetail(release, false);
  },

  async getManageRelease(walletAddress: string, releaseId: string) {
    const profile = await ensureOwnerProfile(walletAddress);
    const release = await releasesRepository.findById(releaseId);

    if (!release || release.artistId !== profile.id) {
      return null;
    }

    return toReleaseDetail(release, true);
  },

  async getReleaseForUpload(releaseId: string) {
    const release = await releasesRepository.findById(releaseId);
    return release ? hydrateReleaseUrls(release) : null;
  },

  async userOwnsRelease(walletAddress: string, releaseId: string) {
    const profile = await usersService.getProfile(walletAddress);
    const release = await releasesRepository.findById(releaseId);

    return Boolean(profile && release && release.artistId === profile.id);
  },

  async createRelease(walletAddress: string, input: unknown) {
    const profile = await ensureOwnerProfile(walletAddress);
    const parsed = releaseCreateSchema.parse(input);
    const timestamp = new Date().toISOString();

    const release = await releasesRepository.upsert({
      id: createId("rel"),
      artistId: profile.id,
      artistName: parsed.artistName?.trim() || profile.displayName,
      title: parsed.title.trim(),
      type: parsed.type,
      status: "draft",
      genre: parsed.genre.trim(),
      description: parsed.description?.trim() || undefined,
      coverStorageKey: parsed.coverStorageKey?.trim() || undefined,
      releaseDate: parsed.releaseDate,
      trackCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return toReleaseDetail(release, true);
  },

  async updateRelease(walletAddress: string, releaseId: string, input: unknown) {
    const profile = await ensureOwnerProfile(walletAddress);
    const existing = await releasesRepository.findById(releaseId);

    if (!existing || existing.artistId !== profile.id) {
      throw new Error("Release not found");
    }

    const parsed = releaseUpdateSchema.parse(input);
    const nextStatus = parsed.status ?? existing.status;
    const assignments = await releasesRepository.listTracks(releaseId);

    if (nextStatus === "published" && assignments.length === 0) {
      throw new Error("Add at least one track before publishing a release");
    }

    if (nextStatus === "published") {
      const assignedTracks = await Promise.all(
        assignments.map((assignment) => tracksRepository.findById(assignment.track_id)),
      );
      const hasBlockedTrack = assignedTracks.some(
        (track) => !track || !track.playbackReady || track.access === "private",
      );

      if (hasBlockedTrack) {
        throw new Error(
          "All tracks must be ready for playback and not private before publishing a release",
        );
      }
    }

    const updated = await releasesRepository.upsert({
      ...existing,
      title: parsed.title?.trim() || existing.title,
      artistName: parsed.artistName?.trim() || existing.artistName,
      type: parsed.type ?? existing.type,
      genre: parsed.genre?.trim() || existing.genre,
      description:
        parsed.description !== undefined
          ? parsed.description.trim() || undefined
          : existing.description,
      coverStorageKey:
        parsed.coverStorageKey !== undefined
          ? parsed.coverStorageKey.trim() || undefined
          : existing.coverStorageKey,
      releaseDate:
        parsed.releaseDate !== undefined ? parsed.releaseDate : existing.releaseDate,
      status: nextStatus,
      publishedAt:
        nextStatus === "published"
          ? parsed.publishedAt ?? existing.publishedAt ?? new Date().toISOString()
          : existing.publishedAt,
      updatedAt: new Date().toISOString(),
    });

    return toReleaseDetail(updated, true);
  },

  async addTrackToRelease(walletAddress: string, releaseId: string, input: unknown) {
    const profile = await ensureOwnerProfile(walletAddress);
    const release = await releasesRepository.findById(releaseId);

    if (!release || release.artistId !== profile.id) {
      throw new Error("Release not found");
    }

    const parsed = releaseTrackAssignSchema.parse(input);
    const track = await tracksRepository.findById(parsed.trackId);

    if (!track || track.artistId !== profile.id) {
      throw new Error("Track not found");
    }

    const existingAssignments = await releasesRepository.listTracks(releaseId);
    const alreadyInRelease = existingAssignments.find(
      (assignment) => assignment.track_id === track.id,
    );
    const trackNumber =
      parsed.trackNumber ??
      alreadyInRelease?.track_number ??
      existingAssignments.length + 1;

    if (release.type === "single") {
      const otherTracks = existingAssignments.filter(
        (assignment) => assignment.track_id !== track.id,
      );

      if (otherTracks.length > 0) {
        throw new Error("Singles can only contain one track in this version");
      }
    }

    await releasesRepository.assignTrack(
      releaseId,
      track.id,
      trackNumber,
      parsed.discNumber,
      parsed.isFocusTrack,
    );
    await syncTrackReleaseFields(track, release, {
      trackNumber,
      discNumber: parsed.discNumber,
      isFocusTrack: parsed.isFocusTrack,
    });
    const syncedRelease = await syncReleaseTrackCount(release);

    return toReleaseDetail(syncedRelease, true);
  },

  async reorderReleaseTracks(walletAddress: string, releaseId: string, input: unknown) {
    const profile = await ensureOwnerProfile(walletAddress);
    const release = await releasesRepository.findById(releaseId);

    if (!release || release.artistId !== profile.id) {
      throw new Error("Release not found");
    }

    const parsed = releaseTrackReorderSchema.parse(input);

    for (const item of parsed.items) {
      const track = await tracksRepository.findById(item.trackId);

      if (!track || track.artistId !== profile.id) {
        throw new Error("Track not found");
      }

      await releasesRepository.assignTrack(
        releaseId,
        item.trackId,
        item.trackNumber,
        item.discNumber,
        item.isFocusTrack,
      );
      await syncTrackReleaseFields(track, release, item);
    }

    const syncedRelease = await syncReleaseTrackCount(release);
    return toReleaseDetail(syncedRelease, true);
  },

  async removeTrackFromRelease(walletAddress: string, releaseId: string, trackId: string) {
    const profile = await ensureOwnerProfile(walletAddress);
    const release = await releasesRepository.findById(releaseId);
    const track = await tracksRepository.findById(trackId);

    if (!release || release.artistId !== profile.id || !track || track.artistId !== profile.id) {
      throw new Error("Release track not found");
    }

    await releasesRepository.removeTrack(releaseId, trackId);
    await syncTrackReleaseFields(track, null);
    const syncedRelease = await syncReleaseTrackCount(release);

    return toReleaseDetail(syncedRelease, true);
  },

  async attachCoverArt(releaseId: string, payload: { coverStorageKey: string }) {
    const existing = await releasesRepository.findById(releaseId);

    if (!existing) {
      throw new Error("Release not found");
    }

    const updated = await releasesRepository.upsert({
      ...existing,
      coverStorageKey: payload.coverStorageKey,
      coverImageUrl: storageService.getDownloadUrl(payload.coverStorageKey),
      updatedAt: new Date().toISOString(),
    });

    return toReleaseDetail(updated, true);
  },
};
