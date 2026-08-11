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

export const royaltyRegistryVerificationStatusSchema = z.enum([
  "unverified",
  "match",
  "mismatch",
]);
export type RoyaltyRegistryVerificationStatus = z.infer<
  typeof royaltyRegistryVerificationStatusSchema
>;

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

export const royaltyPayoutCadenceSchema = z.enum([
  "manual",
  "daily",
  "weekly",
  "monthly",
]);
export type RoyaltyPayoutCadence = z.infer<typeof royaltyPayoutCadenceSchema>;

export const royaltyPayoutApprovalModeSchema = z.enum([
  "admin",
  "automatic",
]);
export type RoyaltyPayoutApprovalMode = z.infer<
  typeof royaltyPayoutApprovalModeSchema
>;

export const royaltyPayoutShortfallBehaviorSchema = z.enum([
  "block_all",
  "allow_partial_batches",
]);
export type RoyaltyPayoutShortfallBehavior = z.infer<
  typeof royaltyPayoutShortfallBehaviorSchema
>;

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
  registryTxHash: z.string().trim().min(1).max(160).optional(),
  registryMetadataHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  registryPublishedAt: z.string().optional(),
  registryVerificationStatus: royaltyRegistryVerificationStatusSchema.optional(),
  registryVerifiedAt: z.string().optional(),
  registryVerificationMessage: z.string().trim().min(1).max(500).optional(),
  recipients: z.array(royaltySplitRecipientSchema).min(1),
  totalBps: z.number().int().min(1).max(10_000),
  notes: z.string().trim().max(500).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TrackRoyaltySplitRecord = z.infer<typeof trackRoyaltySplitRecordSchema>;

export const sorobanTrackSplitSchema = z.object({
  version: z.number().int().positive(),
  recipients: z.array(royaltySplitRecipientSchema).min(1).max(20),
  metadataHash: z.string().regex(/^[a-f0-9]{64}$/),
  frozen: z.boolean(),
  updatedLedger: z.number().int().nonnegative(),
});
export type SorobanTrackSplit = z.infer<typeof sorobanTrackSplitSchema>;

export const royaltySplitPublicationResultSchema = z.object({
  split: trackRoyaltySplitRecordSchema,
  onChainSplit: sorobanTrackSplitSchema,
  contractId: z.string().trim().min(1).max(160),
  network: z.string().trim().min(1).max(80),
  txHash: z.string().trim().min(1).max(160),
  explorerUrl: z.string().url(),
});
export type RoyaltySplitPublicationResult = z.infer<
  typeof royaltySplitPublicationResultSchema
>;

export const royaltySplitVerificationResultSchema = z.object({
  split: trackRoyaltySplitRecordSchema,
  onChainSplit: sorobanTrackSplitSchema.optional(),
  contractId: z.string().trim().min(1).max(160),
  network: z.string().trim().min(1).max(80),
  matches: z.boolean(),
  differences: z.array(z.string()),
  verifiedAt: z.string(),
});
export type RoyaltySplitVerificationResult = z.infer<
  typeof royaltySplitVerificationResultSchema
>;

export const royaltyEngineConfigSchema = z.object({
  primaryChain: royaltyChainSchema.default("stellar"),
  primaryNetwork: z.string().trim().min(1).max(80),
  registryKind: royaltyRegistryKindSchema.default("offchain"),
  registryContractId: z.string().trim().min(1).max(160).optional(),
  registryExplorerUrl: z.string().url().optional(),
  settlementRails: z.array(royaltySettlementRailSchema).min(1),
  payoutAssetCode: optionalStellarAssetCodeSchema,
  payoutAssetIssuer: optionalStellarAssetIssuerSchema,
});
export type RoyaltyEngineConfig = z.infer<typeof royaltyEngineConfigSchema>;

export const royaltyFeeSettingsSchema = z.object({
  trackPurchaseFeeBps: z.number().int().min(0).max(9_999),
  platformSubscriptionFeeBps: z.number().int().min(0).max(9_999),
  adRevenueFeeBps: z.number().int().min(0).max(9_999),
  manualAdjustmentFeeBps: z.number().int().min(0).max(9_999),
});
export type RoyaltyFeeSettings = z.infer<typeof royaltyFeeSettingsSchema>;

