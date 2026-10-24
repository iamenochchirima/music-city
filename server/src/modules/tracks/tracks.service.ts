import { ZodError } from "zod";
import {
  trackMonetizationUpdateSchema,
  trackMetadataUpdateSchema,
  trackCreateSchema,
  type TrackMonetizationUpdateInput,
  type TrackSummary,
  type TrackCreateInput,
  type TrackMetadataUpdateInput,
} from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";
import { createId } from "../../services/id.service.js";
import { muxService } from "../../services/mux.service.js";
import { storageService } from "../../services/storage.service.js";
import { env } from "../../config/env.js";
import {
  normalizePositiveAmount,
  normalizeStellarAsset,
} from "../../utils/commerce.js";
import { usersService } from "../users/users.service.js";
import { tracksRepository } from "./tracks.repository.js";
import { HttpError } from "../../utils/http-error.js";
import { amountUnits, formatUnits } from "../settlements/settlement-domain.js";

const formatRuntime = (seconds?: number) => {
  if (!seconds || Number.isNaN(seconds)) {
    return "Ready";
  }

  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

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

const hydrateTrackForView = (
  track: TrackSummary,
  isPublic: boolean,
): TrackSummary =>
  hydrateTrackUrls({
    ...track,
    visibility: isPublic ? ("published" as const) : ("unpublished" as const),
    priceLabel: isPublic ? "Published" : "Unpublished",
  }) as TrackSummary;

const publicTrackView = (track: TrackSummary): TrackSummary => {
  const publicTrack = hydrateTrackForView(track, true);
  return {
    ...publicTrack,
    playbackUrl: undefined,
    streamManifestUrl: undefined,
    streamMediaUrl: undefined,
    masterStorageKey: undefined,
    streamManifestKey: undefined,
    muxUploadId: undefined,
    muxAssetId: undefined,
    muxPlaybackId: undefined,
  } as TrackSummary;
};

const validateCreditProfiles = async (credits: TrackSummary["credits"]) => {
  for (const artistId of new Set(
    (credits ?? []).flatMap((credit) =>
      credit.artistId ? [credit.artistId] : [],
    ),
  )) {
    const artist = await usersService.getProfileById(artistId);
    if (!artist || !["artist", "both"].includes(artist.primaryIntent))
      throw new ZodError([
        {
          code: "custom",
          path: [
            "credits",
            (credits ?? []).findIndex((credit) => credit.artistId === artistId),
            "artistId",
          ],
          message: "Linked credit profile must belong to an artist",
        },
      ]);
  }
};

export const tracksService = {
  async isTrackPublic(trackId: string) {
    return tracksRepository.isTrackInPublicRelease(trackId);
  },

  async listTracks() {
    const publicTrackIds = new Set(await tracksRepository.listPublicTrackIds());
    const snapshots = new Map(
      (await databaseService.listLiveTrackSnapshots()).map((track) => [
        track.id,
        track,
      ]),
    );
    const tracks = (await tracksRepository.list()).map(
      (track) => snapshots.get(track.id) ?? track,
    );
    return tracks
      .filter((track) => track.playbackReady && publicTrackIds.has(track.id))
      .map(publicTrackView);
  },

  async listMyTracks(walletAddress: string) {
    const profile = await usersService.getProfile(walletAddress);

    if (!profile || !["artist", "both"].includes(profile.primaryIntent)) {
      return [];
    }

    const tracks = await tracksRepository.listByArtist(profile.id);
    const publicTrackIds = new Set(
      await tracksRepository.listPublicTrackIds(profile.id),
    );
    return tracks.map((track) =>
      hydrateTrackForView(track, publicTrackIds.has(track.id)),
    );
  },

  async listPublicTracksByArtist(artistId: string) {
    const snapshots = new Map(
      (await databaseService.listLiveTrackSnapshots()).map((track) => [
        track.id,
        track,
      ]),
    );
    const tracks = (await tracksRepository.listByArtist(artistId)).map(
      (track) => snapshots.get(track.id) ?? track,
    );
    const publicTrackIds = new Set(
      await tracksRepository.listPublicTrackIds(artistId),
    );

    return tracks
      .filter((track) => track.playbackReady && publicTrackIds.has(track.id))
      .map(publicTrackView);
  },

  async getTrack(trackId: string) {
    const track =
      (await databaseService.listLiveTrackSnapshots()).find(
        (track) => track.id === trackId,
      ) ?? (await tracksRepository.findById(trackId));
    if (!track) {
      return null;
    }

    if (
      !track.playbackReady ||
      !(await tracksRepository.isTrackInPublicRelease(track.id))
    ) {
      return null;
    }

    return publicTrackView(track);
  },

  async getTrackForPlayback(trackId: string) {
    const track =
      (await databaseService.listLiveTrackSnapshots()).find(
        (track) => track.id === trackId,
      ) ?? (await tracksRepository.findById(trackId));
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
      { ...track, ...(await tracksRepository.findReleaseContext(track.id)) },
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
      await muxService
        .cancelUpload(track.muxUploadId)
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);

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
    await validateCreditProfiles(parsed.credits);
    const purchaseEnabled = parsed.purchaseEnabled ?? false;
    const purchasePrice = purchaseEnabled
      ? formatUnits(amountUnits(normalizePositiveAmount(
          parsed.purchasePrice ?? env.TRACK_PURCHASE_DEFAULT_PRICE,
          "Track purchase price",
        )))
      : undefined;
    const purchaseAsset = purchaseEnabled
      ? normalizeStellarAsset(
          {
            code: parsed.purchaseAssetCode ?? env.STELLAR_SETTLEMENT_ASSET_CODE,
            issuer:
              parsed.purchaseAssetIssuer ?? env.STELLAR_SETTLEMENT_ASSET_ISSUER,
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
      isrc: parsed.isrc || undefined,
      recordLabel: parsed.recordLabel || undefined,
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

    await validateCreditProfiles(parsed.credits);

    const patch: TrackMetadataUpdateInput & { updatedAt: string } = {
      ...parsed,
      updatedAt: new Date().toISOString(),
    };
    if (parsed.isrc !== undefined) patch.isrc = parsed.isrc || undefined;
    if (parsed.recordLabel !== undefined)
      patch.recordLabel = parsed.recordLabel || undefined;
    if (parsed.description !== undefined)
      patch.description = parsed.description.trim() || undefined;
    const updated = await tracksRepository.updateMetadata(
      trackId,
      profile.id,
      patch,
    );
    if (!updated) throw new Error("Track not found");
    return updated;
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

    if ((parsed.purchaseEnabled ?? existing.purchaseEnabled) &&
      ((parsed.purchaseAssetCode && parsed.purchaseAssetCode !== env.STELLAR_SETTLEMENT_ASSET_CODE) ||
        (parsed.purchaseAssetIssuer && parsed.purchaseAssetIssuer !== env.STELLAR_SETTLEMENT_ASSET_ISSUER))) {
      throw new HttpError(400, "Price this song in the supported USDC asset");
    }

    const purchaseEnabled =
      parsed.purchaseEnabled ?? existing.purchaseEnabled ?? false;
    const purchasePrice = purchaseEnabled
      ? formatUnits(amountUnits(normalizePositiveAmount(
          parsed.purchasePrice ||
            existing.purchasePrice ||
            env.TRACK_PURCHASE_DEFAULT_PRICE,
          "Track purchase price",
        )))
      : existing.purchasePrice;
    const purchaseAsset = purchaseEnabled
      ? normalizeStellarAsset(
          {
            code: env.STELLAR_SETTLEMENT_ASSET_CODE,
            issuer: env.STELLAR_SETTLEMENT_ASSET_ISSUER,
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
      purchaseAssetCode: purchaseAsset?.code ?? existing.purchaseAssetCode,
      purchaseAssetIssuer:
        purchaseAsset?.issuer ?? existing.purchaseAssetIssuer,
      priceLabel: isPublic ? "Published" : "Unpublished",
      updatedAt: new Date().toISOString(),
    });
  },

  async syncMediaFromWorker(trackId: string) {
    const current = await tracksRepository.findById(trackId);
    if (!current || current.mediaProvider !== "mux") return current;
    const generation =
      current.muxUploadId || current.masterStorageKey || current.muxAssetId;
    let assetId = current.muxAssetId;
    if (!assetId && current.muxUploadId) {
      const upload = await muxService.getUpload(current.muxUploadId);
      if (["errored", "cancelled", "timed_out"].includes(upload.status)) {
        return this.applyMediaPatch(trackId, generation, {
          status: "failed",
          muxAssetStatus: "errored",
          playbackReady: false,
          runtime: "Audio upload failed",
        });
      }
      assetId = upload.asset_id;
    }
    if (!assetId) return current;
    const asset = await muxService.getAsset(assetId);
    const patch: Partial<TrackSummary> = {
      muxAssetId: asset.id,
      muxAssetStatus:
        asset.status === "preparing" ? "asset_created" : asset.status,
    };
    if (asset.status === "ready" && asset.playback_ids?.[0]?.id)
      Object.assign(patch, {
        status: "published",
        playbackReady: true,
        muxPlaybackId: asset.playback_ids[0].id,
        runtime: `${Math.floor((asset.duration ?? 0) / 60)}:${String(Math.round((asset.duration ?? 0) % 60)).padStart(2, "0")}`,
      });
    else if (asset.status === "errored")
      Object.assign(patch, {
        status: "failed",
        playbackReady: false,
        runtime: "Audio processing failed",
      });
    return this.applyMediaPatch(trackId, generation, patch);
  },

  async applyMediaPatch(
    trackId: string,
    generation: string | undefined,
    patch: Partial<TrackSummary>,
  ) {
    return databaseService.transaction(async (client) => {
      const current = (
        await client.query<{ payload: TrackSummary }>(
          "SELECT payload FROM tracks WHERE id=$1 FOR UPDATE",
          [trackId],
        )
      ).rows[0]?.payload;
      if (
        !current ||
        (current.muxUploadId ||
          current.masterStorageKey ||
          current.muxAssetId) !== generation
      )
        return current;
      const next = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await client.query(
        "UPDATE tracks SET status=$2,payload=$3::jsonb WHERE id=$1",
        [trackId, next.status, JSON.stringify(next)],
      );
      return next;
    });
  },

  async attachMaster(
    trackId: string,
    payload: {
      masterStorageKey: string;
      sourceFileName: string;
      sourceContentType: string;
      sourceSizeBytes: number;
      storageProvider: "local" | "s3";
    },
  ) {
    const existing = await tracksRepository.findById(trackId);

    if (!existing) {
      throw new Error("Track not found");
    }

    return tracksRepository.upsert({
      ...existing,
      status: "uploaded",
      runtime: "Uploaded",
      mediaProvider: "local",
      muxUploadId: undefined,
      muxAssetId: undefined,
      muxPlaybackId: undefined,
      muxAssetStatus: undefined,
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
      coverImageUrl: storageService.getImageUrl(payload.coverStorageKey),
      updatedAt: new Date().toISOString(),
    });
  },

  async attachMuxUpload(
    trackId: string,
    payload: {
      muxUploadId: string;
      sourceFileName: string;
      sourceContentType: string;
      sourceSizeBytes: number;
    },
  ) {
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
      muxAssetId: undefined,
      muxPlaybackId: undefined,
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

  async markPlaybackReady(
    trackId: string,
    payload: {
      runtime: string;
      streamManifestUrl?: string;
      streamMediaUrl?: string;
      muxAssetId?: string;
      muxPlaybackId?: string;
    },
  ) {
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
        payload.streamMediaUrl ??
        existing.playbackUrl ??
        existing.streamMediaUrl,
      streamManifestUrl:
        payload.streamManifestUrl ?? existing.streamManifestUrl,
      streamMediaUrl: payload.streamMediaUrl ?? existing.streamMediaUrl,
      muxAssetId: payload.muxAssetId ?? existing.muxAssetId,
      muxPlaybackId: payload.muxPlaybackId ?? existing.muxPlaybackId,
      muxAssetStatus: payload.muxAssetId ? "ready" : existing.muxAssetStatus,
      updatedAt: new Date().toISOString(),
    });
  },

  async markMuxAssetCreated(
    trackId: string,
    payload: {
      muxUploadId?: string;
      muxAssetId: string;
    },
  ) {
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
      muxAssetStatus:
        existing.mediaProvider === "mux" ? "errored" : existing.muxAssetStatus,
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
