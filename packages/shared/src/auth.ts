import { z } from "zod";

import { stellarWalletAddressSchema } from "./commerce.js";

export const userRoleSchema = z.enum(["artist", "fan"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const authSessionSchema = z.object({
  walletAddress: stellarWalletAddressSchema,
  email: z.string().email().optional().or(z.literal("")),
  displayName: z.string().min(1),
  role: userRoleSchema,
  artistOnboardingFeePaid: z.boolean().default(false),
  profileImageUrl: z.string().optional(),
  headerImageUrl: z.string().optional(),
  token: z.string().optional(),
  profileComplete: z.boolean().default(false),
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
