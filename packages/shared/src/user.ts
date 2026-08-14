import { z } from "zod";

import {
  onboardingStatusSchema,
  onboardingStepSchema,
  primaryIntentSchema,
} from "./auth.js";
import { stellarWalletAddressSchema } from "./commerce.js";

export const notificationPreferencesSchema = z.object({
  releaseNotifications: z.boolean().default(true),
  artistUpdates: z.boolean().default(true),
  productUpdates: z.boolean().default(false),
});
export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;

export const socialLinksSchema = z.object({
  website: z.string().url().max(300).optional().or(z.literal("")),
  instagram: z.string().url().max(300).optional().or(z.literal("")),
  youtube: z.string().url().max(300).optional().or(z.literal("")),
  soundcloud: z.string().url().max(300).optional().or(z.literal("")),
  x: z.string().url().max(300).optional().or(z.literal("")),
});
export type SocialLinks = z.infer<typeof socialLinksSchema>;

export const MUSIC_GENRES = [
  "Afrobeats",
  "Alternative",
  "Hip-hop",
  "House",
  "Indie",
  "Jazz",
  "Pop",
  "R&B",
  "Rock",
  "Soul",
] as const;

export const musicGenreSchema = z.enum(MUSIC_GENRES);

export const userProfileSchema = z.object({
  id: z.string(),
  walletAddress: stellarWalletAddressSchema,
  email: z.string().email().optional().or(z.literal("")),
  displayName: z.string().trim().min(1).max(80),
  primaryIntent: primaryIntentSchema,
  artistAccess: z.boolean().default(false),
  onboardingStatus: onboardingStatusSchema,
  onboardingStep: onboardingStepSchema,
  onboardingVersion: z.number().int().positive(),
  onboardingCompletedAt: z.string().optional(),
  location: z.string().default(""),
  genres: z.array(z.string().min(1).max(80)).max(5).default([]),
  favoriteArtistIds: z.array(z.string().min(1)).max(5).default([]),
  interestedInLocalMusic: z.boolean().default(false),
  notificationPreferences: notificationPreferencesSchema,
  bio: z.string().max(1500).default(""),
  socialLinks: socialLinksSchema,
  hasReleasedMusic: z.boolean().optional(),
  profileImageUrl: z.string().optional(),
  profileImageStorageKey: z.string().optional(),
  headerImageUrl: z.string().optional(),
  headerImageStorageKey: z.string().optional(),
  verified: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const upsertUserProfileSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  displayName: z.string().trim().min(1).max(80).optional(),
  primaryIntent: primaryIntentSchema.optional(),
  location: z.string().max(120).optional(),
  genres: z.array(musicGenreSchema).max(5).optional(),
  favoriteArtistIds: z.array(z.string().min(1)).max(5).optional(),
  interestedInLocalMusic: z.boolean().optional(),
  notificationPreferences: notificationPreferencesSchema.partial().optional(),
  bio: z.string().max(1500).optional(),
  socialLinks: socialLinksSchema.partial().optional(),
  hasReleasedMusic: z.boolean().optional(),
  profileImageStorageKey: z.string().max(300).optional(),
  headerImageStorageKey: z.string().max(300).optional(),
  removeProfileImage: z.boolean().optional(),
  removeHeaderImage: z.boolean().optional(),
});
export type UpsertUserProfileInput = z.infer<typeof upsertUserProfileSchema>;

export const onboardingIntentStepSchema = z.object({
  step: z.literal("intent"),
  primaryIntent: primaryIntentSchema,
});

export const onboardingIdentityStepSchema = z.object({
  step: z.literal("identity"),
  displayName: z.string().trim().min(1).max(80),
  email: z.string().email().optional().or(z.literal("")),
  location: z.string().max(120).optional(),
});

export const onboardingPersonalizeStepSchema = z.object({
  step: z.literal("personalize"),
  genres: z.array(musicGenreSchema).max(5).default([]),
  favoriteArtistIds: z.array(z.string().min(1)).max(5).default([]),
  interestedInLocalMusic: z.boolean().default(false),
  notificationPreferences: notificationPreferencesSchema,
});

export const onboardingArtistIdentityStepSchema = z.object({
  step: z.literal("artist_identity"),
  bio: z.string().max(1500).default(""),
  genres: z.array(musicGenreSchema).max(5).default([]),
  socialLinks: socialLinksSchema,
  hasReleasedMusic: z.boolean().optional(),
});

export const onboardingVisualsStepSchema = z.object({
  step: z.literal("visuals"),
  profileImageStorageKey: z.string().max(300).optional(),
  headerImageStorageKey: z.string().max(300).optional(),
  removeProfileImage: z.boolean().default(false),
  removeHeaderImage: z.boolean().default(false),
});

export const saveOnboardingStepSchema = z.discriminatedUnion("step", [
  onboardingIntentStepSchema,
  onboardingIdentityStepSchema,
  onboardingPersonalizeStepSchema,
  onboardingArtistIdentityStepSchema,
  onboardingVisualsStepSchema,
]);
export type SaveOnboardingStepInput = z.infer<typeof saveOnboardingStepSchema>;

export const completeOnboardingSchema = z.object({
  step: z.literal("complete"),
});
export type CompleteOnboardingInput = z.infer<
  typeof completeOnboardingSchema
>;

export const createUserMediaUploadSchema = z.object({
  purpose: z.enum(["profile_image", "header_image"]),
  fileName: z.string().min(1).max(180),
  contentType: z.string().startsWith("image/").max(120),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
});
export type CreateUserMediaUploadInput = z.infer<
  typeof createUserMediaUploadSchema
>;

export interface UserMediaUploadTarget {
  storageKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
}

export const artistPublicProfileSchema = z.object({
  id: z.string(),
  walletAddress: stellarWalletAddressSchema,
  displayName: z.string().min(1),
  location: z.string().default(""),
  bio: z.string().default(""),
  genres: z.array(z.string()).default([]),
  socialLinks: socialLinksSchema,
  profileImageUrl: z.string().optional(),
  headerImageUrl: z.string().optional(),
  verified: z.boolean().default(false),
  followerCount: z.number().int().min(0).default(0),
});
export type ArtistPublicProfile = z.infer<typeof artistPublicProfileSchema>;
