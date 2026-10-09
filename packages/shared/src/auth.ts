import { z } from "zod";

import { stellarWalletAddressSchema } from "./commerce.js";

export const primaryIntentSchema = z.enum(["listener", "artist", "both"]);
export type PrimaryIntent = z.infer<typeof primaryIntentSchema>;

export const onboardingStatusSchema = z.enum([
  "required",
  "in_progress",
  "complete",
]);
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;

export const onboardingStepSchema = z.enum([
  "intent",
  "identity",
  "personalize",
  "artist_identity",
  "visuals",
  "complete",
]);
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

export const profileCompletionItemSchema = z.enum([
  "display_name",
  "email",
  "location",
  "genres",
  "favorites",
  "local_music",
  "notification_preferences",
  "bio",
  "social_links",
  "profile_image",
  "header_image",
]);
export type ProfileCompletionItem = z.infer<
  typeof profileCompletionItemSchema
>;

export const profileCompletionSchema = z.object({
  percentage: z.number().int().min(0).max(100),
  completed: z.array(profileCompletionItemSchema),
  missing: z.array(profileCompletionItemSchema),
  requiredComplete: z.boolean(),
});
export type ProfileCompletion = z.infer<typeof profileCompletionSchema>;

export const authSessionSchema = z.object({
  walletAddress: stellarWalletAddressSchema,
  email: z.string().email().optional().or(z.literal("")),
  // New accounts do not have a display name until the first onboarding screen
  // is submitted. The onboarding API enforces the non-empty requirement.
  displayName: z.string().max(80),
  primaryIntent: primaryIntentSchema,
  artistAccess: z.boolean().default(false),
  profileImageUrl: z.string().optional(),
  headerImageUrl: z.string().optional(),
  token: z.string().optional(),
  onboardingStatus: onboardingStatusSchema,
  onboardingStep: onboardingStepSchema,
  onboardingVersion: z.number().int().positive(),
  onboardingCompletedAt: z.string().optional(),
  profileCompletion: profileCompletionSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const challengeRequestSchema = z.object({
  account: stellarWalletAddressSchema,
});
export type ChallengeRequest = z.infer<typeof challengeRequestSchema>;

export const challengeResponseSchema = z.object({
  transaction: z.string(),
  networkPassphrase: z.string(),
});
export type ChallengeResponse = z.infer<typeof challengeResponseSchema>;

export const verifyChallengeSchema = z.object({
  transaction: z.string().min(1),
});
export type VerifyChallengeRequest = z.infer<typeof verifyChallengeSchema>;

export const dynamicSessionRequestSchema = z.object({
  walletAddress: stellarWalletAddressSchema.optional(),
});
export type DynamicSessionRequest = z.infer<typeof dynamicSessionRequestSchema>;
