import {
  approveRoyaltyLedgerEntriesSchema,
  listRoyaltyLedgerEntriesInputSchema,
  listRoyaltyPayoutsInputSchema,
  reconcileRoyaltyPayoutsSchema,
  royaltyLedgerEntrySchema,
  royaltyEngineConfigSchema,
  royaltyFeeSettingsSchema,
  royaltyPayoutExecutionResultSchema,
  royaltyPayoutReconciliationResultSchema,
  royaltyPayoutRecordSchema,
  royaltyPayoutSettingsSchema,
  runRoyaltyPayoutsSchema,
  trackRoyaltySplitListSchema,
  trackRoyaltySplitRecordSchema,
  upsertTrackRoyaltySplitSchema,
  type ApproveRoyaltyLedgerEntriesInput,
  type ListRoyaltyLedgerEntriesInput,
  type ListRoyaltyPayoutsInput,
  type PaymentRecord,
  type ReconcileRoyaltyPayoutsInput,
  type RoyaltyEngineConfig,
  type RoyaltyFeeSettings,
  type RoyaltyLedgerEntry,
  type RoyaltyPayoutExecutionResult,
  type RoyaltyPayoutReconciliationResult,
  type RoyaltyPayoutRecord,
  type RoyaltyPayoutSettings,
  type TrackRoyaltySplitList,
  type TrackRoyaltySplitRecord,
  type RunRoyaltyPayoutsInput,
  type UpsertTrackRoyaltySplitInput,
} from "@music-city/shared";

import { env } from "../../config/env.js";
import { databaseService } from "../../services/database.service.js";
import { createId } from "../../services/id.service.js";
import { HttpError } from "../../utils/http-error.js";
import { tracksRepository } from "../tracks/tracks.repository.js";
import { royaltiesRepository } from "./royalties.repository.js";
import { stellarPayoutService } from "./stellar-payout.service.js";

const ROYALTY_PAYOUT_SETTINGS_KEY = "royalty_payout_settings";
const ROYALTY_FEE_SETTINGS_KEY = "royalty_fee_settings";

const defaultConfig = (): RoyaltyEngineConfig =>
  royaltyEngineConfigSchema.parse({
    primaryChain: env.ROYALTY_REGISTRY_CHAIN,
    primaryNetwork: env.ROYALTY_REGISTRY_NETWORK,
    registryKind: env.ROYALTY_REGISTRY_CONTRACT_ID ? "soroban" : "offchain",
    registryContractId: env.ROYALTY_REGISTRY_CONTRACT_ID,
    settlementRails: ["stellar", "manual"],
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

const toBaseUnits = (amount: string) => {
  const [whole, fraction = ""] = amount.split(".");
  const paddedFraction = `${fraction}0000000`.slice(0, 7);
  return BigInt(whole) * 10_000_000n + BigInt(paddedFraction);
};

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

const sumRecipientBps = (recipients: UpsertTrackRoyaltySplitInput["recipients"]) =>
  recipients.reduce(
    (total: number, recipient: UpsertTrackRoyaltySplitInput["recipients"][number]) =>
      total + recipient.shareBps,
    0,
  );

const validateRecipients = (recipients: UpsertTrackRoyaltySplitInput["recipients"]) => {
  const totalBps = sumRecipientBps(recipients);

  if (totalBps !== 10_000) {
    throw new HttpError(
      400,
      `Royalty splits must total exactly 10000 bps. Received ${totalBps} bps.`,
    );
  }

  const recipientKeys = new Set<string>();

  for (const recipient of recipients) {
    const key = `${recipient.chain}:${recipient.walletAddress.toLowerCase()}`;

    if (recipientKeys.has(key)) {
      throw new HttpError(
        400,
        `Duplicate royalty recipient detected for ${recipient.walletAddress}.`,
      );
    }

    recipientKeys.add(key);
  }

  return totalBps;
};

const sortLedgerEntries = (entries: RoyaltyLedgerEntry[]) =>
  [...entries].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );

const sortPayouts = (items: RoyaltyPayoutRecord[]) =>
  [...items].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );

const payoutRailForEntry = (entry: RoyaltyLedgerEntry) =>
  entry.recipientChain === "stellar" ? "stellar" : "manual";

const sumAmounts = (amounts: string[]) =>
  fromBaseUnits(amounts.reduce((total, amount) => total + toBaseUnits(amount), 0n));

