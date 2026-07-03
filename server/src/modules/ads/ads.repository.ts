import type { AdImpressionRecord, AdRecord } from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export const adsRepository = {
  async listAds(filters?: { status?: string }) {
    return databaseService.listAds<AdRecord>(filters);
  },

  async findAdById(id: string) {
    return databaseService.findAdById<AdRecord>(id);
  },

  async upsertAd(ad: AdRecord) {
    await databaseService.upsertAd(
      ad.id,
      ad.status,
      ad.startsAt ?? null,
      ad.endsAt ?? null,
      ad,
    );

    return ad;
  },

  async deleteAd(id: string) {
    await databaseService.deleteAd(id);
  },

  async listAdImpressions(filters?: {
    adId?: string;
    walletAddress?: string;
    status?: string;
  }) {
    return databaseService.listAdImpressions<AdImpressionRecord>(filters);
  },

  async findAdImpressionById(id: string) {
    return databaseService.findAdImpressionById<AdImpressionRecord>(id);
  },

  async upsertAdImpression(impression: AdImpressionRecord) {
    await databaseService.upsertAdImpression(
      impression.id,
      impression.adId,
      impression.walletAddress,
      impression.trackId,
      impression.status,
      impression.createdAt,
      impression,
    );

    return impression;
  },

  async countAdImpressionsForWalletSince(
    adId: string,
    walletAddress: string,
    since: string,
  ) {
    return databaseService.countAdImpressionsForWalletSince(
      adId,
      walletAddress,
      since,
    );
  },
};
