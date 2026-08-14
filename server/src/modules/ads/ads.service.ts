import {
  adDecisionSchema,
  adImpressionRecordSchema,
  adPerformanceSummarySchema,
  adRecordSchema,
  adminAdListItemSchema,
  createAdInputSchema,
  startAdImpressionInputSchema,
  updateAdImpressionInputSchema,
  updateAdInputSchema,
  type AdDecision,
  type AdImpressionRecord,
  type AdRecord,
  type AdminAdListItem,
  type CreateAdInput,
  type StartAdImpressionInput,
  type UpdateAdImpressionInput,
  type UpdateAdInput,
} from "@music-city/shared";

import { createId } from "../../services/id.service.js";
import { storageService } from "../../services/storage.service.js";
import { HttpError } from "../../utils/http-error.js";
import { subscriptionsService } from "../subscriptions/subscriptions.service.js";
import { tracksService } from "../tracks/tracks.service.js";
import { usersService } from "../users/users.service.js";
import { adsRepository } from "./ads.repository.js";

const isWithinActiveWindow = (ad: AdRecord, nowMs: number) => {
  const startsAtMs = ad.startsAt ? Date.parse(ad.startsAt) : Number.NEGATIVE_INFINITY;
  const endsAtMs = ad.endsAt ? Date.parse(ad.endsAt) : Number.POSITIVE_INFINITY;

  return startsAtMs <= nowMs && endsAtMs >= nowMs;
};

const AD_BREAK_MINIMUM_TRACKS = 3;
const AD_BREAK_MINIMUM_INTERVAL_MS = 10 * 60 * 1000;

const summarizeImpressions = (impressions: AdImpressionRecord[]) =>
  adPerformanceSummarySchema.parse({
    pending: impressions.filter((item) => item.status === "pending").length,
    started: impressions.filter((item) => item.status === "started").length,
    completed: impressions.filter((item) => item.status === "completed").length,
    skipped: impressions.filter((item) => item.status === "skipped").length,
    failed: impressions.filter((item) => item.status === "failed").length,
    total: impressions.length,
  });

const sortAdsForServing = (items: AdRecord[]) =>
  [...items].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    if (right.weight !== left.weight) {
      return right.weight - left.weight;
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });

const hydrateAdAudioUrl = (ad: AdRecord): AdRecord =>
  ad.audioStorageKey
    ? {
        ...ad,
        audioUrl: storageService.getDownloadUrl(
          ad.audioStorageKey,
          ad.audioStorageProvider,
        ),
      }
    : ad;

const buildAdminAdList = async (ads: AdRecord[]): Promise<AdminAdListItem[]> => {
  const impressions = await adsRepository.listAdImpressions();
  const impressionsByAdId = impressions.reduce<Map<string, AdImpressionRecord[]>>(
    (map, item) => {
      map.set(item.adId, [...(map.get(item.adId) ?? []), item]);
      return map;
    },
    new Map(),
  );

  return ads.map((ad) =>
    adminAdListItemSchema.parse({
      ...hydrateAdAudioUrl(ad),
      summary: summarizeImpressions(impressionsByAdId.get(ad.id) ?? []),
    }),
  );
};

