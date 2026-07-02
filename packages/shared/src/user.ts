import { z } from "zod";

import { userRoleSchema } from "./auth.js";
import { stellarWalletAddressSchema } from "./commerce.js";

export const userProfileSchema = z.object({
  id: z.string(),
  walletAddress: stellarWalletAddressSchema,
  email: z.string().email().optional().or(z.literal("")),
  displayName: z.string().min(1),
  role: userRoleSchema,
  location: z.string().default(""),
  profileImageUrl: z.string().optional(),
  profileImageStorageKey: z.string().optional(),
  headerImageUrl: z.string().optional(),
  headerImageStorageKey: z.string().optional(),
  verified: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const upsertUserProfileSchema = z
  .object({
    email: z.string().email().optional().or(z.literal("")),
    displayName: z.string().min(1).max(80),
    role: userRoleSchema,
    location: z.string().max(120).optional(),
    profileImageStorageKey: z.string().max(300).optional(),
    headerImageStorageKey: z.string().max(300).optional(),
  });
export type UpsertUserProfileInput = z.infer<typeof upsertUserProfileSchema>;

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
  profileImageUrl: z.string().optional(),
  headerImageUrl: z.string().optional(),
  verified: z.boolean().default(false),
});
export type ArtistPublicProfile = z.infer<typeof artistPublicProfileSchema>;