export const royaltyPayoutSettingsSchema = z.object({
  approvalMode: royaltyPayoutApprovalModeSchema.default("admin"),
  cadence: royaltyPayoutCadenceSchema.default("manual"),
  minimumPayoutAmount: positiveAmountSchema,
  retryFailedPayouts: z.boolean().default(true),
  shortfallBehavior: royaltyPayoutShortfallBehaviorSchema.default("block_all"),
  automaticApproval: z.boolean().default(false),
  reversalPolicy: z.string().trim().min(1).max(300),
  confirmBeforeMarkPaid: z.boolean().default(true),
});
export type RoyaltyPayoutSettings = z.infer<typeof royaltyPayoutSettingsSchema>;

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
  submittedAt: z.string().optional(),
  confirmedAt: z.string().optional(),
  failedAt: z.string().optional(),
  lastCheckedAt: z.string().optional(),
  failureReason: z.string().trim().min(1).max(300).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RoyaltyPayoutRecord = z.infer<typeof royaltyPayoutRecordSchema>;

export const listRoyaltyLedgerEntriesInputSchema = z.object({
  status: royaltyLedgerStatusSchema.optional(),
  recipientWalletAddress: genericWalletAddressSchema.optional(),
});
export type ListRoyaltyLedgerEntriesInput = z.infer<
  typeof listRoyaltyLedgerEntriesInputSchema
>;

export const listRoyaltyPayoutsInputSchema = z.object({
  status: royaltyPayoutStatusSchema.optional(),
  recipientWalletAddress: genericWalletAddressSchema.optional(),
});
export type ListRoyaltyPayoutsInput = z.infer<
  typeof listRoyaltyPayoutsInputSchema
>;

export const approveRoyaltyLedgerEntriesSchema = z.object({
  entryIds: z.array(z.string().min(1)).min(1).max(500),
});
export type ApproveRoyaltyLedgerEntriesInput = z.infer<
  typeof approveRoyaltyLedgerEntriesSchema
>;

export const runRoyaltyPayoutsSchema = z.object({
  recipientWalletAddress: genericWalletAddressSchema.optional(),
  maxEntries: z.number().int().positive().max(500).default(100),
  dryRun: z.boolean().default(false),
});
export type RunRoyaltyPayoutsInput = z.infer<typeof runRoyaltyPayoutsSchema>;

export const royaltyPayoutExecutionStatusSchema = z.enum([
  "dry_run",
  "submitted",
  "confirmed",
  "failed",
  "skipped",
]);
export type RoyaltyPayoutExecutionStatus = z.infer<
  typeof royaltyPayoutExecutionStatusSchema
>;

export const royaltyPayoutExecutionItemSchema = z.object({
  payoutId: z.string().min(1).optional(),
  recipientWalletAddress: genericWalletAddressSchema,
  recipientChain: royaltyChainSchema,
  payoutRail: royaltySettlementRailSchema,
  status: royaltyPayoutExecutionStatusSchema,
  amount: positiveAmountSchema,
  assetCode: optionalStellarAssetCodeSchema,
  assetIssuer: optionalStellarAssetIssuerSchema,
  ledgerEntryIds: z.array(z.string().min(1)).min(1),
  txHash: z.string().trim().min(1).max(160).optional(),
  reason: z.string().trim().min(1).max(300).optional(),
});
export type RoyaltyPayoutExecutionItem = z.infer<
  typeof royaltyPayoutExecutionItemSchema
>;

export const royaltyPayoutExecutionResultSchema = z.object({
  items: z.array(royaltyPayoutExecutionItemSchema),
});
export type RoyaltyPayoutExecutionResult = z.infer<
  typeof royaltyPayoutExecutionResultSchema
>;

export const reconcileRoyaltyPayoutsSchema = z.object({
  payoutIds: z.array(z.string().min(1)).min(1).max(500).optional(),
  submittedOnly: z.boolean().default(true),
  maxItems: z.number().int().positive().max(500).default(100),
});
export type ReconcileRoyaltyPayoutsInput = z.infer<
  typeof reconcileRoyaltyPayoutsSchema
>;

export const royaltyPayoutReconciliationItemSchema = z.object({
  payoutId: z.string().min(1),
  status: royaltyPayoutStatusSchema,
  txHash: z.string().trim().min(1).max(160).optional(),
  ledgerEntryIds: z.array(z.string().min(1)),
  reason: z.string().trim().min(1).max(300).optional(),
});
export type RoyaltyPayoutReconciliationItem = z.infer<
  typeof royaltyPayoutReconciliationItemSchema
>;

export const royaltyPayoutReconciliationResultSchema = z.object({
  items: z.array(royaltyPayoutReconciliationItemSchema),
});
export type RoyaltyPayoutReconciliationResult = z.infer<
  typeof royaltyPayoutReconciliationResultSchema
>;

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
