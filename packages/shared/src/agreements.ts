import { z } from "zod";
import { royaltyRecipientRoleSchema } from "./royalties.js";

export const agreementStateSchema = z.enum([
  "draft", "proposed", "ready", "rejected", "disputed", "finalizing", "finalized", "cancelled",
]);
export const agreementActionSchema = z.enum(["accept", "reject", "dispute"]);
export const agreementRecipientSchema = z.object({
  walletAddress: z.string().regex(/^G[A-Z2-7]{55}$/),
  role: royaltyRecipientRoleSchema,
  shareBps: z.number().int().min(1).max(10_000),
}).strict();
export const agreementTermsSchema = z.object({
  recipients: z.array(agreementRecipientSchema).min(1).max(20),
  terms: z.string().trim().max(2000).default(""),
}).strict().superRefine((value, ctx) => {
  if (value.recipients.reduce((sum, r) => sum + r.shareBps, 0) !== 10_000) {
    ctx.addIssue({ code: "custom", path: ["recipients"], message: "Shares must total exactly 10,000 basis points" });
  }
  if (new Set(value.recipients.map(r => r.walletAddress)).size !== value.recipients.length) {
    ctx.addIssue({ code: "custom", path: ["recipients"], message: "Contributor wallets must be unique" });
  }
});
export const agreementProposalSchema = z.object({
  schemaVersion: z.literal(1),
  agreementId: z.string().min(1),
  trackId: z.string().min(1),
  releaseId: z.string().min(1).nullable(),
  version: z.number().int().positive(),
  previousHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  networkPassphrase: z.string().min(1),
  ownerWallet: z.string().regex(/^G[A-Z2-7]{55}$/),
  recipients: z.array(agreementRecipientSchema).min(1).max(20),
  terms: z.string().max(2000),
}).strict();
export const agreementResponseSchema = z.object({
  walletAddress: z.string(),
  action: agreementActionSchema,
  proposalHash: z.string().regex(/^[a-f0-9]{64}$/),
  challengeId: z.string(),
  reason: z.string().max(1000),
  signedTransaction: z.string(),
  respondedAt: z.string().datetime(),
});
export const agreementVersionSchema = z.object({
  proposal: agreementProposalSchema,
  proposalHash: z.string().regex(/^[a-f0-9]{64}$/),
  state: agreementStateSchema,
  responses: z.array(agreementResponseSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const agreementResponseRequestSchema = z.object({
  action: agreementActionSchema,
  reason: z.string().trim().max(1000).default(""),
}).strict().superRefine((v, ctx) => {
  if (v.action !== "accept" && !v.reason) {
    ctx.addIssue({ code: "custom", path: ["reason"], message: "A rejection or dispute requires a reason" });
  }
  if (v.action === "accept" && v.reason) {
    ctx.addIssue({ code: "custom", path: ["reason"], message: "Acceptance cannot contain a rejection reason" });
  }
});
export type AgreementTerms = z.infer<typeof agreementTermsSchema>;
export type AgreementProposal = z.infer<typeof agreementProposalSchema>;
export type AgreementVersion = z.infer<typeof agreementVersionSchema>;
export type AgreementResponse = z.infer<typeof agreementResponseSchema>;
export type AgreementAction = z.infer<typeof agreementActionSchema>;

export const finalizedAgreementSplitSchema = z.object({
  agreementId: z.string(), version: z.number().int().positive(),
  recipients: z.array(agreementRecipientSchema),
  proposalHash: z.string().regex(/^[a-f0-9]{64}$/),
  previousFinalizedHash: z.string().regex(/^[a-f0-9]{64}$/),
  finalizedLedger: z.number().int().nonnegative(),
});
export const agreementFinalizationSchema = z.object({
  id: z.string().uuid(), agreementId: z.string(), version: z.number().int().positive(),
  proposalHash: z.string().regex(/^[a-f0-9]{64}$/),
  previousFinalizedHash: z.string().regex(/^[a-f0-9]{64}$/),
  treasuryAddress: z.string(), contractId: z.string(), networkPassphrase: z.string(),
  transaction: z.string(), transactionHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.string().datetime(),
  signers: z.array(z.string()).length(3),
  signedBy: z.array(z.string()),
  signatures: z.record(z.string()),
  status: z.enum(["awaiting_signatures","submitting","submitted","confirmed","failed","expired"]),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  error: z.string().optional(), ledger: z.number().int().optional(), explorerUrl: z.string().url().optional(),
});
export type FinalizedAgreementSplit = z.infer<typeof finalizedAgreementSplitSchema>;
export type AgreementFinalization = z.infer<typeof agreementFinalizationSchema>;
