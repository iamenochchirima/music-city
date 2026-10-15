import { royaltyLedgerEntrySchema } from "@music-city/shared";
import type {
  RoyaltyLedgerEntry,
  RoyaltyPayoutRecord,
  TrackRoyaltySplitRecord,
} from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export const royaltiesRepository = {
  async recognizeSource(
    sourceType: string,
    sourceId: string,
    build: () => Promise<RoyaltyLedgerEntry[]>,
  ) {
    return databaseService.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `royalty-source:${sourceType}:${sourceId}`,
      ]);
      const existing = await client.query(
        "SELECT payload FROM royalty_ledger WHERE source_type=$1 AND source_id=$2 ORDER BY id",
        [sourceType, sourceId],
      );
      if (existing.rows.length)
        return existing.rows.map((r) =>
          royaltyLedgerEntrySchema.parse(r.payload),
        );
      const entries = await build();
      for (const entry of entries)
        await client.query(
          "INSERT INTO royalty_ledger(id,track_id,recipient_wallet_address,status,source_type,source_id,recipient_chain,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            entry.id,
            entry.trackId,
            entry.recipientWalletAddress,
            entry.status,
            entry.sourceType,
            entry.sourceId,
            entry.recipientChain,
            entry,
          ],
        );
      return entries;
    });
  },
  async listHistoricalTrackSplits(trackId: string) {
    return databaseService.listHistoricalRoyaltySplitsByTrack<TrackRoyaltySplitRecord>(
      trackId,
    );
  },

  async listLedgerEntriesByTrack(trackId: string) {
    return databaseService.listRoyaltyLedgerEntriesByTrack<RoyaltyLedgerEntry>(
      trackId,
    );
  },

  async listLedgerEntries(filters?: {
    status?: string;
    recipientWalletAddress?: string;
  }) {
    return databaseService.listRoyaltyLedgerEntries<RoyaltyLedgerEntry>(
      filters,
    );
  },

  async listLedgerEntriesBySource(sourceType: string, sourceId: string) {
    return databaseService.listRoyaltyLedgerEntriesBySource<RoyaltyLedgerEntry>(
      sourceType,
      sourceId,
    );
  },

  async listLedgerEntriesByIds(entryIds: string[]) {
    return databaseService.listRoyaltyLedgerEntriesByIds<RoyaltyLedgerEntry>(
      entryIds,
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
