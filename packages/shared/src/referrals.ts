import { z } from "zod";

export const registrationReferralCampaign = { version: "registration-v1", windowDays: 30, rewardsEnabled: false } as const;
export const referralCampaignSchema = z.object({
  version: z.literal(registrationReferralCampaign.version),
  windowDays: z.literal(registrationReferralCampaign.windowDays),
  rewardsEnabled: z.literal(false),
});

export const referralCodeSchema = z.string().trim().toUpperCase().regex(/^MC[A-F0-9]{16}$/);
export const referralCaptureSchema = z.object({ code: referralCodeSchema });
export const referralInvitationSchema = z.object({
  receipt: z.string(), inviterName: z.string(), expiresAt: z.string().datetime(), campaign: z.string(),
});
export type ReferralInvitation = z.infer<typeof referralInvitationSchema>;
export const referralProgressSchema = z.object({
  id: z.string(), label: z.string(), startedAt: z.string(), completedAt: z.string().nullable(),
  artistQualifiedAt: z.string().nullable(), excluded: z.boolean(),
});
export type ReferralProgress = z.infer<typeof referralProgressSchema>;
export const referralSummarySchema = z.object({
  enabled: z.boolean(), code: z.string().nullable(), campaign: z.string(), rewardsEnabled: z.literal(false),
  totals: z.object({ started: z.number(), completed: z.number(), artists: z.number() }),
  items: z.array(referralProgressSchema),
});
export type ReferralSummary = z.infer<typeof referralSummarySchema>;
export const referralExclusionSchema = z.object({ reason: z.string().trim().min(3).max(500) });
