import {
  trackMonetizationUpdateSchema,
  trackMetadataUpdateSchema,
  trackCreateSchema,
  type TrackMonetizationUpdateInput,
  type TrackSummary,
  type TrackCreateInput,
  type TrackMetadataUpdateInput,
} from "@music-city/shared";

import { createId } from "../../services/id.service.js";
import { muxService } from "../../services/mux.service.js";
import { storageService } from "../../services/storage.service.js";
import { env } from "../../config/env.js";
import { normalizePositiveAmount, normalizeStellarAsset } from "../../utils/commerce.js";
import { usersService } from "../users/users.service.js";
import { tracksRepository } from "./tracks.repository.js";

const formatRuntime = (seconds?: number) => {
  if (!seconds || Number.isNaN(seconds)) {
    return "Ready";
  }

  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

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
    mediaStorageProvider?: "local" | "s3";
    streamMediaUrl?: string;
    playbackUrl?: string;
  };

  if (nextTrack.masterStorageKey && nextTrack.mediaProvider !== "mux") {
    const freshMediaUrl = storageService.getDownloadUrl(
      nextTrack.masterStorageKey,
      nextTrack.mediaStorageProvider,
    );
    nextTrack.streamMediaUrl = freshMediaUrl;
    nextTrack.playbackUrl = freshMediaUrl;
  }

  return nextTrack;
};

const hydrateTrackForView = (track: TrackSummary, isPublic: boolean): TrackSummary =>
  hydrateTrackUrls({
    ...track,
    visibility: isPublic ? ("published" as const) : ("unpublished" as const),
    priceLabel: isPublic ? "Published" : "Unpublished",
  }) as TrackSummary;

