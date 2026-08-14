import { z } from "zod";

import {
  optionalPositiveAmountSchema,
  optionalStellarAssetCodeSchema,
  optionalStellarAssetIssuerSchema,
  requireIssuerForNonNativeAsset,
  stellarWalletAddressSchema,
} from "./commerce.js";

export const trackStatusSchema = z.enum([
  "draft",
  "awaiting_upload",
  "uploaded",
  "processing",
  "published",
  "failed",
]);
export type TrackStatus = z.infer<typeof trackStatusSchema>;

export const trackVisibilitySchema = z.enum(["unpublished", "published"]);
export type TrackVisibility = z.infer<typeof trackVisibilitySchema>;

export const releaseTypeSchema = z.enum(["single", "ep", "album"]);
export type ReleaseType = z.infer<typeof releaseTypeSchema>;

export const releaseStatusSchema = z.enum([
  "draft",
  "scheduled",
  "published",
  "archived",
]);
export type ReleaseStatus = z.infer<typeof releaseStatusSchema>;

export const trackCreditRoleSchema = z.enum([
  "songwriter",
  "composer",
  "producer",
  "publisher",
  "lyricist",
  "remixer",
  "engineer",
]);
export type TrackCreditRole = z.infer<typeof trackCreditRoleSchema>;

export const trackCreditSchema = z.object({
  role: trackCreditRoleSchema,
  name: z.string().min(1).max(120),
  artistId: z.string().min(1).optional(),
});
export type TrackCredit = z.infer<typeof trackCreditSchema>;

const isValidIsrc = (value: string) =>
  /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(value.replaceAll("-", "").toUpperCase());

export const playlistVisibilitySchema = z.enum(["private", "public"]);
export type PlaylistVisibility = z.infer<typeof playlistVisibilitySchema>;

export interface ArtistSummary {
  id: string;
  walletAddress: z.infer<typeof stellarWalletAddressSchema>;
  name: string;
  genre: string;
  city: string;
  monthlyListeners: string;
  verified: boolean;
  followerCount?: number;
}

export interface TrackSummary {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  releaseId?: string;
  releaseTitle?: string;
  releaseArtistName?: string;
  trackNumber?: number;
  discNumber?: number;
  isFocusTrack?: boolean;
  featuredArtists?: string[];
  credits?: TrackCredit[];
  isrc?: string;
  isExplicit?: boolean;
  genre: string;
  runtime: string;
  priceLabel: string;
  status: TrackStatus;
  visibility?: TrackVisibility;
  plays: number;
  likes: number;
  description?: string;
  coverImageUrl?: string;
  coverStorageKey?: string;
  purchaseEnabled?: boolean;
  purchasePrice?: string;
  purchaseAssetCode?: string;
  purchaseAssetIssuer?: string;
  playbackUrl?: string;
  streamManifestUrl?: string;
  streamMediaUrl?: string;
  masterStorageKey?: string;
  streamManifestKey?: string;
  mediaProvider?: "local" | "mux";
  mediaStorageProvider?: "local" | "s3";
  sourceFileName?: string;
  sourceContentType?: string;
  sourceSizeBytes?: number;
  muxUploadId?: string;
  muxAssetId?: string;
  muxPlaybackId?: string;
  muxAssetStatus?: "waiting" | "asset_created" | "ready" | "errored";
  playbackReady?: boolean;
  archiveStatus?: "not_requested" | "pending" | "ready" | "failed";
  createdAt?: string;
  updatedAt?: string;
}

export const releaseTrackSchema = z.object({
  trackId: z.string().min(1),
  trackNumber: z.number().int().min(1),
  discNumber: z.number().int().min(1).default(1),
  isFocusTrack: z.boolean().default(false),
});
export type ReleaseTrack = z.infer<typeof releaseTrackSchema>;

