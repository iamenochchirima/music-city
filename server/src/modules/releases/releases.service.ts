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
  const isPublicRelease = release.status === "published";
  const assignments = [...(await releasesRepository.listTracks(release.id))].sort(
    (left, right) =>
      left.disc_number - right.disc_number ||
      left.track_number - right.track_number ||
      left.track_id.localeCompare(right.track_id),
  );
  const tracks = await Promise.all(
    assignments.map(async (assignment) => {
      const track = await tracksRepository.findById(assignment.track_id);
      if (!track) {
        return null;
      }

      const viewTrack: TrackSummary = {
        ...track,
        visibility: isPublicRelease ? "published" : "unpublished",
        priceLabel: isPublicRelease ? "Published" : "Unpublished",
      };

      return {
        trackId: assignment.track_id,
        trackNumber: assignment.track_number,
        discNumber: assignment.disc_number,
        isFocusTrack: assignment.is_focus_track,
        track: hydrateTrackUrls(viewTrack),
      };
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
          Boolean(isPublicRelease && item.track.playbackReady)),
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

  if (!profile || !["artist", "both"].includes(profile.primaryIntent)) {
    throw new Error("Create an artist profile before managing releases");
  }

  return profile;
};

const validateReleaseTrackCount = (release: ReleaseSummary, trackCount: number) => {
  if (trackCount === 0) {
    throw new Error("Add at least one track before releasing this project");
  }

  if (release.type === "single" && trackCount !== 1) {
    throw new Error("Singles must contain exactly one track");
  }

  if (release.type === "ep" && (trackCount < 2 || trackCount > 6)) {
    throw new Error("EPs must contain between 2 and 6 tracks");
  }

  if (release.type === "album" && trackCount < 7) {
    throw new Error("Albums must contain at least 7 tracks");
  }
};

const validateReleaseTracklist = (
  assignments: Array<{
    track_id: string;
    track_number: number;
    disc_number: number;
    is_focus_track: boolean;
  }>,
) => {
  const trackIds = new Set<string>();
  const positions = new Set<string>();
  let focusTrackCount = 0;

  for (const assignment of assignments) {
    if (trackIds.has(assignment.track_id)) {
      throw new Error("A release track can only appear once in the tracklist");
    }

    trackIds.add(assignment.track_id);

    const position = `${assignment.disc_number}:${assignment.track_number}`;
    if (positions.has(position)) {
      throw new Error("Each track needs a unique disc and track number");
    }

    positions.add(position);

    if (assignment.is_focus_track) {
      focusTrackCount += 1;
    }
  }

  if (focusTrackCount > 1) {
    throw new Error("A release can have only one focus track");
  }
};

const validateReleaseMetadata = (release: ReleaseSummary) => {
  if (!release.title.trim() || !release.artistName.trim() || !release.genre.trim()) {
    throw new Error("Add the release title, artist, and genre before publishing");
  }

  if (!release.coverStorageKey && !release.coverImageUrl) {
    throw new Error("Upload release artwork before publishing");
  }
};

const validateReleaseTracksForPublishing = async (
  release: ReleaseSummary,
  assignments: Awaited<ReturnType<typeof releasesRepository.listTracks>>,
) => {
  validateReleaseMetadata(release);
  validateReleaseTrackCount(release, assignments.length);
  validateReleaseTracklist(assignments);

  const assignedTracks = await Promise.all(
    assignments.map((assignment) => tracksRepository.findById(assignment.track_id)),
  );
  const hasBlockedTrack = assignedTracks.some(
    (track) => !track || !track.playbackReady,
  );

  if (hasBlockedTrack) {
    throw new Error(
      "All tracks must finish audio processing before releasing this project",
    );
  }

  return assignedTracks.filter((track): track is TrackSummary => Boolean(track));
};

const publishReleaseTracks = async (tracks: TrackSummary[]) => {
  await Promise.all(
    tracks.map((track) =>
      tracksRepository.upsert({
        ...track,
        visibility: "published",
        priceLabel: "Published",
        updatedAt: new Date().toISOString(),
      }),
    ),
  );
};

const unpublishReleaseTracks = async (tracks: TrackSummary[]) => {
  await Promise.all(
    tracks.map((track) =>
      tracksRepository.upsert({
        ...track,
        visibility: "unpublished",
        priceLabel: "Unpublished",
        updatedAt: new Date().toISOString(),
      }),
    ),
  );
};

const releaseDateHasArrived = (releaseDate?: string) =>
  Boolean(releaseDate && Date.parse(releaseDate) <= Date.now());

const resolvePublishedReleaseDate = (
  existing: ReleaseSummary,
  parsedReleaseDate?: string,
) => {
  if (parsedReleaseDate) {
    return parsedReleaseDate;
  }

  if (existing.releaseDate && Date.parse(existing.releaseDate) <= Date.now()) {
    return existing.releaseDate;
  }

  return new Date().toISOString();
};

const resolvePublicReleaseState = async (release: ReleaseSummary) => {
  if (release.status !== "scheduled") {
    return release;
  }

  if (!releaseDateHasArrived(release.releaseDate)) {
    return release;
  }

  const assignments = await releasesRepository.listTracks(release.id);
  const tracks = await validateReleaseTracksForPublishing(release, assignments);
  await publishReleaseTracks(tracks);

  return releasesRepository.upsert({
    ...release,
    status: "published",
    publishedAt: release.publishedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
};

export const releasesService = {
  async listReleases() {
    const releases = await Promise.all(
      (await releasesRepository.list()).map((release) => resolvePublicReleaseState(release)),
    );
    return releases
      .filter((release) => release.status === "published" || release.status === "scheduled")
      .map((release) => hydrateReleaseUrls(release));
  },

  async listPublicReleasesByArtist(artistId: string) {
    const releases = await Promise.all(
      (await releasesRepository.listByArtist(artistId)).map((release) =>
        resolvePublicReleaseState(release),
      ),
    );
    return releases
      .filter((release) => release.status === "published" || release.status === "scheduled")
      .map((release) => hydrateReleaseUrls(release));
  },

  async listMyReleases(walletAddress: string) {
    const profile = await ensureOwnerProfile(walletAddress);
    return (await releasesRepository.listByArtist(profile.id)).map((release) =>
      hydrateReleaseUrls(release),
    );
  },

  async getRelease(releaseId: string) {
    const rawRelease = await releasesRepository.findById(releaseId);

    if (!rawRelease) {
      return null;
    }

    const release = await resolvePublicReleaseState(rawRelease);

    if (release.status !== "published" && release.status !== "scheduled") {
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
      recordLabel: parsed.recordLabel?.trim() || undefined,
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
    const releaseForValidation: ReleaseSummary = {
      ...existing,
      title: parsed.title?.trim() || existing.title,
      artistName: parsed.artistName?.trim() || existing.artistName,
      type: parsed.type ?? existing.type,
      genre: parsed.genre?.trim() || existing.genre,
      description:
        parsed.description !== undefined
          ? parsed.description.trim() || undefined
          : existing.description,
      recordLabel:
        parsed.recordLabel !== undefined
          ? parsed.recordLabel.trim() || undefined
          : existing.recordLabel,
      coverStorageKey:
        parsed.coverStorageKey !== undefined
          ? parsed.coverStorageKey.trim() || undefined
          : existing.coverStorageKey,
    };

    let tracksReadyForPublishing: TrackSummary[] | null = null;

    if (nextStatus === "published") {
      tracksReadyForPublishing = await validateReleaseTracksForPublishing(releaseForValidation, assignments);
    }

    if (nextStatus === "scheduled") {
      await validateReleaseTracksForPublishing(releaseForValidation, assignments);

      if (!parsed.releaseDate) {
        throw new Error("Choose a release date and time before scheduling");
      }

      if (Date.parse(parsed.releaseDate) <= Date.now()) {
        throw new Error("Scheduled releases must be set in the future");
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
      recordLabel:
        parsed.recordLabel !== undefined
          ? parsed.recordLabel.trim() || undefined
          : existing.recordLabel,
      coverStorageKey:
        parsed.coverStorageKey !== undefined
          ? parsed.coverStorageKey.trim() || undefined
          : existing.coverStorageKey,
      releaseDate:
        nextStatus === "published"
          ? resolvePublishedReleaseDate(existing, parsed.releaseDate)
          : parsed.releaseDate !== undefined
            ? parsed.releaseDate
            : existing.releaseDate,
      status: nextStatus,
      publishedAt:
        nextStatus === "published"
          ? parsed.publishedAt ?? existing.publishedAt ?? new Date().toISOString()
          : nextStatus === "draft"
            ? undefined
            : existing.publishedAt,
      updatedAt: new Date().toISOString(),
    });

    if (nextStatus === "published" && tracksReadyForPublishing) {
      await publishReleaseTracks(tracksReadyForPublishing);
    } else {
      await unpublishReleaseTracks(
        (
          await Promise.all(
            assignments.map((assignment) => tracksRepository.findById(assignment.track_id)),
          )
        ).filter((track): track is TrackSummary => Boolean(track)),
      );
    }

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

    const artistReleases = await releasesRepository.listByArtist(profile.id);
    for (const artistRelease of artistReleases) {
      if (artistRelease.id === releaseId) {
        continue;
      }

      const assignments = await releasesRepository.listTracks(artistRelease.id);

      if (assignments.some((assignment) => assignment.track_id === track.id)) {
        throw new Error("This track is already assigned to another release");
      }
    }

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

    if (
      release.type === "ep" &&
      !alreadyInRelease &&
      existingAssignments.length >= 6
    ) {
      throw new Error("EPs can contain at most 6 tracks");
    }

    if (
      parsed.isFocusTrack &&
      !alreadyInRelease &&
      existingAssignments.some((assignment) => assignment.is_focus_track)
    ) {
      throw new Error("A release can have only one focus track");
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
    if (release.status === "published") {
      await publishReleaseTracks([track]);
    } else {
      await unpublishReleaseTracks([track]);
    }
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
    const existingTrackIds = new Set(
      (await releasesRepository.listTracks(releaseId)).map(
        (assignment) => assignment.track_id,
      ),
    );

    if (
      parsed.items.length !== existingTrackIds.size ||
      parsed.items.some((item) => !existingTrackIds.has(item.trackId))
    ) {
      throw new Error("Reorder the existing release tracklist without adding tracks");
    }

    const proposedAssignments = parsed.items.map((item) => ({
      track_id: item.trackId,
      track_number: item.trackNumber,
      disc_number: item.discNumber,
      is_focus_track: item.isFocusTrack,
    }));
    validateReleaseTracklist(proposedAssignments);

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
    await unpublishReleaseTracks([track]);
    const syncedRelease = await syncReleaseTrackCount(release);

    return toReleaseDetail(syncedRelease, true);
  },

  async deleteRelease(walletAddress: string, releaseId: string) {
    const profile = await ensureOwnerProfile(walletAddress);
    const release = await releasesRepository.findById(releaseId);

    if (!release || release.artistId !== profile.id) {
      throw new Error("Release not found");
    }

    const assignments = await releasesRepository.listTracks(releaseId);

    for (const assignment of assignments) {
      const track = await tracksRepository.findById(assignment.track_id);

      if (!track || track.artistId !== profile.id) {
        continue;
      }

      await syncTrackReleaseFields(track, null);
      await unpublishReleaseTracks([track]);
    }

    await releasesRepository.delete(releaseId);
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
