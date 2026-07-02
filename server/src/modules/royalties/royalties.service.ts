import {
  royaltyLedgerEntrySchema,
  royaltyEngineConfigSchema,
  trackRoyaltySplitListSchema,
  trackRoyaltySplitRecordSchema,
  upsertTrackRoyaltySplitSchema,
  type PaymentRecord,
  type RoyaltyEngineConfig,
  type RoyaltyLedgerEntry,
  type TrackRoyaltySplitList,
  type TrackRoyaltySplitRecord,
  type UpsertTrackRoyaltySplitInput,
} from "@music-city/shared";

import { env } from "../../config/env.js";
import { createId } from "../../services/id.service.js";
import { HttpError } from "../../utils/http-error.js";
import { tracksRepository } from "../tracks/tracks.repository.js";
import { royaltiesRepository } from "./royalties.repository.js";

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

export const royaltiesService = {
  getConfig() {
    return defaultConfig();
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

    return entries
      .map((entry) => royaltyLedgerEntrySchema.parse(entry))
      .sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt),
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
        status: "pending",
        grossAmount: amount,
        netAmount: amount,
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
            status: "pending",
            grossAmount: amount,
            netAmount: amount,
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
};
