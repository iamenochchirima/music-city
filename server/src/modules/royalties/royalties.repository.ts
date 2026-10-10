import type {
  RoyaltyLedgerEntry,
  RoyaltyPayoutRecord,
  TrackRoyaltySplitRecord,
} from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export const royaltiesRepository = {
  async listHistoricalTrackSplits(trackId: string) {
    return databaseService.listHistoricalRoyaltySplitsByTrack<TrackRoyaltySplitRecord>(trackId);
  },

  async listLedgerEntriesByTrack(trackId: string) {
    return databaseService.listRoyaltyLedgerEntriesByTrack<RoyaltyLedgerEntry>(trackId);
  },

  async listLedgerEntries(filters?: {
    status?: string;
    recipientWalletAddress?: string;
  }) {
    return databaseService.listRoyaltyLedgerEntries<RoyaltyLedgerEntry>(filters);
  },

  async listLedgerEntriesBySource(sourceType: string, sourceId: string) {
    return databaseService.listRoyaltyLedgerEntriesBySource<RoyaltyLedgerEntry>(
      sourceType,
      sourceId,
    );
  },

  async listLedgerEntriesByIds(entryIds: string[]) {
    return databaseService.listRoyaltyLedgerEntriesByIds<RoyaltyLedgerEntry>(entryIds);
  },

  async upsertLedgerEntry(entry: RoyaltyLedgerEntry) {
    await databaseService.upsertRoyaltyLedgerEntry(
      entry.id,
      entry.trackId,
      entry.recipientWalletAddress,
      entry.status,
      entry.sourceType,
      entry.sourceId,
      entry.recipientChain,
      entry,
    );

    return entry;
  },

  async listPayoutsByRecipient(recipientWalletAddress: string) {
    return databaseService.listRoyaltyPayoutsByRecipient<RoyaltyPayoutRecord>(
      recipientWalletAddress,
    );
  },

  async listPayouts(filters?: {
    status?: string;
    recipientWalletAddress?: string;
  }) {
    return databaseService.listRoyaltyPayouts<RoyaltyPayoutRecord>(filters);
  },

  async upsertPayout(payout: RoyaltyPayoutRecord) {
    await databaseService.upsertRoyaltyPayout(
      payout.id,
      payout.recipientWalletAddress,
      payout.status,
      payout.payoutRail,
      payout,
    );

    return payout;
  },
};
