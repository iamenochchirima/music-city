import { z } from "zod";

import {
  optionalStellarAssetIssuerSchema,
  nonNegativeAmountSchema,
  positiveAmountSchema,
  stellarAssetCodeSchema,
  stellarWalletAddressSchema,
} from "./commerce.js";

export const paymentProductTypeSchema = z.enum([
  "track_purchase",
  "platform_subscription",
  "artist_onboarding_fee",
]);
export type PaymentProductType = z.infer<typeof paymentProductTypeSchema>;

export const paymentIntentStatusSchema = z.enum([
  "pending",
  "confirmed",
  "expired",
  "failed",
]);
export type PaymentIntentStatus = z.infer<typeof paymentIntentStatusSchema>;

export const paymentStatusSchema = z.enum(["confirmed", "failed"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const subscriptionStatusSchema = z.enum(["active", "expired", "cancelled"]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const subscriptionScopeSchema = z.enum(["platform"]);
export type SubscriptionScope = z.infer<typeof subscriptionScopeSchema>;

export const stellarAssetSchema = z.object({
  code: stellarAssetCodeSchema,
  issuer: optionalStellarAssetIssuerSchema,
  isNative: z.boolean().default(false),
});
export type StellarAssetDescriptor = z.infer<typeof stellarAssetSchema>;

export const paymentIntentSchema = z.object({
  id: z.string(),
  walletAddress: stellarWalletAddressSchema,
  productType: paymentProductTypeSchema,
  subscriptionScope: subscriptionScopeSchema.optional(),
  trackId: z.string().optional(),
  amount: nonNegativeAmountSchema,
  assetCode: stellarAssetCodeSchema,
  assetIssuer: optionalStellarAssetIssuerSchema,
  destinationAddress: stellarWalletAddressSchema,
  memo: z.string(),
  status: paymentIntentStatusSchema,
  txHash: z.string().optional(),
  expiresAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PaymentIntentRecord = z.infer<typeof paymentIntentSchema>;

export const paymentRecordSchema = z.object({
  id: z.string(),
  intentId: z.string(),
  walletAddress: stellarWalletAddressSchema,
  productType: paymentProductTypeSchema,
  subscriptionScope: subscriptionScopeSchema.optional(),
  trackId: z.string().optional(),
  txHash: z.string(),
  amount: nonNegativeAmountSchema,
  assetCode: stellarAssetCodeSchema,
  assetIssuer: optionalStellarAssetIssuerSchema,
  status: paymentStatusSchema,
  waived: z.boolean().optional(),
  confirmedAt: z.string(),
  createdAt: z.string(),
});
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;

export const subscriptionRecordSchema = z.object({
  id: z.string(),
  walletAddress: stellarWalletAddressSchema,
  scope: subscriptionScopeSchema.default("platform"),
  status: subscriptionStatusSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  paymentId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SubscriptionRecord = z.infer<typeof subscriptionRecordSchema>;

export const platformSubscriptionPlanSchema = z.object({
  enabled: z.boolean().default(false),
  name: z.string().default("Music City Pass"),
  description: z.string().default(
    "One subscription unlocks every subscriber-only release across Music City.",
  ),
  price: positiveAmountSchema,
  assetCode: stellarAssetCodeSchema,
  assetIssuer: optionalStellarAssetIssuerSchema,
  periodDays: z.number().int().positive(),
});
export type PlatformSubscriptionPlan = z.infer<typeof platformSubscriptionPlanSchema>;

export const createTrackPurchaseIntentSchema = z.object({
  trackId: z.string().min(1),
});
export type CreateTrackPurchaseIntentInput = z.infer<
  typeof createTrackPurchaseIntentSchema
>;

export const createPlatformSubscriptionIntentSchema = z.object({});
export type CreatePlatformSubscriptionIntentInput = z.infer<
  typeof createPlatformSubscriptionIntentSchema
>;

export const confirmPaymentSchema = z.object({
  intentId: z.string().min(1),
  txHash: z.string().min(1),
});
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
