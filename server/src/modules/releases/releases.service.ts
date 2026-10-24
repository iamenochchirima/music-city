import { ZodError } from "zod";
import { publicationService } from "../publication/publication.service.js";
import {
  releaseCreateSchema,
  releaseTrackMetadataSchema,
  releaseTrackAssignSchema,
  releaseTrackReorderSchema,
  releaseUpdateSchema,
  type ReleaseDetail,
  type ReleaseSummary,
  type TrackSummary,
} from "@music-city/shared";

import { liveRecording } from "./live-recording.js";
import { databaseService } from "../../services/database.service.js";
import { createId } from "../../services/id.service.js";
import { storageService } from "../../services/storage.service.js";
import { tracksRepository } from "../tracks/tracks.repository.js";
import { usersService } from "../users/users.service.js";
import {
  releasesRepository,
  type StoredRelease,
} from "./releases.repository.js";

const plannedSongCount = (type: ReleaseSummary["type"], count?: number) => {
  if (
    count !== undefined &&
    ((type === "single" && count !== 1) ||
      (type === "ep" && (count < 2 || count > 6)) ||
      (type === "album" && count < 7))
  ) {
    throw new ZodError([
      {
        code: "custom",
        path: ["expectedTrackCount"],
        message: "Choose a song count that matches the release format",
      },
    ]);
  }
  return type === "single" ? 1 : count;
};

const hydrateReleaseUrls = <
  T extends { coverStorageKey?: string; coverImageUrl?: string },
>(
  release: T,
) => ({
  ...release,
  coverImageUrl: release.coverStorageKey
    ? storageService.getImageUrl(release.coverStorageKey)
    : release.coverImageUrl,
});

const hydrateTrackUrls = <
  T extends { coverStorageKey?: string; coverImageUrl?: string },
