import { z } from "zod";

import { stellarWalletAddressSchema } from "./commerce.js";

export const adStatusSchema = z.enum(["draft", "active", "paused", "archived"]);
export type AdStatus = z.infer<typeof adStatusSchema>;

export const adSlotSchema = z.enum(["preroll"]);
export type AdSlot = z.infer<typeof adSlotSchema>;

export const adTargetAccessSchema = z.enum(["public"]);
export type AdTargetAccess = z.infer<typeof adTargetAccessSchema>;

export const adImpressionStatusSchema = z.enum([
  "pending",
  "started",
  "completed",
  "skipped",
  "failed",
]);
export type AdImpressionStatus = z.infer<typeof adImpressionStatusSchema>;

const genericUrlSchema = z.string().trim().url().max(500);

export const adRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  brandName: z.string().trim().min(1).max(120).optional(),
  status: adStatusSchema,
  slot: adSlotSchema.default("preroll"),
  audioUrl: genericUrlSchema,
  audioStorageKey: z.string().trim().min(1).max(500).optional(),
  audioStorageProvider: z.enum(["local", "s3"]).optional(),
  clickUrl: genericUrlSchema.optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  priority: z.number().int().min(0).max(10_000).default(0),
  weight: z.number().int().positive().max(10_000).default(1),
  targetAccess: adTargetAccessSchema.default("public"),
  maxImpressionsPerWalletPerDay: z.number().int().positive().max(1_000).default(3),
  notes: z.string().trim().max(500).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdRecord = z.infer<typeof adRecordSchema>;

export const createAdInputSchema = adRecordSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateAdInput = z.infer<typeof createAdInputSchema>;

export const updateAdInputSchema = createAdInputSchema.partial().extend({
  name: z.string().trim().min(1).max(120).optional(),
  audioUrl: genericUrlSchema.optional(),
});
export type UpdateAdInput = z.infer<typeof updateAdInputSchema>;

export const adImpressionRecordSchema = z.object({
  id: z.string().min(1),
  adId: z.string().min(1),
  walletAddress: stellarWalletAddressSchema,
  trackId: z.string().min(1),
  status: adImpressionStatusSchema,
  slot: adSlotSchema.default("preroll"),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  failedAt: z.string().optional(),
  reason: z.string().trim().min(1).max(300).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdImpressionRecord = z.infer<typeof adImpressionRecordSchema>;

export const adDecisionSchema = z.object({
  serveAd: z.boolean(),
  impressionId: z.string().min(1).optional(),
  reason: z.string().trim().min(1).max(300).optional(),
  ad: adRecordSchema.optional(),
});
export type AdDecision = z.infer<typeof adDecisionSchema>;

export const startAdImpressionInputSchema = z.object({
  impressionId: z.string().min(1),
});
export type StartAdImpressionInput = z.infer<typeof startAdImpressionInputSchema>;

export const updateAdImpressionInputSchema = z.object({
  status: z.enum(["completed", "skipped", "failed"]),
  reason: z.string().trim().min(1).max(300).optional(),
});
export type UpdateAdImpressionInput = z.infer<typeof updateAdImpressionInputSchema>;

export const adPerformanceSummarySchema = z.object({
  pending: z.number().int().nonnegative(),
  started: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type AdPerformanceSummary = z.infer<typeof adPerformanceSummarySchema>;

export const adminAdListItemSchema = adRecordSchema.extend({
  summary: adPerformanceSummarySchema,
});
export type AdminAdListItem = z.infer<typeof adminAdListItemSchema>;
