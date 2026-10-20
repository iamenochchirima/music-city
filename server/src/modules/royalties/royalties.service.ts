import { amountUnits } from "../settlements/settlement-domain.js";
import {
  approveRoyaltyLedgerEntriesSchema,
  listRoyaltyLedgerEntriesInputSchema,
  listRoyaltyPayoutsInputSchema,
  royaltyPayoutRecordSchema,
  royaltyLedgerEntrySchema,
  royaltyEngineConfigSchema,
  royaltyFeeSettingsSchema,
  royaltyPayoutSettingsSchema,
  trackRoyaltySplitListSchema,
  trackRoyaltySplitRecordSchema,
  type ApproveRoyaltyLedgerEntriesInput,
  type ListRoyaltyLedgerEntriesInput,
  type ListRoyaltyPayoutsInput,
  type PaymentRecord,
  type RoyaltyEngineConfig,
  type RoyaltyFeeSettings,
  type RoyaltyLedgerEntry,
  type RoyaltyPayoutRecord,
  type RoyaltyPayoutSettings,
  type TrackRoyaltySplitList,
  type TrackRoyaltySplitRecord,
} from "@music-city/shared";

import { env } from "../../config/env.js";
import { databaseService } from "../../services/database.service.js";
import { createId } from "../../services/id.service.js";
import { HttpError } from "../../utils/http-error.js";
import { tracksRepository } from "../tracks/tracks.repository.js";
import { royaltiesRepository } from "./royalties.repository.js";
import { finalizedSplitsRepository } from "../agreements/effective-split.js";
import { Networks } from "@stellar/stellar-sdk";

const ROYALTY_PAYOUT_SETTINGS_KEY = "royalty_payout_settings";
const ROYALTY_FEE_SETTINGS_KEY = "royalty_fee_settings";

const defaultConfig = (): RoyaltyEngineConfig =>
  royaltyEngineConfigSchema.parse({
    primaryChain: "stellar",
    primaryNetwork:
      env.STELLAR_NETWORK_PASSPHRASE === Networks.TESTNET
        ? "stellar:testnet"
        : env.STELLAR_NETWORK_PASSPHRASE === Networks.PUBLIC
          ? "stellar:public"
          : env.STELLAR_NETWORK_PASSPHRASE,
    registryKind: "soroban",
    registryContractId: env.ROYALTY_REGISTRY_CONTRACT_ID,
    registryExplorerUrl: env.ROYALTY_REGISTRY_CONTRACT_ID
      ? `https://stellar.expert/explorer/${env.STELLAR_NETWORK_PASSPHRASE === Networks.TESTNET ? "testnet" : "public"}/contract/${env.ROYALTY_REGISTRY_CONTRACT_ID}`
      : undefined,
    settlementRails: ["stellar"],
    payoutAssetCode: env.STELLAR_SETTLEMENT_ASSET_CODE,
    payoutAssetIssuer: env.STELLAR_SETTLEMENT_ASSET_ISSUER,
  });

const defaultPayoutSettings = (): RoyaltyPayoutSettings =>
  royaltyPayoutSettingsSchema.parse({
    approvalMode: env.ROYALTY_PAYOUT_APPROVAL_MODE,
    cadence: env.ROYALTY_PAYOUT_CADENCE,
    minimumPayoutAmount: env.ROYALTY_PAYOUT_MINIMUM_AMOUNT,
    retryFailedPayouts: env.ROYALTY_PAYOUT_RETRY_FAILED,
    shortfallBehavior: env.ROYALTY_PAYOUT_SHORTFALL_BEHAVIOR,
    automaticApproval: env.ROYALTY_PAYOUT_AUTOMATIC_APPROVAL,
    reversalPolicy: env.ROYALTY_PAYOUT_REVERSAL_POLICY,
    confirmBeforeMarkPaid: env.ROYALTY_CONFIRM_BEFORE_MARK_PAID,
  });

