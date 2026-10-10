import { z } from "zod";

export const earlyUserSponsorshipTerms = {
  code: "EARLYUSER",
  revision: "v1",
  currency: "USD",
  originalAmountMinor: 2_000,
  discountAmountMinor: 2_000,
  amountDueMinor: 0,
  discountPercent: 100,
} as const;

export const artistActivationStatusSchema = z.enum([
  "eligible",
  "sponsored",
  "paid",
  "legacy_free",
  "payment_required",
]);

export const artistActivationQuoteSchema = z.object({
  currency: z.literal("USD"),
  originalAmountMinor: z.number().int().nonnegative(),
  discountAmountMinor: z.number().int().nonnegative(),
  discountPercent: z.number().int().min(0).max(100),
  amountDueMinor: z.number().int().nonnegative(),
  campaignCode: z.string().nullable(),
  termsRevision: z.string().nullable(),
  status: artistActivationStatusSchema,
  profileExists: z.boolean(),
  artistAccess: z.boolean(),
  activatedAt: z.string().nullable(),
});
export type ArtistActivationQuote = z.infer<typeof artistActivationQuoteSchema>;

export const sponsorshipCampaignStatusSchema = z.object({
  code: z.literal(earlyUserSponsorshipTerms.code),
  termsRevision: z.string(),
  currency: z.literal("USD"),
  originalAmountMinor: z.number().int().nonnegative(),
  discountAmountMinor: z.number().int().nonnegative(),
  amountDueMinor: z.number().int().nonnegative(),
  discountPercent: z.number().int().min(0).max(100),
  active: z.boolean(),
  eligibleAccounts: z.number().int().nonnegative(),
  activatedArtists: z.number().int().nonnegative(),
  pendingEligibility: z.number().int().nonnegative(),
  totalFeesWaivedMinor: z.number().int().nonnegative(),
});
export type SponsorshipCampaignStatus = z.infer<typeof sponsorshipCampaignStatusSchema>;

export const sponsorshipCampaignUpdateSchema = z.object({
  active: z.boolean(),
  reason: z.string().trim().min(5).max(500),
});
export type SponsorshipCampaignUpdate = z.infer<typeof sponsorshipCampaignUpdateSchema>;

export const sponsorshipAdminItemSchema = z.object({
  id: z.string(),
  walletAddress: z.string(),
  displayName: z.string(),
  capturedAt: z.string(),
  activatedAt: z.string().nullable(),
  status: z.enum(["eligible", "sponsored"]),
  inviterName: z.string().nullable(),
});
export type SponsorshipAdminItem = z.infer<typeof sponsorshipAdminItemSchema>;

export const sponsorshipAdminReportSchema = z.object({
  campaign: sponsorshipCampaignStatusSchema,
  items: z.array(sponsorshipAdminItemSchema),
  events: z.array(z.object({
    id: z.number().int(),
    action: z.string(),
    actor: z.string(),
    reason: z.string().nullable(),
    createdAt: z.string(),
  })),
});
export type SponsorshipAdminReport = z.infer<typeof sponsorshipAdminReportSchema>;
