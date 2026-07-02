import type {
  RoyaltyLedgerEntry,
  RoyaltyPayoutRecord,
  TrackRoyaltySplitRecord,
} from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export const royaltiesRepository = {
  async listTrackSplits(trackId: string) {
    return databaseService.listRoyaltySplitsByTrack<TrackRoyaltySplitRecord>(trackId);
  },

  async upsertSplit(split: TrackRoyaltySplitRecord) {
    await databaseService.upsertRoyaltySplit(
      split.id,
      split.trackId,
      split.version,
      split.status,
      split.registryChain ?? null,
      split,
    );

    return split;
  },

  async listLedgerEntriesByTrack(trackId: string) {
    return databaseService.listRoyaltyLedgerEntriesByTrack<RoyaltyLedgerEntry>(trackId);
  },

  async listLedgerEntriesBySource(sourceType: string, sourceId: string) {
    return databaseService.listRoyaltyLedgerEntriesBySource<RoyaltyLedgerEntry>(
      sourceType,
      sourceId,
    );
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