const intersect = (left: string[], right: string[]) => {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
};

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
  feeAmount?: string;
  netAmount: string;
} => {
  const grossUnits = toBaseUnits(grossAmount);
  const feeUnits = (grossUnits * BigInt(feeBps)) / 10_000n;
  const netUnits = grossUnits - feeUnits;

  if (netUnits <= 0n) {
    throw new HttpError(400, "Royalty fee configuration leaves no net distributable amount");
  }

  return {
    grossAmount: fromBaseUnits(grossUnits),
    feeAmount: feeUnits > 0n ? fromBaseUnits(feeUnits) : undefined,
    netAmount: fromBaseUnits(netUnits),
  };
};

const payoutGroupingKey = (entry: RoyaltyLedgerEntry) =>
  [
    entry.recipientWalletAddress.toLowerCase(),
    entry.recipientChain,
    entry.assetCode ?? "XLM",
    entry.assetIssuer ?? "",
  ].join("|");

const payoutHasActiveConflict = (
  payout: RoyaltyPayoutRecord,
  ledgerEntryIds: string[],
  retryFailedPayouts: boolean,
) => {
  const overlappingEntries = intersect(payout.ledgerEntryIds, ledgerEntryIds);

  if (overlappingEntries.length === 0) {
    return false;
  }

  if (["pending", "submitted", "confirmed"].includes(payout.status)) {
    return true;
  }

  if (payout.status === "failed" && !retryFailedPayouts) {
    return true;
  }

  return false;
};

