import { z } from "zod";

import {
  optionalStellarAssetIssuerSchema,
  positiveAmountSchema,
  stellarAssetCodeSchema,
  stellarWalletAddressSchema,
} from "./commerce.js";
import {
  subscriptionScopeSchema,
  subscriptionStatusSchema,
} from "./payments.js";
import { primaryIntentSchema } from "./auth.js";
import type { TrackSummary } from "./music.js";
import { walletAccountSchema } from "./wallet.js";

export const adminRoleSchema = z.enum(["super_admin", "admin"]);
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const adminSessionSchema = z.object({
  adminId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: adminRoleSchema,
  token: z.string().optional(),
});
export type AdminSession = z.infer<typeof adminSessionSchema>;

export const adminAccountSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: adminRoleSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminAccount = z.infer<typeof adminAccountSchema>;

export const bootstrapAdminInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
});
export type BootstrapAdminInput = z.infer<typeof bootstrapAdminInputSchema>;

export const adminLoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});
export type AdminLoginInput = z.infer<typeof adminLoginInputSchema>;

export const createAdminInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
  role: adminRoleSchema.default("admin"),
});
export type CreateAdminInput = z.infer<typeof createAdminInputSchema>;

export const adminBootstrapStatusSchema = z.object({
  bootstrapRequired: z.boolean(),
});
export type AdminBootstrapStatus = z.infer<typeof adminBootstrapStatusSchema>;

export const adminPlatformSubscriptionSettingsSchema = z.object({
  enabled: z.boolean(),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(300),
  price: positiveAmountSchema,
  assetCode: z.string().trim().toUpperCase().min(1).max(12),
  assetIssuer: z.string().trim().max(80).optional().or(z.literal("")),
  periodDays: z.number().int().positive().max(3650),
});
export type AdminPlatformSubscriptionSettings = z.infer<
  typeof adminPlatformSubscriptionSettingsSchema
>;

export const adminTreasurySettingsSchema = z.object({
  walletAddress: stellarWalletAddressSchema.or(z.literal("")),
});
export type AdminTreasurySettings = z.infer<typeof adminTreasurySettingsSchema>;

export const adminTreasuryOverviewSchema = z.object({
  settings: adminTreasurySettingsSchema,
  account: walletAccountSchema.nullable(),
});
export type AdminTreasuryOverview = z.infer<typeof adminTreasuryOverviewSchema>;

export const adminTreasuryTransferInputSchema = z
  .object({
    recipientWalletAddress: stellarWalletAddressSchema,
    amount: positiveAmountSchema,
    assetCode: stellarAssetCodeSchema.default("XLM"),
    assetIssuer: optionalStellarAssetIssuerSchema,
    memoText: z
      .string()
      .max(28)
      .optional()
      .transform((value) => {
        const normalized = value?.trim();
        return normalized ? normalized : undefined;
      }),
  })
  .superRefine((value, context) => {
    if (value.assetCode !== "XLM" && !value.assetIssuer) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assetIssuer"],
        message: "A non-native Stellar asset requires an issuer address",
      });
    }
  });
export type AdminTreasuryTransferInput = z.infer<
  typeof adminTreasuryTransferInputSchema
>;

export const adminTreasuryTransferResultSchema = z.object({
  txHash: z.string().min(1),
  recipientWalletAddress: stellarWalletAddressSchema,
  amount: positiveAmountSchema,
  assetCode: stellarAssetCodeSchema,
  assetIssuer: optionalStellarAssetIssuerSchema,
  treasuryWalletAddress: stellarWalletAddressSchema,
  memoText: z.string().optional(),
  submittedAt: z.string(),
});
export type AdminTreasuryTransferResult = z.infer<
  typeof adminTreasuryTransferResultSchema
>;

export const adminSubscriptionRecordSchema = z.object({
  id: z.string().min(1),
  walletAddress: stellarWalletAddressSchema,
  scope: subscriptionScopeSchema,
  status: subscriptionStatusSchema,
  paymentId: z.string().min(1),
  amount: positiveAmountSchema.optional(),
  assetCode: stellarAssetCodeSchema.optional(),
  assetIssuer: optionalStellarAssetIssuerSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  confirmedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminSubscriptionRecord = z.infer<
  typeof adminSubscriptionRecordSchema
>;

export const adminSubscriptionSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  platform: z.number().int().nonnegative(),
});
export type AdminSubscriptionSummary = z.infer<
  typeof adminSubscriptionSummarySchema
>;

export const adminSubscriptionListSchema = z.object({
  summary: adminSubscriptionSummarySchema,
  items: z.array(adminSubscriptionRecordSchema),
});
export type AdminSubscriptionList = z.infer<typeof adminSubscriptionListSchema>;

export const adminUserSubscriptionStatusSchema = z.enum([
  "subscribed",
  "unsubscribed",
]);
export type AdminUserSubscriptionStatus = z.infer<
  typeof adminUserSubscriptionStatusSchema
>;

export const adminUserRecordSchema = z.object({
  id: z.string().min(1),
  walletAddress: stellarWalletAddressSchema,
  email: z.string().email().optional().or(z.literal("")),
  displayName: z.string().min(1),
  primaryIntent: primaryIntentSchema,
  location: z.string().default(""),
  subscriptionStatus: adminUserSubscriptionStatusSchema,
  activeSubscriptionCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminUserRecord = z.infer<typeof adminUserRecordSchema>;

export const adminUserSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  subscribed: z.number().int().nonnegative(),
  unsubscribed: z.number().int().nonnegative(),
  artists: z.number().int().nonnegative(),
  listeners: z.number().int().nonnegative(),
});
export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;

export const adminUserListSchema = z.object({
  summary: adminUserSummarySchema,
  items: z.array(adminUserRecordSchema),
});
export type AdminUserList = z.infer<typeof adminUserListSchema>;

export interface AdminTrackList {
  items: TrackSummary[];
}

export const adminAnalyticsTopArtistSchema = z.object({
  artistId: z.string().min(1),
  artistName: z.string().min(1),
  streams: z.number().int().min(0),
});
export type AdminAnalyticsTopArtist = z.infer<
  typeof adminAnalyticsTopArtistSchema
>;

export const adminAnalyticsTopTrackSchema = z.object({
  trackId: z.string().min(1),
  title: z.string().min(1),
  artistName: z.string().min(1),
  streams: z.number().int().min(0),
});
export type AdminAnalyticsTopTrack = z.infer<typeof adminAnalyticsTopTrackSchema>;

export const adminAnalyticsTopReleaseSchema = z.object({
  releaseId: z.string().min(1),
  title: z.string().min(1),
  artistName: z.string().min(1),
  streams: z.number().int().min(0),
});
export type AdminAnalyticsTopRelease = z.infer<
  typeof adminAnalyticsTopReleaseSchema
>;

export const adminAnalyticsOverviewSchema = z.object({
  selectedWindowDays: z.number().int().positive().nullable(),
  totalStreams: z.number().int().min(0),
  activeListeners: z.number().int().min(0),
  releaseViews: z.number().int().min(0),
  newFollows: z.number().int().min(0),
  totalArtists: z.number().int().min(0),
  totalTracks: z.number().int().min(0),
  topArtists: z.array(adminAnalyticsTopArtistSchema),
  topTracks: z.array(adminAnalyticsTopTrackSchema),
  topReleases: z.array(adminAnalyticsTopReleaseSchema),
});
export type AdminAnalyticsOverview = z.infer<
  typeof adminAnalyticsOverviewSchema
>;