export const tracksService = {
  async isTrackPublic(trackId: string) {
    return tracksRepository.isTrackInPublicRelease(trackId);
  },

  async listTracks() {
    const publicTrackIds = new Set(await tracksRepository.listPublicTrackIds());
    const tracks = await tracksRepository.list();
    return tracks
      .filter((track) => track.playbackReady && publicTrackIds.has(track.id))
      .map((track) => hydrateTrackForView(track, true));
  },

  async listMyTracks(walletAddress: string) {
    const profile = await usersService.getProfile(walletAddress);

    if (!profile || !["artist", "both"].includes(profile.primaryIntent)) {
      return [];
    }

    const tracks = await tracksRepository.listByArtist(profile.id);
    const publicTrackIds = new Set(await tracksRepository.listPublicTrackIds(profile.id));
    return tracks.map((track) => hydrateTrackForView(track, publicTrackIds.has(track.id)));
  },

  async listPublicTracksByArtist(artistId: string) {
    const tracks = await tracksRepository.listByArtist(artistId);
    const publicTrackIds = new Set(await tracksRepository.listPublicTrackIds(artistId));

    return tracks
      .filter((track) => track.playbackReady && publicTrackIds.has(track.id))
      .map((track) => hydrateTrackForView(track, true));
  },

  async getTrack(trackId: string) {
    const track = await tracksRepository.findById(trackId);
    if (!track) {
      return null;
    }

    if (!track.playbackReady || !(await tracksRepository.isTrackInPublicRelease(track.id))) {
      return null;
    }

    return hydrateTrackForView(track, true);
  },

  async getTrackForPlayback(trackId: string) {
    const track = await tracksRepository.findById(trackId);
    if (!track) {
      return null;
    }

    if (!track.playbackReady) {
      return null;
    }

    return hydrateTrackForView(
      track,
      await tracksRepository.isTrackInPublicRelease(track.id),
    );
  },

  async getTrackForUpload(trackId: string) {
    const track = await tracksRepository.findById(trackId);

    return track
      ? hydrateTrackForView(
          track,
          await tracksRepository.isTrackInPublicRelease(track.id),
        )
      : null;
  },

  async getManageTrack(walletAddress: string, trackId: string) {
    const profile = await usersService.requireArtistOnboardingAccess(
      walletAddress,
      "Create a profile before managing tracks",
    );
    const track = await tracksRepository.findById(trackId);

    if (!profile || !track || track.artistId !== profile.id) {
      return null;
    }

    return hydrateTrackForView(
      track,
      await tracksRepository.isTrackInPublicRelease(track.id),
    );
  },

  async userOwnsTrack(walletAddress: string, trackId: string) {
    const profile = await usersService.getProfile(walletAddress);
    const track = await tracksRepository.findById(trackId);

    return Boolean(profile && track && track.artistId === profile.id);
  },

  async deleteTrack(walletAddress: string, trackId: string) {
    const profile = await usersService.requireArtistOnboardingAccess(
      walletAddress,
      "Create a profile before managing tracks",
    );
    const track = await tracksRepository.findById(trackId);

    if (!profile || !track || track.artistId !== profile.id) {
      throw new Error("Track not found");
    }

    if (track.muxAssetId) {
      await muxService.deleteAsset(track.muxAssetId).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);

        if (!message.toLowerCase().includes("404")) {
          throw error;
        }
      });
    } else if (track.muxUploadId) {
      await muxService.cancelUpload(track.muxUploadId).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);

        if (
          !message.toLowerCase().includes("404") &&
          !message.toLowerCase().includes("not found")
        ) {
          throw error;
        }
      });
    }

    if (track.coverStorageKey) {
      await storageService.deleteObject(track.coverStorageKey);
    }

    if (track.masterStorageKey) {
      await storageService.deleteObject(track.masterStorageKey);
    }

    if (
      track.streamManifestKey &&
      !track.streamManifestKey.startsWith("virtual/")
    ) {
      await storageService.deleteObject(track.streamManifestKey);
    }

    await tracksRepository.delete(trackId);
  },

  async createTrack(walletAddress: string, input: TrackCreateInput) {
    const profile = await usersService.requireArtistOnboardingAccess(
      walletAddress,
      "Create a profile before creating tracks",
      "Pay the one-time artist fee before your first upload",
    );

    const timestamp = new Date().toISOString();
    const parsed = trackCreateSchema.parse(input);
    const purchaseEnabled = parsed.purchaseEnabled ?? false;
    const purchasePrice = purchaseEnabled
      ? normalizePositiveAmount(
          parsed.purchasePrice ?? env.TRACK_PURCHASE_DEFAULT_PRICE,
          "Track purchase price",
        )
      : undefined;
    const purchaseAsset = purchaseEnabled
      ? normalizeStellarAsset(
          {
            code:
              parsed.purchaseAssetCode ?? env.STELLAR_SETTLEMENT_ASSET_CODE,
            issuer:
              parsed.purchaseAssetIssuer ??
              env.STELLAR_SETTLEMENT_ASSET_ISSUER,
          },
          "Track purchase",
        )
      : undefined;
    const track = tracksRepository.upsert({
      id: createId("trk"),
      title: parsed.title,
      artistId: profile.id,
      artistName: parsed.artistName?.trim() || profile.displayName,
      releaseArtistName: parsed.artistName?.trim() || profile.displayName,
      featuredArtists: parsed.featuredArtists ?? [],
      isrc: parsed.isrc?.trim() || undefined,
      credits: parsed.credits ?? [],
      isExplicit: parsed.isExplicit,
      genre: parsed.genre,
      runtime: "Not processed",
      priceLabel: parsed.priceLabel ?? "Unpublished",
      status: "awaiting_upload",
      visibility: "unpublished",
      purchaseEnabled,
      purchasePrice,
      purchaseAssetCode: purchaseAsset?.code,
      purchaseAssetIssuer: purchaseAsset?.issuer,
      plays: 0,
      likes: 0,
      description: parsed.description,
      mediaProvider: "local",
      playbackReady: false,
      archiveStatus: "not_requested",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return track;
  },

  async updateTrackMetadata(
    walletAddress: string,
    trackId: string,
    input: TrackMetadataUpdateInput,
  ) {
    const profile = await usersService.requireArtistOnboardingAccess(
      walletAddress,
      "Create a profile before managing tracks",
    );
    const existing = await tracksRepository.findById(trackId);

    if (!profile || !existing || existing.artistId !== profile.id) {
      throw new Error("Track not found");
    }

    const parsed = trackMetadataUpdateSchema.parse(input);

    const linkedArtistIds = [
      ...new Set(
        (parsed.credits ?? [])
          .map((credit) => credit.artistId)
          .filter((artistId): artistId is string => Boolean(artistId)),
      ),
    ];

    for (const artistId of linkedArtistIds) {
      const artist = await usersService.getProfileById(artistId);

      if (!artist || !["artist", "both"].includes(artist.primaryIntent)) {
        throw new Error("Linked credit profile must belong to an artist");
      }
    }

    return tracksRepository.upsert({
      ...existing,
      featuredArtists:
        parsed.featuredArtists !== undefined
          ? parsed.featuredArtists
          : existing.featuredArtists,
      credits: parsed.credits !== undefined ? parsed.credits : existing.credits,
      isrc:
        parsed.isrc !== undefined
          ? parsed.isrc.replaceAll("-", "").toUpperCase() || undefined
          : existing.isrc,
      isExplicit:
        parsed.isExplicit !== undefined ? parsed.isExplicit : existing.isExplicit,
      description:
        parsed.description !== undefined
          ? parsed.description.trim() || undefined
          : existing.description,
      updatedAt: new Date().toISOString(),
    });
  },

  async updateTrackMonetization(
    walletAddress: string,
    trackId: string,
    input: TrackMonetizationUpdateInput,
  ) {
    const profile = await usersService.requireArtistOnboardingAccess(
      walletAddress,
      "Create a profile before managing tracks",
    );
    const existing = await tracksRepository.findById(trackId);

    if (!profile || !existing || existing.artistId !== profile.id) {
      throw new Error("Track not found");
    }

    const parsed = trackMonetizationUpdateSchema.parse(input);

    const purchaseEnabled = parsed.purchaseEnabled ?? existing.purchaseEnabled ?? false;
    const purchasePrice = purchaseEnabled
      ? normalizePositiveAmount(
          parsed.purchasePrice ||
            existing.purchasePrice ||
            env.TRACK_PURCHASE_DEFAULT_PRICE,
          "Track purchase price",
        )
      : existing.purchasePrice;
    const purchaseAsset =
      purchaseEnabled
        ? normalizeStellarAsset(
            {
              code:
                parsed.purchaseAssetCode ||
                existing.purchaseAssetCode ||
                env.STELLAR_SETTLEMENT_ASSET_CODE,
              issuer:
                parsed.purchaseAssetIssuer ||
                existing.purchaseAssetIssuer ||
                env.STELLAR_SETTLEMENT_ASSET_ISSUER,
            },
            "Track purchase",
          )
        : undefined;
    const isPublic = await tracksRepository.isTrackInPublicRelease(existing.id);

    return tracksRepository.upsert({
      ...existing,
      visibility: isPublic ? "published" : "unpublished",
      purchaseEnabled,
      purchasePrice,
      purchaseAssetCode:
        purchaseAsset?.code ?? existing.purchaseAssetCode,
      purchaseAssetIssuer:
        purchaseAsset?.issuer ?? existing.purchaseAssetIssuer,
      priceLabel: isPublic ? "Published" : "Unpublished",
      updatedAt: new Date().toISOString(),
    });
  },

  async syncMuxTrack(trackId: string) {
    const existing = await tracksRepository.findById(trackId);

    if (!existing) {
      throw new Error("Track not found");
    }

    if (existing.mediaProvider !== "mux") {
      return existing;
    }

    if (existing.muxAssetId) {
      const asset = await muxService.getAsset(existing.muxAssetId);

      if (asset.status === "ready") {
        return this.markPlaybackReady(trackId, {
          runtime: formatRuntime(asset.duration),
          muxAssetId: asset.id,
          muxPlaybackId: asset.playback_ids?.[0]?.id,
        });
      }

      if (asset.status === "errored") {
        return this.markFailed(trackId, "Mux asset processing failed");
      }

      return this.markMuxAssetCreated(trackId, {
        muxAssetId: asset.id,
        muxUploadId: existing.muxUploadId,
      });
    }

    if (!existing.muxUploadId) {
      return existing;
    }

    const upload = await muxService.getUpload(existing.muxUploadId);

    if (upload.status === "asset_created" && upload.asset_id) {
      const updated = await this.markMuxAssetCreated(trackId, {
        muxAssetId: upload.asset_id,
        muxUploadId: upload.id,
      });

      if (!updated.muxAssetId) {
        return updated;
      }

      const asset = await muxService.getAsset(updated.muxAssetId);

      if (asset.status === "ready") {
        return this.markPlaybackReady(trackId, {
          runtime: formatRuntime(asset.duration),
          muxAssetId: asset.id,
          muxPlaybackId: asset.playback_ids?.[0]?.id,
        });
      }

      if (asset.status === "errored") {
        return this.markFailed(trackId, "Mux asset processing failed");
      }

      return updated;
    }

    if (upload.status === "errored") {
      return this.markFailed(
        trackId,
        upload.error?.message ?? upload.error?.type ?? "Mux upload failed",
      );
    }

    if (upload.status === "cancelled") {
      return this.markFailed(trackId, "Mux upload cancelled");
    }

    if (upload.status === "timed_out") {
      return this.markFailed(trackId, "Mux upload timed out");
    }

    return existing;
  },

  async attachMaster(trackId: string, payload: {
    masterStorageKey: string;
    sourceFileName: string;
    sourceContentType: string;
    sourceSizeBytes: number;
    storageProvider: "local" | "s3";
  }) {
    const existing = await tracksRepository.findById(trackId);

    if (!existing) {
      throw new Error("Track not found");
    }

    return tracksRepository.upsert({
      ...existing,
      status: "uploaded",
      runtime: "Uploaded",
      mediaProvider: "local",
      mediaStorageProvider: payload.storageProvider,
      masterStorageKey: payload.masterStorageKey,
      streamManifestKey: `virtual/${trackId}/master.m3u8`,
      sourceFileName: payload.sourceFileName,
      sourceContentType: payload.sourceContentType,
      sourceSizeBytes: payload.sourceSizeBytes,
      playbackReady: false,
      updatedAt: new Date().toISOString(),
    });
  },

  async attachCoverArt(trackId: string, payload: { coverStorageKey: string }) {
    const existing = await tracksRepository.findById(trackId);

    if (!existing) {
      throw new Error("Track not found");
    }

    return tracksRepository.upsert({
      ...existing,
      coverStorageKey: payload.coverStorageKey,
      coverImageUrl: storageService.getDownloadUrl(payload.coverStorageKey),
      updatedAt: new Date().toISOString(),
    });
  },

  async attachMuxUpload(trackId: string, payload: {
    muxUploadId: string;
    sourceFileName: string;
    sourceContentType: string;
    sourceSizeBytes: number;
  }) {
    const existing = await tracksRepository.findById(trackId);

    if (!existing) {
      throw new Error("Track not found");
    }

    return tracksRepository.upsert({
      ...existing,
      status: "processing",
      runtime: "Uploading to Mux",
      mediaProvider: "mux",
      muxUploadId: payload.muxUploadId,
      muxAssetStatus: "waiting",
      sourceFileName: payload.sourceFileName,
      sourceContentType: payload.sourceContentType,
      sourceSizeBytes: payload.sourceSizeBytes,
      playbackReady: false,
      updatedAt: new Date().toISOString(),
    });
  },

  async markProcessing(trackId: string) {
    const existing = await tracksRepository.findById(trackId);

    if (!existing) {
      throw new Error("Track not found");
    }

    return tracksRepository.upsert({
      ...existing,
      status: "processing",
      muxAssetStatus: existing.muxAssetStatus ?? "asset_created",
      updatedAt: new Date().toISOString(),
    });
  },

  async markPlaybackReady(trackId: string, payload: {
    runtime: string;
    streamManifestUrl?: string;
    streamMediaUrl?: string;
    muxAssetId?: string;
    muxPlaybackId?: string;
  }) {
    const existing = await tracksRepository.findById(trackId);

    if (!existing) {
      throw new Error("Track not found");
    }

    return tracksRepository.upsert({
      ...existing,
      status: "published",
      runtime: payload.runtime,
      playbackReady: true,
      playbackUrl:
        payload.streamMediaUrl ?? existing.playbackUrl ?? existing.streamMediaUrl,
      streamManifestUrl: payload.streamManifestUrl ?? existing.streamManifestUrl,
      streamMediaUrl: payload.streamMediaUrl ?? existing.streamMediaUrl,
      muxAssetId: payload.muxAssetId ?? existing.muxAssetId,
      muxPlaybackId: payload.muxPlaybackId ?? existing.muxPlaybackId,
      muxAssetStatus: payload.muxAssetId ? "ready" : existing.muxAssetStatus,
      updatedAt: new Date().toISOString(),
    });
  },

  async markMuxAssetCreated(trackId: string, payload: {
    muxUploadId?: string;
    muxAssetId: string;
  }) {
    const existing = await tracksRepository.findById(trackId);

    if (!existing) {
      throw new Error("Track not found");
    }

    return tracksRepository.upsert({
      ...existing,
      status: "processing",
      mediaProvider: "mux",
      runtime: "Processing in Mux",
      muxUploadId: payload.muxUploadId ?? existing.muxUploadId,
      muxAssetId: payload.muxAssetId,
      muxAssetStatus: "asset_created",
      updatedAt: new Date().toISOString(),
    });
  },

  async markFailed(trackId: string, runtime = "Processing failed") {
    const existing = await tracksRepository.findById(trackId);

    if (!existing) {
      throw new Error("Track not found");
    }

    return tracksRepository.upsert({
      ...existing,
      status: "failed",
      runtime,
      muxAssetStatus: existing.mediaProvider === "mux" ? "errored" : existing.muxAssetStatus,
      playbackReady: false,
      updatedAt: new Date().toISOString(),
    });
  },

  async markArchiveReady(trackId: string) {
    const existing = await tracksRepository.findById(trackId);

    if (!existing) {
      throw new Error("Track not found");
    }

    return tracksRepository.upsert({
      ...existing,
      archiveStatus: "ready",
      updatedAt: new Date().toISOString(),
    });
  },
};