const defaultFeeSettings = (): RoyaltyFeeSettings =>
  royaltyFeeSettingsSchema.parse({
    trackPurchaseFeeBps: env.ROYALTY_FEE_TRACK_PURCHASE_BPS,
    platformSubscriptionFeeBps: env.ROYALTY_FEE_PLATFORM_SUBSCRIPTION_BPS,
    adRevenueFeeBps: env.ROYALTY_FEE_AD_REVENUE_BPS,
    manualAdjustmentFeeBps: env.ROYALTY_FEE_MANUAL_ADJUSTMENT_BPS,
  });

const toBaseUnits = amountUnits;

const fromBaseUnits = (value: bigint) => {
  const whole = value / 10_000_000n;
  const fraction = (value % 10_000_000n).toString().padStart(7, "0");
  return `${whole.toString()}.${fraction}`;
};

const distributeEvenly = (amount: string, parts: number) => {
  if (parts <= 0) {
    return [];
  }

  const totalUnits = toBaseUnits(amount);
  const partCount = BigInt(parts);
  const baseShare = totalUnits / partCount;
  let assignedUnits = 0n;

  return Array.from({ length: parts }, (_unused, index) => {
    const isLast = index === parts - 1;
    const shareUnits = isLast ? totalUnits - assignedUnits : baseShare;
    assignedUnits += shareUnits;
    return fromBaseUnits(shareUnits);
  });
};

const distributeByBps = (
  amount: string,
  recipients: TrackRoyaltySplitRecord["recipients"],
) => {
  const totalUnits = toBaseUnits(amount);
  let assignedUnits = 0n;

  return recipients.map((recipient, index) => {
    const isLastRecipient = index === recipients.length - 1;
    const shareUnits = isLastRecipient
      ? totalUnits - assignedUnits
      : (totalUnits * BigInt(recipient.shareBps)) / 10_000n;

    assignedUnits += shareUnits;

    return {
      recipient,
      amount: fromBaseUnits(shareUnits),
    };
  });
};

const sortLedgerEntries = (entries: RoyaltyLedgerEntry[]) =>
  [...entries].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );

const sortPayouts = (items: RoyaltyPayoutRecord[]) =>
  [...items].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );

const feeBpsForSourceType = (
  sourceType: RoyaltyLedgerEntry["sourceType"],
  settings: RoyaltyFeeSettings,
) => {
  switch (sourceType) {
    case "track_purchase":
      return settings.trackPurchaseFeeBps;
    case "platform_subscription":
      return settings.platformSubscriptionFeeBps;
    case "ad_revenue":
      return settings.adRevenueFeeBps;
    case "manual_adjustment":
      return settings.manualAdjustmentFeeBps;
  }
};

const calculateLedgerAmounts = (
  grossAmount: string,
  feeBps: number,
): {
  grossAmount: string;
  feeBps: number;
  feeAmount?: string;
  netAmount: string;
} => {
  const grossUnits = toBaseUnits(grossAmount);
  const feeUnits = (grossUnits * BigInt(feeBps)) / 10_000n;
  const netUnits = grossUnits - feeUnits;

  if (netUnits <= 0n) {
    throw new HttpError(
      400,
      "Royalty fee configuration leaves no net distributable amount",
    );
  }

  return {
    feeBps,
    grossAmount: fromBaseUnits(grossUnits),
    feeAmount: feeUnits > 0n ? fromBaseUnits(feeUnits) : undefined,
    netAmount: fromBaseUnits(netUnits),
  };
};