>(
  track: T,
) => {
  const nextTrack = {
    ...track,
    coverImageUrl: track.coverStorageKey
      ? storageService.getImageUrl(track.coverStorageKey)
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

const publicTrackMediaView = <T extends TrackSummary>(track: T): T => ({
  ...track,
  playbackUrl: undefined,
  streamManifestUrl: undefined,
  streamMediaUrl: undefined,
  masterStorageKey: undefined,
  streamManifestKey: undefined,
  muxUploadId: undefined,
  muxAssetId: undefined,
  muxPlaybackId: undefined,
});

const toReleaseDetail = async (
  release: StoredRelease,
  includePrivateTracks: boolean,
): Promise<ReleaseDetail> => {
  if (!includePrivateTracks && release.liveVersion) {
    const live = release.liveVersion;
    return {
      ...hydrateReleaseUrls(live),
      hasRevision: undefined,
      tracks: await Promise.all(
        live.tracks
          .filter(
            (item) => live.status === "published" && item.track.playbackReady,
          )
          .map(async (item) => {
            const current = await tracksRepository.findById(item.trackId);
            return {
              ...item,
              track: publicTrackMediaView(hydrateTrackUrls(
                current ? liveRecording(current, item.track) : item.track,
              )),
            };
          }),
      ),
    };
  }
  const { liveVersion, ...visibleRelease } = release;
  const isPublicRelease = release.status === "published";
  const assignments = [
    ...(await releasesRepository.listTracks(release.id)),
  ].sort(
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
        track: includePrivateTracks
          ? hydrateTrackUrls(viewTrack)
          : publicTrackMediaView(hydrateTrackUrls(viewTrack)),
      };
    }),
  );

  return {
    ...hydrateReleaseUrls(visibleRelease),
    hasRevision: !!liveVersion,
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

const syncReleaseTrackCount = async (release: StoredRelease) => {
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

const ensureOwnerProfile = async (walletAddress: string) =>
  usersService.requireArtistOnboardingAccess(
    walletAddress,
    "Create an artist profile before managing releases",
    "Pay the onboarding fee before managing releases",
  );

const validateReleaseTrackCount = (
  release: ReleaseSummary,
  trackCount: number,
) => {
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

const requireEditable = (release: StoredRelease) => {
  if (
    ["published", "scheduled"].includes(release.status) &&
    !release.liveVersion
  )
    throw new Error(
      "Start a revision before editing a scheduled or published release",
    );
};
const publicSummary = (release: StoredRelease) => {
  const { tracks: _tracks, ...live } = release.liveVersion ?? {
    ...release,
    tracks: [],
  };
  const {
    liveVersion: _version,
    hasRevision: _revision,
    ...summary
  } = live as StoredRelease;
  return hydrateReleaseUrls(summary);
};
const resolvePublicReleaseState = async (release: StoredRelease) => release;

export const releasesService = {
  async applyTrackMetadata(
    walletAddress: string,
    releaseId: string,
    input: unknown,
  ) {
    const parsed = releaseTrackMetadataSchema.parse(input);
    const profile = await usersService.requireArtistOnboardingAccess(
      walletAddress,
      "Create a profile before managing tracks",
    );
    if (!profile) throw new Error("Release not found");
    const release = await releasesRepository.findById(releaseId);
    if (!release || release.artistId !== profile.id)
      throw new Error("Release not found");
    requireEditable(release);
    return databaseService.applyReleaseTrackMetadata(
      profile.id,
      releaseId,
      parsed,
    );
  },

  async listReleases() {
    const releases = await Promise.all(
      (await releasesRepository.list()).map((release) =>
        resolvePublicReleaseState(release),
      ),
    );
    return releases
      .filter(
        (release) =>
          release.status === "published" || release.status === "scheduled",
      )
      .map(publicSummary);
  },

  async listPublicReleasesByArtist(artistId: string) {
    const releases = await Promise.all(
      (await releasesRepository.listByArtist(artistId)).map((release) =>
        resolvePublicReleaseState(release),
      ),
    );
    return releases
      .filter(
        (release) =>
          release.status === "published" || release.status === "scheduled",
      )
      .map(publicSummary);
  },

  async listMyReleases(walletAddress: string) {
    const profile = await ensureOwnerProfile(walletAddress);
    return Promise.all(
      (await releasesRepository.listByArtist(profile.id)).map(
        async (release) => ({
          ...release,
          publication: await publicationService.latest(release.id),
          coverImageUrl: hydrateReleaseUrls(release).coverImageUrl,
          liveVersion: undefined,
          hasRevision: !!release.liveVersion,
        }),
      ),
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

    return {
      ...(await toReleaseDetail(release, true)),
      publication: await publicationService.latest(releaseId),
    };
  },

  async getReleaseForUpload(releaseId: string) {
    const release = await releasesRepository.findById(releaseId);
    return release
      ? {
          ...publicSummary(release),
          ...release,
          liveVersion: undefined,
          hasRevision: !!release.liveVersion,
        }
      : null;
  },

  async userOwnsRelease(walletAddress: string, releaseId: string) {
    const profile = await usersService.getProfile(walletAddress);
    const release = await releasesRepository.findById(releaseId);

    return Boolean(profile && release && release.artistId === profile.id);
  },

  async beginRevision(walletAddress: string, releaseId: string) {
    const profile = await ensureOwnerProfile(walletAddress);
    let release = await releasesRepository.findById(releaseId);
    if (!release || release.artistId !== profile.id)
      throw new Error("Release not found");
    release = await resolvePublicReleaseState(release);
    if (release.liveVersion) return toReleaseDetail(release, true);
    if (!["scheduled", "published"].includes(release.status))
      throw new Error("Only scheduled or published releases need a revision");
    const liveVersion = await toReleaseDetail(release, true);
    const updated = await databaseService.beginReleaseRevision(
      release.id,
      profile.id,
      liveVersion,
    );
    return toReleaseDetail(updated, true);
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
      expectedTrackCount: plannedSongCount(
        parsed.type,
        parsed.expectedTrackCount,
      ),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return toReleaseDetail(release, true);
  },

  async updateRelease(
    walletAddress: string,
    releaseId: string,
    input: unknown,
  ) {
    const profile = await ensureOwnerProfile(walletAddress);
    const existing = await releasesRepository.findById(releaseId);

    if (!existing || existing.artistId !== profile.id) {
      throw new Error("Release not found");
    }

    const parsed = releaseUpdateSchema.parse(input);
    if (parsed.status === "published" || parsed.status === "scheduled") {
      const {
        status,
        publishedAt: _published,
        releaseDate,
        ...details
      } = parsed;
      if (Object.keys(details).length)
        await this.updateRelease(walletAddress, releaseId, details);
      await publicationService.request(walletAddress, releaseId, {
        mode: status,
        releaseAt: releaseDate,
      });
      const managed = await this.getManageRelease(walletAddress, releaseId);
      if (!managed) throw new Error("Release not found");
      return managed;
    }

    if (!(
      parsed.status === "draft" &&
      Object.keys(parsed).length === 1 &&
      !existing.liveVersion
    ))
      requireEditable(existing);
    const nextStatus = parsed.status ?? existing.status;
    const assignments = await releasesRepository.listTracks(releaseId);
    const releaseForValidation: ReleaseSummary = {
      ...existing,
      title: parsed.title !== undefined ? parsed.title.trim() : existing.title,
      artistName: parsed.artistName?.trim() || existing.artistName,
      type: parsed.type ?? existing.type,
      expectedTrackCount: plannedSongCount(
        parsed.type ?? existing.type,
        parsed.expectedTrackCount ??
          (parsed.type && parsed.type !== existing.type
            ? undefined
            : existing.expectedTrackCount),
      ),
      genre: parsed.genre !== undefined ? parsed.genre.trim() : existing.genre,
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

    const next: StoredRelease = {
      ...existing,
      title: parsed.title !== undefined ? parsed.title.trim() : existing.title,
      artistName: parsed.artistName?.trim() || existing.artistName,
      type: parsed.type ?? existing.type,
      expectedTrackCount: plannedSongCount(
        parsed.type ?? existing.type,
        parsed.expectedTrackCount ??
          (parsed.type && parsed.type !== existing.type
            ? undefined
            : existing.expectedTrackCount),
      ),
      genre: parsed.genre !== undefined ? parsed.genre.trim() : existing.genre,
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
        parsed.releaseDate !== undefined
          ? parsed.releaseDate
          : existing.releaseDate,
      status: nextStatus,
      publishedAt: nextStatus === "draft" ? undefined : existing.publishedAt,
      updatedAt: new Date().toISOString(),
    };
    if (existing.liveVersion && parsed.status)
      throw new Error(
        "Save the revision without changing its publication status",
      );
    const updated = await releasesRepository.upsert(next);
    if (parsed.status === "draft")
      await unpublishReleaseTracks(
        (
          await Promise.all(
            assignments.map((item) => tracksRepository.findById(item.track_id)),
          )
        ).filter((track): track is TrackSummary => Boolean(track)),
      );
    return toReleaseDetail(updated, true);
  },

  async addTrackToRelease(
    walletAddress: string,
    releaseId: string,
    input: unknown,
  ) {
    const profile = await ensureOwnerProfile(walletAddress);
    const release = await releasesRepository.findById(releaseId);

    if (!release || release.artistId !== profile.id) {
      throw new Error("Release not found");
    }

    requireEditable(release);

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

      if (
        assignments.some((assignment) => assignment.track_id === track.id) ||
        artistRelease.liveVersion?.tracks.some(
          (item) => item.trackId === track.id,
        )
      ) {
        throw new Error("This track is already assigned to another release");
      }
    }

    if (
      !alreadyInRelease &&
      release.expectedTrackCount &&
      existingAssignments.length >= release.expectedTrackCount
    ) {
      throw new Error(
        "All songs have been added. Update the song count before adding more.",
      );
    }

    const trackNumber =
      parsed.trackNumber ??
      alreadyInRelease?.track_number ??
      Math.max(0, ...existingAssignments.map((item) => item.track_number)) + 1;

    if (
      !alreadyInRelease &&
      ((release.type === "single" && existingAssignments.length >= 1) ||
        (release.type === "ep" && existingAssignments.length >= 6))
    ) {
      throw new Error(
        "This release is full. Change its format before adding more songs.",
      );
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
    if (release.liveVersion?.tracks.some((item) => item.trackId === track.id)) {
      // Existing live audio retains its visibility until the revision is applied.
    } else {
      await unpublishReleaseTracks([track]);
    }
    const syncedRelease = await syncReleaseTrackCount(release);

    return toReleaseDetail(syncedRelease, true);
  },

  async reorderReleaseTracks(
    walletAddress: string,
    releaseId: string,
    input: unknown,
  ) {
    const profile = await ensureOwnerProfile(walletAddress);
    const release = await releasesRepository.findById(releaseId);

    if (!release || release.artistId !== profile.id) {
      throw new Error("Release not found");
    }

    requireEditable(release);

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
      throw new Error(
        "Reorder the existing release tracklist without adding tracks",
      );
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

  async removeTrackFromRelease(
    walletAddress: string,
    releaseId: string,
    trackId: string,
  ) {
    const profile = await ensureOwnerProfile(walletAddress);
    const release = await releasesRepository.findById(releaseId);
    const track = await tracksRepository.findById(trackId);

    if (
      !release ||
      release.artistId !== profile.id ||
      !track ||
      track.artistId !== profile.id
    ) {
      throw new Error("Release track not found");
    }

    requireEditable(release);

    await releasesRepository.removeTrack(releaseId, trackId);
    await syncTrackReleaseFields(track, null);
    if (!release.liveVersion?.tracks.some((item) => item.trackId === track.id))
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

    const assignments = [
      ...(await releasesRepository.listTracks(releaseId)),
      ...(release.liveVersion?.tracks.map((item) => ({
        track_id: item.trackId,
      })) ?? []),
    ];

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

  async attachCoverArt(
    releaseId: string,
    payload: { coverStorageKey: string },
  ) {
    const existing = await releasesRepository.findById(releaseId);

    if (!existing) {
      throw new Error("Release not found");
    }

    requireEditable(existing);
    const updated = await releasesRepository.upsert({
      ...existing,
      coverStorageKey: payload.coverStorageKey,
      coverImageUrl: storageService.getImageUrl(payload.coverStorageKey),
      updatedAt: new Date().toISOString(),
    });

    return toReleaseDetail(updated, true);
  },
};
