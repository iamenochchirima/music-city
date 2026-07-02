import { z } from "zod";

import {
  optionalPositiveAmountSchema,
  optionalStellarAssetCodeSchema,
  optionalStellarAssetIssuerSchema,
  positiveAmountSchema,
} from "./commerce.js";

export const royaltyChainSchema = z.enum([
  "stellar",
  "evm",
  "solana",
  "manual",
]);
export type RoyaltyChain = z.infer<typeof royaltyChainSchema>;

export const royaltyRegistryKindSchema = z.enum([
  "offchain",
  "soroban",
  "evm_contract",
]);
export type RoyaltyRegistryKind = z.infer<typeof royaltyRegistryKindSchema>;

export const royaltySettlementRailSchema = z.enum([
  "stellar",
  "evm",
  "solana",
  "manual",
]);
export type RoyaltySettlementRail = z.infer<typeof royaltySettlementRailSchema>;

export const royaltyRecipientRoleSchema = z.enum([
  "artist",
  "producer",
  "writer",
  "featured_artist",
  "label",
  "platform",
  "other",
]);
export type RoyaltyRecipientRole = z.infer<typeof royaltyRecipientRoleSchema>;

export const royaltySplitStatusSchema = z.enum([
  "draft",
  "active",
  "superseded",
  "archived",
]);
export type RoyaltySplitStatus = z.infer<typeof royaltySplitStatusSchema>;

export const royaltyLedgerStatusSchema = z.enum([
  "pending",
  "approved",
  "paid",
  "reversed",
]);
export type RoyaltyLedgerStatus = z.infer<typeof royaltyLedgerStatusSchema>;

export const royaltyPayoutStatusSchema = z.enum([
  "pending",
  "submitted",
  "confirmed",
  "failed",
  "cancelled",
]);
export type RoyaltyPayoutStatus = z.infer<typeof royaltyPayoutStatusSchema>;

export const royaltySourceTypeSchema = z.enum([
  "track_purchase",
  "platform_subscription",
  "ad_revenue",
  "manual_adjustment",
]);
export type RoyaltySourceType = z.infer<typeof royaltySourceTypeSchema>;

const genericWalletAddressSchema = z.string().trim().min(3).max(128);

export const royaltySplitRecipientSchema = z.object({
  walletAddress: genericWalletAddressSchema,
  chain: royaltyChainSchema.default("stellar"),
  role: royaltyRecipientRoleSchema.default("artist"),
  displayName: z.string().trim().min(1).max(120).optional(),
  shareBps: z.number().int().positive().max(10_000),
  payoutRail: royaltySettlementRailSchema.optional(),
});
export type RoyaltySplitRecipient = z.infer<typeof royaltySplitRecipientSchema>;

export const trackRoyaltySplitRecordSchema = z.object({
  id: z.string().min(1),
  trackId: z.string().min(1),
  version: z.number().int().positive(),
  status: royaltySplitStatusSchema,
  registryKind: royaltyRegistryKindSchema.default("offchain"),
  registryChain: royaltyChainSchema.optional(),
  registryNetwork: z.string().trim().min(1).max(80).optional(),
  registryContractId: z.string().trim().min(1).max(160).optional(),
  recipients: z.array(royaltySplitRecipientSchema).min(1),
  totalBps: z.number().int().min(1).max(10_000),
  notes: z.string().trim().max(500).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TrackRoyaltySplitRecord = z.infer<typeof trackRoyaltySplitRecordSchema>;

export const royaltyEngineConfigSchema = z.object({
  primaryChain: royaltyChainSchema.default("stellar"),
  primaryNetwork: z.string().trim().min(1).max(80),
  registryKind: royaltyRegistryKindSchema.default("offchain"),
  registryContractId: z.string().trim().min(1).max(160).optional(),
  settlementRails: z.array(royaltySettlementRailSchema).min(1),
  payoutAssetCode: optionalStellarAssetCodeSchema,
  payoutAssetIssuer: optionalStellarAssetIssuerSchema,
});
export type RoyaltyEngineConfig = z.infer<typeof royaltyEngineConfigSchema>;

export const royaltyLedgerEntrySchema = z.object({
  id: z.string().min(1),
  trackId: z.string().min(1),
  splitId: z.string().min(1),
  sourceType: royaltySourceTypeSchema,
  sourceId: z.string().min(1),
  recipientWalletAddress: genericWalletAddressSchema,
  recipientChain: royaltyChainSchema,
  recipientRole: royaltyRecipientRoleSchema,
  status: royaltyLedgerStatusSchema,
  grossAmount: positiveAmountSchema,
  netAmount: positiveAmountSchema,
  feeAmount: optionalPositiveAmountSchema,
  assetCode: optionalStellarAssetCodeSchema,
  assetIssuer: optionalStellarAssetIssuerSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RoyaltyLedgerEntry = z.infer<typeof royaltyLedgerEntrySchema>;

export const royaltyPayoutRecordSchema = z.object({
  id: z.string().min(1),
  recipientWalletAddress: genericWalletAddressSchema,
  recipientChain: royaltyChainSchema,
  payoutRail: royaltySettlementRailSchema,
  status: royaltyPayoutStatusSchema,
  amount: positiveAmountSchema,
  assetCode: optionalStellarAssetCodeSchema,
  assetIssuer: optionalStellarAssetIssuerSchema,
  txHash: z.string().trim().min(1).max(160).optional(),
  ledgerEntryIds: z.array(z.string().min(1)).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RoyaltyPayoutRecord = z.infer<typeof royaltyPayoutRecordSchema>;

export const upsertTrackRoyaltySplitSchema = z.object({
  recipients: z.array(royaltySplitRecipientSchema).min(1).max(20),
  notes: z.string().trim().max(500).optional(),
  activate: z.boolean().default(true),
});
export type UpsertTrackRoyaltySplitInput = z.infer<
  typeof upsertTrackRoyaltySplitSchema
>;

export const trackRoyaltySplitListSchema = z.object({
  trackId: z.string().min(1),
  items: z.array(trackRoyaltySplitRecordSchema),
});
export type TrackRoyaltySplitList = z.infer<typeof trackRoyaltySplitListSchema>;