export const adsService = {
  async listAds(): Promise<AdminAdListItem[]> {
    const ads = (await adsRepository.listAds()).map((item) => adRecordSchema.parse(item));
    return buildAdminAdList(ads);
  },

  async createAd(input: CreateAdInput): Promise<AdRecord> {
    const parsed = createAdInputSchema.parse(input);
    const timestamp = new Date().toISOString();

    return adsRepository.upsertAd(
      adRecordSchema.parse({
        id: createId("ad"),
        ...parsed,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );
  },

  async updateAd(id: string, input: UpdateAdInput): Promise<AdRecord> {
    const existing = await adsRepository.findAdById(id);

    if (!existing) {
      throw new HttpError(404, "Ad not found");
    }

    const parsed = updateAdInputSchema.parse(input);

    return adsRepository.upsertAd(
      adRecordSchema.parse({
        ...existing,
        ...parsed,
        id,
        updatedAt: new Date().toISOString(),
      }),
    );
  },

  async archiveAd(id: string) {
    const existing = await adsRepository.findAdById(id);

    if (!existing) {
      throw new HttpError(404, "Ad not found");
    }

    return adsRepository.upsertAd(
      adRecordSchema.parse({
        ...existing,
        status: "archived",
        updatedAt: new Date().toISOString(),
      }),
    );
  },

  async listImpressions(filters?: { adId?: string; status?: string }) {
    return adsRepository.listAdImpressions(filters);
  },

  async getPlaybackAdDecision(
    walletAddress: string,
    trackId: string,
  ): Promise<AdDecision> {
    const [track, profile, hasSubscription, ads] = await Promise.all([
      tracksService.getTrackForPlayback(trackId),
      usersService.getProfile(walletAddress),
      subscriptionsService.hasActivePlatformSubscription(walletAddress),
      adsRepository.listAds({ status: "active" }),
    ]);

    if (!track || !track.playbackReady) {
      throw new HttpError(404, "Track media is not available");
    }

    if (hasSubscription) {
      return adDecisionSchema.parse({
        serveAd: false,
        reason: "Listener has an active platform subscription.",
      });
    }

    if (!(await tracksService.isTrackPublic(track.id))) {
      return adDecisionSchema.parse({
        serveAd: false,
        reason: "Ads are currently only served on tracks in published releases.",
      });
    }

    if (profile && profile.id === track.artistId) {
      return adDecisionSchema.parse({
        serveAd: false,
        reason: "Artists do not receive ads on their own tracks.",
      });
    }

    const nowMs = Date.now();
    const completedImpressions = await adsRepository.listAdImpressions({
      walletAddress,
      status: "completed",
    });
    const mostRecentCompletedImpression = completedImpressions.sort(
      (left, right) => Date.parse(right.completedAt ?? right.updatedAt) - Date.parse(left.completedAt ?? left.updatedAt),
    )[0];

    // The first three selected tracks start immediately. Later breaks require both time and listening cadence.
    const lastCompletedAt = mostRecentCompletedImpression
      ? (mostRecentCompletedImpression.completedAt ?? mostRecentCompletedImpression.updatedAt)
      : new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
    const tracksSinceLastBreak = await adsRepository.countPlaybackSessionsForListenerSince(
      profile?.id ?? "",
      lastCompletedAt,
    );

    if (tracksSinceLastBreak < AD_BREAK_MINIMUM_TRACKS || (
      mostRecentCompletedImpression && nowMs - Date.parse(lastCompletedAt) < AD_BREAK_MINIMUM_INTERVAL_MS
    )) {
      return adDecisionSchema.parse({
        serveAd: false,
        reason: "The listener has not reached the next ad break.",
      });
    }

    const activeAds = sortAdsForServing(
      ads
        .map((item) => adRecordSchema.parse(item))
        .filter(
          (ad) => ad.targetAccess === "public" && isWithinActiveWindow(ad, nowMs),
        ),
    );

    if (activeAds.length === 0) {
      return adDecisionSchema.parse({
        serveAd: false,
        reason: "No active eligible ads are available.",
      });
    }

    const since = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

    for (const ad of activeAds) {
      const impressionsToday = await adsRepository.countAdImpressionsForWalletSince(
        ad.id,
        walletAddress,
        since,
      );

      if (impressionsToday >= ad.maxImpressionsPerWalletPerDay) {
        continue;
      }

      const timestamp = new Date().toISOString();
      const impression = adImpressionRecordSchema.parse({
        id: createId("adimp"),
        adId: ad.id,
        walletAddress,
        trackId,
        status: "pending",
        slot: ad.slot,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await adsRepository.upsertAdImpression(impression);

      return adDecisionSchema.parse({
        serveAd: true,
        impressionId: impression.id,
        ad: hydrateAdAudioUrl(ad),
      });
    }

    return adDecisionSchema.parse({
      serveAd: false,
      reason: "Listener reached the current ad frequency cap.",
    });
  },

  async startImpression(
    walletAddress: string,
    input: StartAdImpressionInput,
  ): Promise<AdImpressionRecord> {
    const parsed = startAdImpressionInputSchema.parse(input);
    const impression = await adsRepository.findAdImpressionById(parsed.impressionId);

    if (!impression || impression.walletAddress !== walletAddress) {
      throw new HttpError(404, "Ad impression not found");
    }

    return adsRepository.upsertAdImpression(
      adImpressionRecordSchema.parse({
        ...impression,
        status: "started",
        startedAt: impression.startedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
  },

  async updateImpression(
    walletAddress: string,
    impressionId: string,
    input: UpdateAdImpressionInput,
  ): Promise<AdImpressionRecord> {
    const parsed = updateAdImpressionInputSchema.parse(input);
    const impression = await adsRepository.findAdImpressionById(impressionId);

    if (!impression || impression.walletAddress !== walletAddress) {
      throw new HttpError(404, "Ad impression not found");
    }

    const timestamp = new Date().toISOString();

    return adsRepository.upsertAdImpression(
      adImpressionRecordSchema.parse({
        ...impression,
        status: parsed.status,
        completedAt: parsed.status === "completed" ? timestamp : impression.completedAt,
        failedAt: parsed.status === "failed" ? timestamp : impression.failedAt,
        reason: parsed.reason ?? impression.reason,
        updatedAt: timestamp,
      }),
    );
  },
};