export const royaltiesService = {
  getConfig() {
    return defaultConfig();
  },

  async getPayoutSettings(): Promise<RoyaltyPayoutSettings> {
    const stored = await databaseService.findSetting<Partial<RoyaltyPayoutSettings>>(
      ROYALTY_PAYOUT_SETTINGS_KEY,
    );

    return royaltyPayoutSettingsSchema.parse({
      ...defaultPayoutSettings(),
      ...stored,
    });
  },

  async updatePayoutSettings(input: unknown): Promise<RoyaltyPayoutSettings> {
    const parsed = royaltyPayoutSettingsSchema.parse(input);
    await databaseService.upsertSetting(ROYALTY_PAYOUT_SETTINGS_KEY, parsed);
    return this.getPayoutSettings();
  },

  async getFeeSettings(): Promise<RoyaltyFeeSettings> {
    const stored = await databaseService.findSetting<Partial<RoyaltyFeeSettings>>(
      ROYALTY_FEE_SETTINGS_KEY,
    );

    return royaltyFeeSettingsSchema.parse({
      ...defaultFeeSettings(),
      ...stored,
    });
  },

  async updateFeeSettings(input: unknown): Promise<RoyaltyFeeSettings> {
    const parsed = royaltyFeeSettingsSchema.parse(input);
    await databaseService.upsertSetting(ROYALTY_FEE_SETTINGS_KEY, parsed);
    return this.getFeeSettings();
  },

  async listTrackSplits(trackId: string): Promise<TrackRoyaltySplitList> {
    const items = (await royaltiesRepository.listTrackSplits(trackId)).sort(
      (left, right) => right.version - left.version,
    );

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

  async listPayouts(input?: ListRoyaltyPayoutsInput): Promise<RoyaltyPayoutRecord[]> {
    const parsed = listRoyaltyPayoutsInputSchema.parse(input ?? {});
    const payouts = await royaltiesRepository.listPayouts(parsed);

    return sortPayouts(
      payouts.map((entry) => royaltyPayoutRecordSchema.parse(entry)),
    );
  },

  async upsertTrackSplits(
    trackId: string,
    input: UpsertTrackRoyaltySplitInput,
  ): Promise<TrackRoyaltySplitRecord> {
    const track = await tracksRepository.findById(trackId);

    if (!track) {
      throw new HttpError(404, "Track not found");
    }

    const parsed = upsertTrackRoyaltySplitSchema.parse(input);
    const existing = await royaltiesRepository.listTrackSplits(trackId);
    const activeSplits = existing.filter((split) => split.status === "active");
    const nextVersion =
      existing.reduce((max, split) => Math.max(max, split.version), 0) + 1;
    const timestamp = new Date().toISOString();
    const totalBps = validateRecipients(parsed.recipients);
    const config = defaultConfig();

    if (parsed.activate) {
      await Promise.all(
        activeSplits.map((split) =>
          royaltiesRepository.upsertSplit(
            trackRoyaltySplitRecordSchema.parse({
              ...split,
              status: "superseded",
              updatedAt: timestamp,
            }),
          ),
        ),
      );
    }

    return royaltiesRepository.upsertSplit(
      trackRoyaltySplitRecordSchema.parse({
        id: createId("rsplit"),
        trackId,
        version: nextVersion,
        status: parsed.activate ? "active" : "draft",
        registryKind: config.registryKind,
        registryChain: config.primaryChain,
        registryNetwork: config.primaryNetwork,
        registryContractId: config.registryContractId,
        recipients: parsed.recipients,
        totalBps,
        notes: parsed.notes,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );
  },

  async ensureTrackPurchaseLedgerEntries(payment: PaymentRecord): Promise<RoyaltyLedgerEntry[]> {
    if (payment.productType !== "track_purchase" || !payment.trackId) {
      return [];
    }

    const existingEntries = await royaltiesRepository.listLedgerEntriesBySource(
      "track_purchase",
      payment.id,
    );

    if (existingEntries.length > 0) {
      return existingEntries;
    }

    const splitHistory = await this.listTrackSplits(payment.trackId);
    const activeSplit =
      splitHistory.items.find((split) => split.status === "active") ?? null;

    if (!activeSplit) {
      return [];
    }

    const payoutSettings = await this.getPayoutSettings();
    const feeSettings = await this.getFeeSettings();
    const timestamp = new Date().toISOString();
    const distributedAmounts = distributeByBps(payment.amount, activeSplit.recipients);
    const entries = distributedAmounts.map(({ recipient, amount }) =>
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

    await Promise.all(entries.map((entry) => royaltiesRepository.upsertLedgerEntry(entry)));

    return entries;
  },

  async ensurePlatformSubscriptionLedgerEntries(
    payment: PaymentRecord,
  ): Promise<RoyaltyLedgerEntry[]> {
    if (payment.productType !== "platform_subscription") {
      return [];
    }

    const existingEntries = await royaltiesRepository.listLedgerEntriesBySource(
      "platform_subscription",
      payment.id,
    );

    if (existingEntries.length > 0) {
      return existingEntries;
    }

    const allTracks = await tracksRepository.list();
    const eligibleTracks = (
      await Promise.all(
        allTracks.map(async (track) => {
          if (
            track.status !== "published" ||
            !track.playbackReady ||
            track.access !== "subscribers"
          ) {
            return null;
          }

          const splitHistory = await this.listTrackSplits(track.id);
          const activeSplit =
            splitHistory.items.find((split) => split.status === "active") ?? null;

          if (!activeSplit) {
            return null;
          }

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
    const trackAmounts = distributeEvenly(payment.amount, eligibleTracks.length);
    const timestamp = new Date().toISOString();
    const entries = eligibleTracks.flatMap(({ track, split }, index) =>
      distributeByBps(trackAmounts[index]!, split.recipients).map(
        ({ recipient, amount }) =>
          royaltyLedgerEntrySchema.parse({
            id: createId("rled"),
            trackId: track.id,
            splitId: split.id,
            sourceType: "platform_subscription",
            sourceId: payment.id,
            recipientWalletAddress: recipient.walletAddress,
            recipientChain: recipient.chain,
            recipientRole: recipient.role,
            status: payoutSettings.automaticApproval ? "approved" : "pending",
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

    await Promise.all(
      entries.map((entry) => royaltiesRepository.upsertLedgerEntry(entry)),
    );

    return entries;
  },

  async approveLedgerEntries(
    input: ApproveRoyaltyLedgerEntriesInput,
  ): Promise<RoyaltyLedgerEntry[]> {
    const parsed = approveRoyaltyLedgerEntriesSchema.parse(input);
    const entries = await royaltiesRepository.listLedgerEntriesByIds(parsed.entryIds);
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
          throw new HttpError(400, `Royalty ledger entry ${entry.id} has already been paid`);
        }

        if (entry.status === "reversed") {
          throw new HttpError(400, `Royalty ledger entry ${entry.id} has been reversed`);
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

  async runPayouts(input?: RunRoyaltyPayoutsInput): Promise<RoyaltyPayoutExecutionResult> {
    const parsed = runRoyaltyPayoutsSchema.parse(input ?? {});
    const payoutSettings = await this.getPayoutSettings();
    const approvedEntries = (
      await this.listLedgerEntries({
        status: "approved",
        recipientWalletAddress: parsed.recipientWalletAddress,
      })
    ).slice(0, parsed.maxEntries);

    if (approvedEntries.length === 0) {
      return royaltyPayoutExecutionResultSchema.parse({
        items: [],
      });
    }

    const groupedEntries = new Map<string, RoyaltyLedgerEntry[]>();

    for (const entry of approvedEntries) {
      const key = payoutGroupingKey(entry);
      const existing = groupedEntries.get(key) ?? [];
      existing.push(entry);
      groupedEntries.set(key, existing);
    }

    const results = [];
    const existingPayouts = await this.listPayouts(
      parsed.recipientWalletAddress
        ? {
            recipientWalletAddress: parsed.recipientWalletAddress,
          }
        : undefined,
    );

    if (payoutSettings.shortfallBehavior === "block_all") {
      const stellarGroups = Array.from(groupedEntries.values()).filter((entries) => {
        const firstEntry = entries[0]!;
        return payoutRailForEntry(firstEntry) === "stellar";
      });
      const totalsByAsset = new Map<string, bigint>();

      for (const entries of stellarGroups) {
        const firstEntry = entries[0]!;
        const amount = sumAmounts(entries.map((entry) => entry.netAmount));
        const key = `${firstEntry.assetCode ?? "XLM"}:${firstEntry.assetIssuer ?? ""}`;
        totalsByAsset.set(key, (totalsByAsset.get(key) ?? 0n) + toBaseUnits(amount));
      }

      if (totalsByAsset.size > 0) {
        const treasuryAddress = await stellarPayoutService.getTreasuryWalletAddress();
        const treasuryAccount = await stellarPayoutService.getTreasuryWalletAccount(
          treasuryAddress,
        );

        for (const [assetKey, requiredAmount] of totalsByAsset.entries()) {
          const matchingBalance = treasuryAccount.balances.find(
            (balance) => balance.assetKey === (assetKey === "XLM:" ? "native" : assetKey),
          );
          const availableAmount = matchingBalance?.availableAmount ?? "0";

          if (toBaseUnits(availableAmount) < requiredAmount) {
            return royaltyPayoutExecutionResultSchema.parse({
              items: Array.from(groupedEntries.values()).map((entries) => {
                const firstEntry = entries[0]!;
                const amount = sumAmounts(entries.map((entry) => entry.netAmount));
                return {
                  recipientWalletAddress: firstEntry.recipientWalletAddress,
                  recipientChain: firstEntry.recipientChain,
                  payoutRail: payoutRailForEntry(firstEntry),
                  status: "skipped" as const,
                  amount,
                  assetCode: firstEntry.assetCode,
                  assetIssuer: firstEntry.assetIssuer,
                  ledgerEntryIds: entries.map((entry) => entry.id),
                  reason:
                    "Treasury shortfall blocks this payout run under the current all-or-nothing policy.",
                };
              }),
            });
          }
        }
      }
    }

    for (const entries of groupedEntries.values()) {
      const firstEntry = entries[0]!;
      const payoutRail = payoutRailForEntry(firstEntry);
      const amount = sumAmounts(entries.map((entry) => entry.netAmount));
      const ledgerEntryIds = entries.map((entry) => entry.id);
      const duplicatePayout = existingPayouts.find((payout) =>
        payoutHasActiveConflict(payout, ledgerEntryIds, payoutSettings.retryFailedPayouts),
      );

      if (payoutRail !== "stellar") {
        results.push({
          recipientWalletAddress: firstEntry.recipientWalletAddress,
          recipientChain: firstEntry.recipientChain,
          payoutRail,
          status: "skipped" as const,
          amount,
          assetCode: firstEntry.assetCode,
          assetIssuer: firstEntry.assetIssuer,
          ledgerEntryIds,
          reason: "Automatic payouts are only implemented for Stellar rails in this phase.",
        });
        continue;
      }

      if (toBaseUnits(amount) < toBaseUnits(payoutSettings.minimumPayoutAmount)) {
        results.push({
          recipientWalletAddress: firstEntry.recipientWalletAddress,
          recipientChain: firstEntry.recipientChain,
          payoutRail,
          status: "skipped" as const,
          amount,
          assetCode: firstEntry.assetCode,
          assetIssuer: firstEntry.assetIssuer,
          ledgerEntryIds,
          reason: `Payout total is below the configured minimum threshold of ${payoutSettings.minimumPayoutAmount}.`,
        });
        continue;
      }

      if (duplicatePayout) {
        results.push({
          payoutId: duplicatePayout.id,
          recipientWalletAddress: firstEntry.recipientWalletAddress,
          recipientChain: firstEntry.recipientChain,
          payoutRail,
          status: "skipped" as const,
          amount,
          assetCode: firstEntry.assetCode,
          assetIssuer: firstEntry.assetIssuer,
          ledgerEntryIds,
          txHash: duplicatePayout.txHash,
          reason: `Payout batch conflicts with existing ${duplicatePayout.status} payout ${duplicatePayout.id}.`,
        });
        continue;
      }

      if (parsed.dryRun) {
        results.push({
          recipientWalletAddress: firstEntry.recipientWalletAddress,
          recipientChain: firstEntry.recipientChain,
          payoutRail,
          status: "dry_run" as const,
          amount,
          assetCode: firstEntry.assetCode,
          assetIssuer: firstEntry.assetIssuer,
          ledgerEntryIds,
        });
        continue;
      }

      const timestamp = new Date().toISOString();
      const payoutId = createId("rpay");

      try {
        const payout = royaltyPayoutRecordSchema.parse({
          id: payoutId,
          recipientWalletAddress: firstEntry.recipientWalletAddress,
          recipientChain: firstEntry.recipientChain,
          payoutRail,
          status: "submitted",
          amount,
          assetCode: firstEntry.assetCode,
          assetIssuer: firstEntry.assetIssuer,
          ledgerEntryIds,
          submittedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        const submission = await stellarPayoutService.submitPayment({
          recipientWalletAddress: firstEntry.recipientWalletAddress,
          amount,
          assetCode: firstEntry.assetCode,
          assetIssuer: firstEntry.assetIssuer,
        });

        const submittedPayout = royaltyPayoutRecordSchema.parse({
          ...payout,
          txHash: submission.txHash,
          updatedAt: new Date().toISOString(),
        });
        await royaltiesRepository.upsertPayout(submittedPayout);

        if (!payoutSettings.confirmBeforeMarkPaid) {
          const confirmedAt = new Date().toISOString();
          const confirmedPayout = royaltyPayoutRecordSchema.parse({
            ...submittedPayout,
            status: "confirmed",
            confirmedAt,
            updatedAt: confirmedAt,
          });
          await royaltiesRepository.upsertPayout(confirmedPayout);

          await Promise.all(
            entries.map((entry) =>
              royaltiesRepository.upsertLedgerEntry(
                royaltyLedgerEntrySchema.parse({
                  ...entry,
                  status: "paid",
                  updatedAt: confirmedAt,
                }),
              ),
            ),
          );

          results.push({
            payoutId: confirmedPayout.id,
            recipientWalletAddress: firstEntry.recipientWalletAddress,
            recipientChain: firstEntry.recipientChain,
            payoutRail,
            status: "confirmed" as const,
            amount,
            assetCode: firstEntry.assetCode,
            assetIssuer: firstEntry.assetIssuer,
            ledgerEntryIds,
            txHash: confirmedPayout.txHash,
          });
          continue;
        }

        results.push({
          payoutId: submittedPayout.id,
          recipientWalletAddress: firstEntry.recipientWalletAddress,
          recipientChain: firstEntry.recipientChain,
          payoutRail,
          status: "submitted" as const,
          amount,
          assetCode: firstEntry.assetCode,
          assetIssuer: firstEntry.assetIssuer,
          ledgerEntryIds,
          txHash: submittedPayout.txHash,
        });
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "Unknown payout failure";
        const failedPayout = royaltyPayoutRecordSchema.parse({
          id: payoutId,
          recipientWalletAddress: firstEntry.recipientWalletAddress,
          recipientChain: firstEntry.recipientChain,
          payoutRail,
          status: "failed",
          amount,
          assetCode: firstEntry.assetCode,
          assetIssuer: firstEntry.assetIssuer,
          ledgerEntryIds,
          submittedAt: timestamp,
          failedAt: new Date().toISOString(),
          failureReason: reason,
          createdAt: timestamp,
          updatedAt: new Date().toISOString(),
        });
        await royaltiesRepository.upsertPayout(failedPayout);

        results.push({
          payoutId: failedPayout.id,
          recipientWalletAddress: firstEntry.recipientWalletAddress,
          recipientChain: firstEntry.recipientChain,
          payoutRail,
          status: "failed" as const,
          amount,
          assetCode: firstEntry.assetCode,
          assetIssuer: firstEntry.assetIssuer,
          ledgerEntryIds,
          reason,
        });
      }
    }

    return royaltyPayoutExecutionResultSchema.parse({
      items: results,
    });
  },

  async reconcilePayouts(
    input?: ReconcileRoyaltyPayoutsInput,
  ): Promise<RoyaltyPayoutReconciliationResult> {
    const parsed = reconcileRoyaltyPayoutsSchema.parse(input ?? {});
    const candidates = parsed.payoutIds
      ? (await this.listPayouts()).filter((payout) => parsed.payoutIds?.includes(payout.id))
      : await this.listPayouts(parsed.submittedOnly ? { status: "submitted" } : undefined);
    const payouts = candidates.slice(0, parsed.maxItems);
    const results = [];

    for (const payout of payouts) {
      if (!payout.txHash) {
        results.push({
          payoutId: payout.id,
          status: payout.status,
          ledgerEntryIds: payout.ledgerEntryIds,
          reason: "Payout has no transaction hash to reconcile.",
        });
        continue;
      }

      if (payout.payoutRail !== "stellar") {
        results.push({
          payoutId: payout.id,
          status: payout.status,
          txHash: payout.txHash,
          ledgerEntryIds: payout.ledgerEntryIds,
          reason: "Automatic reconciliation is only implemented for Stellar payouts.",
        });
        continue;
      }

      const checkedAt = new Date().toISOString();

      try {
        const tx = await stellarPayoutService.getTransactionStatus(payout.txHash);

        if (!tx.found) {
          const updated = royaltyPayoutRecordSchema.parse({
            ...payout,
            lastCheckedAt: checkedAt,
            updatedAt: checkedAt,
          });
          await royaltiesRepository.upsertPayout(updated);
          results.push({
            payoutId: updated.id,
            status: updated.status,
            txHash: updated.txHash,
            ledgerEntryIds: updated.ledgerEntryIds,
            reason: "Transaction not found on Horizon yet.",
          });
          continue;
        }

        if (tx.successful) {
          const confirmedAt = tx.createdAt ?? checkedAt;
          const confirmedPayout = royaltyPayoutRecordSchema.parse({
            ...payout,
            status: "confirmed",
            confirmedAt,
            lastCheckedAt: checkedAt,
            updatedAt: checkedAt,
          });
          await royaltiesRepository.upsertPayout(confirmedPayout);

          const linkedEntries = await royaltiesRepository.listLedgerEntriesByIds(
            payout.ledgerEntryIds,
          );
          await Promise.all(
            linkedEntries.map((entry) =>
              royaltiesRepository.upsertLedgerEntry(
                royaltyLedgerEntrySchema.parse({
                  ...entry,
                  status: "paid",
                  updatedAt: checkedAt,
                }),
              ),
            ),
          );

          results.push({
            payoutId: confirmedPayout.id,
            status: confirmedPayout.status,
            txHash: confirmedPayout.txHash,
            ledgerEntryIds: confirmedPayout.ledgerEntryIds,
          });
          continue;
        }

        const failedReason =
          "Transaction was found on Horizon but did not complete successfully.";
        const failedPayout = royaltyPayoutRecordSchema.parse({
          ...payout,
          status: "failed",
          failedAt: checkedAt,
          lastCheckedAt: checkedAt,
          failureReason: failedReason,
          updatedAt: checkedAt,
        });
        await royaltiesRepository.upsertPayout(failedPayout);

        const linkedEntries = await royaltiesRepository.listLedgerEntriesByIds(
          payout.ledgerEntryIds,
        );
        await Promise.all(
          linkedEntries.map((entry) =>
            royaltiesRepository.upsertLedgerEntry(
              royaltyLedgerEntrySchema.parse({
                ...entry,
                status: "approved",
                updatedAt: checkedAt,
              }),
            ),
          ),
        );

        results.push({
          payoutId: failedPayout.id,
          status: failedPayout.status,
          txHash: failedPayout.txHash,
          ledgerEntryIds: failedPayout.ledgerEntryIds,
          reason: failedReason,
        });
      } catch (error) {
        results.push({
          payoutId: payout.id,
          status: payout.status,
          txHash: payout.txHash,
          ledgerEntryIds: payout.ledgerEntryIds,
          reason: error instanceof Error ? error.message : "Unknown reconciliation failure",
        });
      }
    }

    return royaltyPayoutReconciliationResultSchema.parse({
      items: results,
    });
  },
};