export const royaltiesService = {
  getConfig() {
    return defaultConfig();
  },

  async getPayoutSettings(): Promise<RoyaltyPayoutSettings> {
    const stored = await databaseService.findSetting<
      Partial<RoyaltyPayoutSettings>
    >(ROYALTY_PAYOUT_SETTINGS_KEY);

    return royaltyPayoutSettingsSchema.parse({
      ...defaultPayoutSettings(),
      ...stored,
    });
  },

  async getFeeSettings(): Promise<RoyaltyFeeSettings> {
    const stored = await databaseService.findSetting<
      Partial<RoyaltyFeeSettings>
    >(ROYALTY_FEE_SETTINGS_KEY);

    return royaltyFeeSettingsSchema.parse({
      ...defaultFeeSettings(),
      ...stored,
    });
  },

  async listTrackSplits(trackId: string): Promise<TrackRoyaltySplitList> {
    const [finalized, historical] = await Promise.all([
      finalizedSplitsRepository.list(trackId),
      royaltiesRepository.listHistoricalTrackSplits(trackId),
    ]);
    const items = [
      ...finalized,
      ...historical.map((split) => ({ ...split, historical: true })),
    ];

    return trackRoyaltySplitListSchema.parse({
      trackId,
      items,
    });
  },

  async listTrackLedgerEntries(trackId: string): Promise<RoyaltyLedgerEntry[]> {
    const entries = await royaltiesRepository.listLedgerEntriesByTrack(trackId);

    return sortLedgerEntries(
      entries.map((entry) => royaltyLedgerEntrySchema.parse(entry)),
    );
  },

  async listLedgerEntries(
    input?: ListRoyaltyLedgerEntriesInput,
  ): Promise<RoyaltyLedgerEntry[]> {
    const parsed = listRoyaltyLedgerEntriesInputSchema.parse(input ?? {});
    const entries = await royaltiesRepository.listLedgerEntries(parsed);

    return sortLedgerEntries(
      entries.map((entry) => royaltyLedgerEntrySchema.parse(entry)),
    );
  },

  async listPayouts(
    input?: ListRoyaltyPayoutsInput,
  ): Promise<RoyaltyPayoutRecord[]> {
    const parsed = listRoyaltyPayoutsInputSchema.parse(input ?? {});
    const payouts = await royaltiesRepository.listPayouts(parsed);

    return sortPayouts(
      payouts.map((entry) => royaltyPayoutRecordSchema.parse(entry)),
    );
  },

  async ensureTrackPurchaseLedgerEntries(
    payment: PaymentRecord,
  ): Promise<RoyaltyLedgerEntry[]> {
    if (payment.productType !== "track_purchase" || !payment.trackId) {
      return [];
    }

    return royaltiesRepository.recognizeSource(
      "track_purchase",
      payment.id,
      async () => {
        const activeSplit = payment.royaltySplitId
          ? (await finalizedSplitsRepository.list(payment.trackId!)).find((split) => split.id === payment.royaltySplitId)
          : null;

        if (!activeSplit)
          throw new HttpError(
            409,
            "A confirmed effective contributor agreement is required before allocating this track purchase",
          );

        const payoutSettings = await this.getPayoutSettings();
        const feeSettings = await this.getFeeSettings();
        const timestamp = new Date().toISOString();
        const distributedAmounts = distributeByBps(
          payment.amount,
          activeSplit.recipients,
        );
        const entries = distributedAmounts
          .filter(({ amount }) => amountUnits(amount) > 0n)
          .map(({ recipient, amount }) =>
            royaltyLedgerEntrySchema.parse({
              id: createId("rled"),
              trackId: payment.trackId,
              splitId: activeSplit.id,
              sourceType: "track_purchase",
              sourceId: payment.id,
              recipientWalletAddress: recipient.walletAddress,
              recipientChain: recipient.chain,
              recipientRole: recipient.role,
              status: payoutSettings.automaticApproval ? "approved" : "pending",
              ...calculateLedgerAmounts(
                amount,
                feeBpsForSourceType("track_purchase", feeSettings),
              ),
              assetCode: payment.assetCode,
              assetIssuer: payment.assetIssuer,
              createdAt: timestamp,
              updatedAt: timestamp,
            }),
          );

        return entries;
      },
    );
  },

  async ensurePlatformSubscriptionLedgerEntries(
    payment: PaymentRecord,
  ): Promise<RoyaltyLedgerEntry[]> {
    if (payment.productType !== "platform_subscription") {
      return [];
    }

    return royaltiesRepository.recognizeSource(
      "platform_subscription",
      payment.id,
      async () => {
        const allTracks = await tracksRepository.list();
        const publicTrackIds = new Set(
          await tracksRepository.listPublicTrackIds(),
        );
        const eligibleTracks = (
          await Promise.all(
            allTracks.map(async (track) => {
              if (
                track.status !== "published" ||
                !track.playbackReady ||
                !publicTrackIds.has(track.id)
              ) {
                return null;
              }

              const activeSplit = await finalizedSplitsRepository.effective(
                track.id,
              );

              if (!activeSplit)
                throw new HttpError(
                  409,
                  `Track ${track.id} requires a confirmed effective contributor agreement before subscription allocation`,
                );

              return {
                track,
                split: activeSplit,
              };
            }),
          )
        ).filter(
          (
            item,
          ): item is {
            track: Awaited<ReturnType<typeof tracksRepository.list>>[number];
            split: TrackRoyaltySplitRecord;
          } => Boolean(item),
        );

        if (eligibleTracks.length === 0) {
          return [];
        }

        const payoutSettings = await this.getPayoutSettings();
        const feeSettings = await this.getFeeSettings();
        const trackAmounts = distributeEvenly(
          payment.amount,
          eligibleTracks.length,
        );
        const timestamp = new Date().toISOString();
        const entries = eligibleTracks.flatMap(({ track, split }, index) =>
          distributeByBps(trackAmounts[index]!, split.recipients)
            .filter(({ amount }) => amountUnits(amount) > 0n)
            .map(({ recipient, amount }) =>
              royaltyLedgerEntrySchema.parse({
                id: createId("rled"),
                trackId: track.id,
                splitId: split.id,
                sourceType: "platform_subscription",
                sourceId: payment.id,
                recipientWalletAddress: recipient.walletAddress,
                recipientChain: recipient.chain,
                recipientRole: recipient.role,
                status: payoutSettings.automaticApproval
                  ? "approved"
                  : "pending",
                ...calculateLedgerAmounts(
                  amount,
                  feeBpsForSourceType("platform_subscription", feeSettings),
                ),
                assetCode: payment.assetCode,
                assetIssuer: payment.assetIssuer,
                createdAt: timestamp,
                updatedAt: timestamp,
              }),
            ),
        );

        return entries;
      },
    );
  },

  async approveLedgerEntries(
    input: ApproveRoyaltyLedgerEntriesInput,
  ): Promise<RoyaltyLedgerEntry[]> {
    const parsed = approveRoyaltyLedgerEntriesSchema.parse(input);
    const entries = await royaltiesRepository.listLedgerEntriesByIds(
      parsed.entryIds,
    );
    const entryById = new Map(entries.map((entry) => [entry.id, entry]));

    const missingIds = parsed.entryIds.filter(
      (entryId: string) => !entryById.has(entryId),
    );

    if (missingIds.length > 0) {
      throw new HttpError(
        404,
        `Royalty ledger entries not found: ${missingIds.join(", ")}`,
      );
    }

    const timestamp = new Date().toISOString();
    const approvedEntries = await Promise.all(
      parsed.entryIds.map(async (entryId: string) => {
        const entry = royaltyLedgerEntrySchema.parse(entryById.get(entryId));

        if (entry.status === "paid") {
          throw new HttpError(
            400,
            `Royalty ledger entry ${entry.id} has already been paid`,
          );
        }

        if (entry.status === "reversed") {
          throw new HttpError(
            400,
            `Royalty ledger entry ${entry.id} has been reversed`,
          );
        }

        if (entry.status === "approved") {
          return entry;
        }

        const updatedEntry = royaltyLedgerEntrySchema.parse({
          ...entry,
          status: "approved",
          updatedAt: timestamp,
        });

        await royaltiesRepository.upsertLedgerEntry(updatedEntry);
        return updatedEntry;
      }),
    );

    return sortLedgerEntries(approvedEntries);
  },
};