export const releaseSummarySchema = z.object({
  id: z.string().min(1),
  artistId: z.string().min(1),
  artistName: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  type: releaseTypeSchema,
  status: releaseStatusSchema,
  genre: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
  coverImageUrl: z.string().url().optional(),
  coverStorageKey: z.string().optional(),
  recordLabel: z.string().max(120).optional(),
  releaseDate: z.string().optional(),
  publishedAt: z.string().optional(),
  trackCount: z.number().int().min(0).default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type ReleaseSummary = z.infer<typeof releaseSummarySchema>;

export const releaseDetailSchema = releaseSummarySchema.extend({
  tracks: z.array(releaseTrackSchema.extend({ track: z.custom<TrackSummary>() })),
});
export type ReleaseDetail = Omit<z.infer<typeof releaseDetailSchema>, "tracks"> & {
  tracks: Array<ReleaseTrack & { track: TrackSummary }>;
};

export const releaseCreateSchema = z.object({
  title: z.string().min(1).max(160),
  artistName: z.string().min(1).max(120).optional(),
  type: releaseTypeSchema,
  genre: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
  recordLabel: z.string().max(120).optional(),
  coverStorageKey: z.string().max(512).optional(),
  releaseDate: z.string().optional(),
});
export type ReleaseCreateInput = z.infer<typeof releaseCreateSchema>;

export const releaseUpdateSchema = releaseCreateSchema.partial().extend({
  status: releaseStatusSchema.optional(),
  publishedAt: z.string().optional(),
});
export type ReleaseUpdateInput = z.infer<typeof releaseUpdateSchema>;

export const releaseTrackAssignSchema = z.object({
  trackId: z.string().min(1),
  trackNumber: z.number().int().min(1).optional(),
  discNumber: z.number().int().min(1).default(1),
  isFocusTrack: z.boolean().default(false),
});
export type ReleaseTrackAssignInput = z.infer<typeof releaseTrackAssignSchema>;

export const releaseTrackReorderSchema = z.object({
  items: z.array(releaseTrackSchema).min(1),
});
export type ReleaseTrackReorderInput = z.infer<typeof releaseTrackReorderSchema>;

export const playlistTrackSchema = z.object({
  trackId: z.string().min(1),
  position: z.number().int().min(1),
});
export type PlaylistTrack = z.infer<typeof playlistTrackSchema>;

export const playlistSummarySchema = z.object({
  id: z.string().min(1),
  ownerUserId: z.string().min(1),
  ownerDisplayName: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional(),
  visibility: playlistVisibilitySchema,
  coverImageUrl: z.string().url().optional(),
  trackCount: z.number().int().min(0).default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type PlaylistSummary = z.infer<typeof playlistSummarySchema>;

export const playlistDetailSchema = playlistSummarySchema.extend({
  tracks: z.array(playlistTrackSchema.extend({ track: z.custom<TrackSummary>() })),
});
export type PlaylistDetail = Omit<z.infer<typeof playlistDetailSchema>, "tracks"> & {
  tracks: Array<PlaylistTrack & { track: TrackSummary }>;
};

export const playlistCreateSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional(),
  visibility: playlistVisibilitySchema.default("private"),
});
export type PlaylistCreateInput = z.infer<typeof playlistCreateSchema>;

export const playlistUpdateSchema = playlistCreateSchema.partial();
export type PlaylistUpdateInput = z.infer<typeof playlistUpdateSchema>;

export const playlistTrackAssignSchema = z.object({
  trackId: z.string().min(1),
  position: z.number().int().min(1).optional(),
});
export type PlaylistTrackAssignInput = z.infer<typeof playlistTrackAssignSchema>;

export const playlistTrackReorderSchema = z.object({
  items: z.array(playlistTrackSchema).min(1),
});
export type PlaylistTrackReorderInput = z.infer<typeof playlistTrackReorderSchema>;

export const trackCreateSchema = z.object({
  title: z.string().min(1).max(160),
  artistName: z.string().min(1).max(120).optional(),
  featuredArtists: z.array(z.string().min(1).max(120)).max(8).optional(),
  isrc: z.string().max(32).optional(),
  credits: z.array(trackCreditSchema).max(32).optional(),
  genre: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
  priceLabel: z.string().max(80).optional(),
  isExplicit: z.boolean().default(false),
  purchaseEnabled: z.boolean().optional(),
  purchasePrice: optionalPositiveAmountSchema,
  purchaseAssetCode: optionalStellarAssetCodeSchema,
  purchaseAssetIssuer: optionalStellarAssetIssuerSchema,
})
  .strict()
  .superRefine((value, context) => {
    if (value.isrc && !isValidIsrc(value.isrc)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["isrc"],
        message: "Enter a valid 12-character ISRC or leave this blank",
      });
    }

    const issue = requireIssuerForNonNativeAsset({
      assetCode: value.purchaseAssetCode,
      assetIssuer: value.purchaseAssetIssuer,
    });

    if (issue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["purchaseAssetIssuer"],
        message: issue.message,
      });
    }
  });
export type TrackCreateInput = z.infer<typeof trackCreateSchema>;

export const trackMetadataUpdateSchema = z
  .object({
    featuredArtists: z.array(z.string().min(1).max(120)).max(8).optional(),
    credits: z.array(trackCreditSchema).max(32).optional(),
    isrc: z.string().max(32).optional(),
    isExplicit: z.boolean().optional(),
    description: z.string().max(1000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.isrc) {
      return;
    }

    if (!isValidIsrc(value.isrc)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["isrc"],
        message: "Enter a valid 12-character ISRC or leave this blank",
      });
    }
  });
export type TrackMetadataUpdateInput = z.infer<
  typeof trackMetadataUpdateSchema
>;

export const trackMonetizationUpdateSchema = z
  .object({
    purchaseEnabled: z.boolean().optional(),
    purchasePrice: optionalPositiveAmountSchema,
    purchaseAssetCode: optionalStellarAssetCodeSchema,
    purchaseAssetIssuer: optionalStellarAssetIssuerSchema,
  })
  .superRefine((value, context) => {
    const purchaseEnabled = value.purchaseEnabled ?? false;

    if (purchaseEnabled && !value.purchasePrice) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["purchasePrice"],
        message: "Purchase price is required when track purchases are enabled",
      });
    }

    const issue = requireIssuerForNonNativeAsset({
      assetCode: value.purchaseAssetCode,
      assetIssuer: value.purchaseAssetIssuer,
    });

    if (issue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["purchaseAssetIssuer"],
        message: issue.message,
      });
    }
  });
export type TrackMonetizationUpdateInput = z.infer<
  typeof trackMonetizationUpdateSchema
>;
