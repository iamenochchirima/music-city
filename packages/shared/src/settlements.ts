import { z } from "zod";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const units = z.string().regex(/^(0|[1-9][0-9]*)$/);
const wallet = z.string().regex(/^G[A-Z2-7]{55}$/);
export const settlementConfigSchema = z.object({
  contractId: z.string(),
  registryId: z.string(),
  assetContractId: z.string(),
  treasuryAddress: wallet,
  networkPassphrase: z.string(),
  assetCode: z.literal("USDC"),
  assetIssuer: wallet,
});
export type SettlementConfig = z.infer<typeof settlementConfigSchema>;
export const settlementAllocationSchema = z.object({
  index: z.number().int().nonnegative(),
  beneficiary: wallet,
  grossUnits: units,
  feeUnits: units,
  amountUnits: units,
  ledgerEntryIds: z.array(z.string()),
  status: z.enum(["pending", "available", "claimed", "reclaimed"]),
  updatedLedger: z.number().int().optional(),
  transactionHash: hash.optional(),
});
export const settlementBatchSchema = z.object({
  id: hash,
  sourceKey: hash,
  trackId: z.string(),
  sourceType: z.string(),
  sourceId: z.string(),
  agreementId: z.string(),
  version: z.number().int().positive(),
  proposalHash: hash,
  grossUnits: units,
  feeBps: z.number().int().min(0).max(9999),
  fundedUnits: units,
  expiresAt: z.string().datetime(),
  config: settlementConfigSchema,
  allocations: z.array(settlementAllocationSchema).min(1).max(20),
  state: z.enum(["reserved", "funded", "closed"]),
  fundedLedger: z.number().int().optional(),
  fundingHash: hash.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  discrepancy: z.string().optional(),
});
export type SettlementBatch = z.infer<typeof settlementBatchSchema>;
export const financialAttemptSchema = z.object({
  id: z.string(),
  batchId: hash,
  kind: z.enum(["settle", "claim", "reclaim", "maintain", "restore"]),
  claimIndex: z.number().int().nonnegative().optional(),
  actor: z.string(),
  treasuryAddress: wallet,
  networkPassphrase: z.string(),
  transaction: z.string(),
  transactionHash: hash,
  signers: z.array(wallet),
  signatures: z.record(z.string()),
  signedBy: z.array(wallet),
  status: z.enum([
    "awaiting_signatures",
    "submitting",
    "submitted",
    "confirmed",
    "failed",
    "expired",
  ]),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  ledger: z.number().int().optional(),
  feeCharged: units.optional(),
  submissionCount: z.number().int().nonnegative().default(0),
  lastSubmittedAt: z.string().datetime().optional(),
  error: z.string().optional(),
});
export type FinancialAttempt = z.infer<typeof financialAttemptSchema>;
export const settlementPreviewInputSchema = z
  .object({
    trackId: z.string().min(1),
    sourceType: z.string().min(1),
    sourceId: z.string().min(1),
    expiresAt: z.string().datetime(),
  })
  .strict();
export const signedFinancialTransactionSchema = z
  .object({ signedTransaction: z.string().min(1).max(200000) })
  .strict();
