import {
  artistPublicProfileSchema,
  completeOnboardingSchema,
  createUserMediaUploadSchema,
  profileCompletionSchema,
  saveOnboardingStepSchema,
  upsertUserProfileSchema,
  type OnboardingStep,
  type PrimaryIntent,
  type ProfileCompletion,
  type SaveOnboardingStepInput,
  type CreateUserMediaUploadInput,
  type CompleteOnboardingInput,
  type UpsertUserProfileInput,
  type UserProfile,
} from "@music-city/shared";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { env } from "../../config/env.js";
import { createId } from "../../services/id.service.js";
import { storageService } from "../../services/storage.service.js";
import { HttpError } from "../../utils/http-error.js";
import { paymentsRepository } from "../payments/payments.repository.js";
import { usersRepository } from "./users.repository.js";

const nowIso = () => new Date().toISOString();
const ONBOARDING_VERSION = 1;
const maxProfileImageBytes = 10 * 1024 * 1024;
const profileImageContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const isArtistIntent = (primaryIntent: PrimaryIntent) =>
  primaryIntent === "artist" || primaryIntent === "both";

const isListenerIntent = (primaryIntent: PrimaryIntent) =>
  primaryIntent === "listener" || primaryIntent === "both";

const nextStepFor = (
  primaryIntent: PrimaryIntent,
  step: OnboardingStep,
): OnboardingStep => {
  if (step === "intent") {
    return isListenerIntent(primaryIntent) ? "personalize" : "artist_identity";
  }

  if (step === "identity") {
    return "intent";
  }

  if (step === "personalize") {
    return isArtistIntent(primaryIntent) ? "artist_identity" : "visuals";
  }

  if (step === "artist_identity") {
    return "visuals";
  }

  if (step === "visuals") {
    return "complete";
  }

  return "complete";
};

const onboardingStepOrder: Record<OnboardingStep, number> = {
  identity: 0,
  intent: 1,
  personalize: 2,
  artist_identity: 3,
  visuals: 4,
  complete: 5,
};

const getProfileCompletion = (profile: UserProfile): ProfileCompletion => {
  const completed = new Set<ProfileCompletion["completed"][number]>();
  const relevantItems: ProfileCompletion["completed"][number][] = [
    "display_name",
    "email",
    "location",
    "genres",
    "profile_image",
  ];

  if (isListenerIntent(profile.primaryIntent)) {
    relevantItems.push(
      "favorites",
      "local_music",
      "notification_preferences",
    );
  }

  if (isArtistIntent(profile.primaryIntent)) {
    relevantItems.push("bio", "social_links", "header_image");
  }

  if (profile.displayName.trim()) completed.add("display_name");
  if (profile.email?.trim()) completed.add("email");
  if (profile.location.trim()) completed.add("location");
  if (profile.genres.length > 0) completed.add("genres");
  if (profile.favoriteArtistIds.length > 0) completed.add("favorites");
  if (profile.interestedInLocalMusic) completed.add("local_music");
  if (
    profile.notificationPreferences.releaseNotifications ||
    profile.notificationPreferences.artistUpdates ||
    profile.notificationPreferences.productUpdates
  ) {
    completed.add("notification_preferences");
  }
  if (profile.profileImageStorageKey || profile.profileImageUrl) {
    completed.add("profile_image");
  }
  if (profile.bio.trim()) completed.add("bio");
  if (Object.values(profile.socialLinks).some(Boolean)) {
    completed.add("social_links");
  }
  if (profile.headerImageStorageKey || profile.headerImageUrl) {
    completed.add("header_image");
  }

  const completedItems = relevantItems.filter((item) => completed.has(item));

  return profileCompletionSchema.parse({
    percentage: Math.round((completedItems.length / relevantItems.length) * 100),
    completed: completedItems,
    missing: relevantItems.filter((item) => !completed.has(item)),
    requiredComplete:
      Boolean(profile.displayName.trim()) && Boolean(profile.primaryIntent),
  });
};

const sanitizeFileName = (fileName: string) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, "-");

const profileStoragePrefix = (walletAddress: string) =>
  `profiles/${createHash("sha256").update(walletAddress).digest("hex").slice(0, 24)}`;

const ensureOwnedProfileStorageKey = (
  walletAddress: string,
  storageKey?: string,
) => {
  if (!storageKey) {
    return undefined;
  }

  const allowedPrefix = `${profileStoragePrefix(walletAddress)}/`;

  if (!storageKey.startsWith(allowedPrefix)) {
    throw new HttpError(400, "Profile media does not belong to this account");
  }

  return storageKey;
};

const ensureFavoriteArtistIds = async (favoriteArtistIds: string[]) => {
  if (favoriteArtistIds.length === 0) {
    return;
  }

  const artists = await usersRepository.listArtists();
  const artistIds = new Set(artists.map((artist) => artist.id));

  if (favoriteArtistIds.some((artistId) => !artistIds.has(artistId))) {
    throw new HttpError(400, "Choose artists from the Music City artist list");
  }
};

const withMediaUrls = (profile: UserProfile | null) => {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    genres: profile.genres ?? [],
    favoriteArtistIds: profile.favoriteArtistIds ?? [],
    interestedInLocalMusic: profile.interestedInLocalMusic ?? false,
    notificationPreferences: {
      releaseNotifications:
        profile.notificationPreferences?.releaseNotifications ?? true,
      artistUpdates: profile.notificationPreferences?.artistUpdates ?? true,
      productUpdates: profile.notificationPreferences?.productUpdates ?? false,
    },
    bio: profile.bio ?? "",
    socialLinks: {
      website: profile.socialLinks?.website ?? "",
      instagram: profile.socialLinks?.instagram ?? "",
      youtube: profile.socialLinks?.youtube ?? "",
      soundcloud: profile.socialLinks?.soundcloud ?? "",
      x: profile.socialLinks?.x ?? "",
    },
    profileImageUrl: profile.profileImageStorageKey
      ? storageService.getDownloadUrl(profile.profileImageStorageKey)
      : profile.profileImageUrl,
    headerImageUrl: profile.headerImageStorageKey
      ? storageService.getDownloadUrl(profile.headerImageStorageKey)
      : profile.headerImageUrl,
  };
};

const withoutEmailDerivedDisplayName = (profile: UserProfile | null) => {
  if (
    !profile ||
    profile.onboardingStatus === "complete" ||
    !profile.email?.trim() ||
    profile.displayName.trim().toLowerCase() !== profile.email.trim().toLowerCase()
  ) {
    return profile;
  }

  return {
    ...profile,
    displayName: "",
  };
};

const hasArtistOnboardingPayment = async (walletAddress: string) => {
  const payments = await paymentsRepository.listPaymentsByWallet(walletAddress);

  return payments.some(
    (payment) => payment.productType === "artist_onboarding_fee" && payment.status === "confirmed",
  );
};

const isArtistOnboardingFree = () =>
  Number(env.ARTIST_ONBOARDING_FEE_PRICE) === 0;

const ensureFreeArtistOnboardingRecord = async (walletAddress: string) => {
  if (!isArtistOnboardingFree()) {
    return;
  }

  const existing = await paymentsRepository.listPaymentsByWallet(walletAddress);
  if (
    existing.some(
      (payment) =>
        payment.productType === "artist_onboarding_fee" &&
        payment.status === "confirmed",
    )
  ) {
    return;
  }

  const timestamp = nowIso();
  const recordKey = createHash("sha256")
    .update(walletAddress)
    .digest("hex")
    .slice(0, 24);
  const intentId = `payi_waived_${recordKey}`;
  const paymentId = `pay_waived_${recordKey}`;
  const waivedTxHash = `waived:artist-onboarding:${recordKey}`;

  await paymentsRepository.upsertIntent({
    id: intentId,
    walletAddress,
    productType: "artist_onboarding_fee",
    amount: "0",
    assetCode: "XLM",
    destinationAddress: walletAddress,
    memo: `artist_onboarding_fee:waived:${recordKey}`,
    status: "confirmed",
    txHash: waivedTxHash,
    expiresAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await paymentsRepository.upsertPayment({
    id: paymentId,
    intentId,
    walletAddress,
    productType: "artist_onboarding_fee",
    txHash: waivedTxHash,
    amount: "0",
    assetCode: "XLM",
    status: "confirmed",
    waived: true,
    confirmedAt: timestamp,
    createdAt: timestamp,
  });
};

const getArtistOnboardingAccess = async (walletAddress: string) => {
  if (isArtistOnboardingFree()) {
    await ensureFreeArtistOnboardingRecord(walletAddress);
    return true;
  }

  return hasArtistOnboardingPayment(walletAddress);
};

const withArtistAccess = async (profile: UserProfile | null) => {
  const hydrated = withMediaUrls(profile);

  if (!hydrated) {
    return null;
  }

  return {
    ...hydrated,
    artistAccess: isArtistIntent(hydrated.primaryIntent)
      ? await getArtistOnboardingAccess(hydrated.walletAddress)
      : false,
  };
};

export const usersService = {
  async listAllProfiles() {
    const profiles = await usersRepository.listAll();

    return Promise.all(
      profiles.map((profile) => withArtistAccess(profile)),
    ) as Promise<UserProfile[]>;
  },

  async getPublicArtistProfile(id: string) {
    const profile = await this.getProfileById(id);

    if (!profile || !isArtistIntent(profile.primaryIntent)) {
      return null;
    }

    const { engagementRepository } = await import(
      "../engagement/engagement.repository.js"
    );

    return artistPublicProfileSchema.parse({
      id: profile.id,
      walletAddress: profile.walletAddress,
      displayName: profile.displayName,
      location: profile.location,
      bio: profile.bio,
      genres: profile.genres,
      socialLinks: profile.socialLinks,
      profileImageUrl: profile.profileImageUrl,
      headerImageUrl: profile.headerImageUrl,
      verified: profile.verified,
      followerCount: await engagementRepository.countArtistFollowers(profile.id),
    });
  },

  async getPublicArtistTracks(id: string) {
    const profile = await this.getProfileById(id);

    if (!profile || !isArtistIntent(profile.primaryIntent)) {
      return [];
    }

    const { tracksService } = await import("../tracks/tracks.service.js");
    return tracksService.listPublicTracksByArtist(id);
  },

  async getPublicArtistReleases(id: string) {
    const profile = await this.getProfileById(id);

    if (!profile || !isArtistIntent(profile.primaryIntent)) {
      return [];
    }

    const { releasesService } = await import("../releases/releases.service.js");
    return releasesService.listPublicReleasesByArtist(id);
  },

  async getProfileById(id: string) {
    return withArtistAccess(await usersRepository.findById(id));
  },

  async getProfile(walletAddress: string) {
    return withArtistAccess(
      withoutEmailDerivedDisplayName(await usersRepository.findByWallet(walletAddress)),
    );
  },

  async hasArtistOnboardingAccess(walletAddress: string) {
    return getArtistOnboardingAccess(walletAddress);
  },

  async getOnboardingState(walletAddress: string) {
    const profile = await this.getProfile(walletAddress);

    if (!profile) {
      return null;
    }

    return {
      profile,
      primaryIntent: profile.primaryIntent,
      artistAccess: profile.artistAccess,
      onboardingStatus: profile.onboardingStatus,
      onboardingStep: profile.onboardingStep,
      onboardingVersion: profile.onboardingVersion,
      onboardingCompletedAt: profile.onboardingCompletedAt,
      profileCompletion: getProfileCompletion(profile),
    };
  },

  async saveOnboardingStep(
    walletAddress: string,
    input: SaveOnboardingStepInput,
  ) {
    const parsed = saveOnboardingStepSchema.parse(input);
    const existing = await usersRepository.findByWallet(walletAddress);

    if (!existing && parsed.step !== "identity") {
      throw new HttpError(400, "Complete your welcome details first");
    }

    const timestamp = nowIso();
    const nextProfile: UserProfile = existing
      ? {
          ...existing,
          onboardingStatus:
            existing.onboardingStatus === "complete" ? "complete" : "in_progress",
          onboardingStep: parsed.step,
          onboardingVersion: ONBOARDING_VERSION,
          updatedAt: timestamp,
        }
      : {
          id: createId("usr"),
          walletAddress,
          email: "",
          displayName: parsed.step === "identity" ? parsed.displayName.trim() : "",
          primaryIntent: "listener",
          artistAccess: false,
          onboardingStatus: "in_progress",
          onboardingStep: "intent",
          onboardingVersion: ONBOARDING_VERSION,
          location: "",
          genres: [],
          favoriteArtistIds: [],
          interestedInLocalMusic: false,
          notificationPreferences: {
            releaseNotifications: true,
            artistUpdates: true,
            productUpdates: false,
          },
          bio: "",
          socialLinks: {
            website: "",
            instagram: "",
            youtube: "",
            soundcloud: "",
            x: "",
          },
          profileImageUrl: undefined,
          profileImageStorageKey: undefined,
          headerImageUrl: undefined,
          headerImageStorageKey: undefined,
          verified: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

    switch (parsed.step) {
      case "intent":
        nextProfile.primaryIntent = parsed.primaryIntent;
        nextProfile.artistAccess = isArtistIntent(parsed.primaryIntent)
          ? await getArtistOnboardingAccess(walletAddress)
          : false;
        nextProfile.onboardingStep = nextStepFor(parsed.primaryIntent, parsed.step);
        break;
      case "identity":
        nextProfile.displayName = parsed.displayName.trim();
        nextProfile.email = parsed.email ?? "";
        nextProfile.location = parsed.location?.trim() ?? "";
        nextProfile.onboardingStep = "intent";
        break;
      case "personalize":
        if (!isListenerIntent(nextProfile.primaryIntent)) {
          throw new HttpError(400, "Listener personalization is not available for this account");
        }
        await ensureFavoriteArtistIds(parsed.favoriteArtistIds);
        nextProfile.genres = parsed.genres;
        nextProfile.favoriteArtistIds = parsed.favoriteArtistIds;
        nextProfile.interestedInLocalMusic = parsed.interestedInLocalMusic;
        nextProfile.notificationPreferences = parsed.notificationPreferences;
        nextProfile.onboardingStep = nextStepFor(
          nextProfile.primaryIntent,
          parsed.step,
        );
        break;
      case "artist_identity":
        if (!isArtistIntent(nextProfile.primaryIntent)) {
          throw new HttpError(400, "Artist personalization is not available for this account");
        }
        nextProfile.bio = parsed.bio;
        nextProfile.genres = parsed.genres;
        nextProfile.socialLinks = parsed.socialLinks;
        nextProfile.hasReleasedMusic = parsed.hasReleasedMusic;
        nextProfile.onboardingStep = nextStepFor(
          nextProfile.primaryIntent,
          parsed.step,
        );
        break;
      case "visuals":
        if (parsed.removeProfileImage) {
          if (nextProfile.profileImageStorageKey) {
            await storageService.deleteObject(nextProfile.profileImageStorageKey);
          }
          nextProfile.profileImageStorageKey = undefined;
          nextProfile.profileImageUrl = undefined;
        } else {
          nextProfile.profileImageStorageKey = ensureOwnedProfileStorageKey(
            walletAddress,
            parsed.profileImageStorageKey,
          ) ?? nextProfile.profileImageStorageKey;
        }
        if (parsed.removeHeaderImage) {
          if (nextProfile.headerImageStorageKey) {
            await storageService.deleteObject(nextProfile.headerImageStorageKey);
          }
          nextProfile.headerImageStorageKey = undefined;
          nextProfile.headerImageUrl = undefined;
        } else {
          nextProfile.headerImageStorageKey = ensureOwnedProfileStorageKey(
            walletAddress,
            parsed.headerImageStorageKey,
          ) ?? nextProfile.headerImageStorageKey;
        }
        nextProfile.onboardingStep = "complete";
        break;
    }

    if (existing?.onboardingStatus === "complete") {
      nextProfile.onboardingStatus = "complete";
      nextProfile.onboardingStep = "complete";
    } else if (
      parsed.step !== "intent" &&
      onboardingStepOrder[nextProfile.onboardingStep] <
        onboardingStepOrder[existing?.onboardingStep ?? "intent"]
    ) {
      nextProfile.onboardingStep = existing?.onboardingStep ?? nextProfile.onboardingStep;
    }

    return withArtistAccess(await usersRepository.upsert(nextProfile));
  },

  async completeOnboarding(
    walletAddress: string,
    input: CompleteOnboardingInput = { step: "complete" },
  ) {
    completeOnboardingSchema.parse(input);
    const existing = await usersRepository.findByWallet(walletAddress);

    if (!existing) {
      throw new HttpError(404, "Profile not found");
    }

    if (!existing.displayName.trim() || !existing.primaryIntent) {
      throw new HttpError(400, "Add your display name and choose how you will use Music City");
    }

    const completed: UserProfile = {
      ...existing,
      onboardingStatus: "complete",
      onboardingStep: "complete",
      onboardingVersion: ONBOARDING_VERSION,
      onboardingCompletedAt: existing.onboardingCompletedAt ?? nowIso(),
      updatedAt: nowIso(),
    };

    return withArtistAccess(await usersRepository.upsert(completed));
  },

  async requireArtistOnboardingAccess(
    walletAddress: string,
    missingProfileMessage: string,
    missingFeeMessage = "Pay the onboarding fee before accessing artist tools",
  ) {
    const profile = await this.getProfile(walletAddress);

    if (!profile) {
      throw new Error(missingProfileMessage);
    }

    if (!isArtistIntent(profile.primaryIntent)) {
      throw new Error(missingFeeMessage);
    }

    if (!profile.artistAccess) {
      throw new HttpError(402, missingFeeMessage);
    }

    return profile;
  },

  async upsertProfile(walletAddress: string, input: UpsertUserProfileInput) {
    const parsed = upsertUserProfileSchema.parse(input);
    const existing = await usersRepository.findByWallet(walletAddress);
    const timestamp = nowIso();

    if (!existing) {
      throw new HttpError(404, "Profile not found");
    }

    const nextPrimaryIntent = parsed.primaryIntent ?? existing.primaryIntent;
    if (parsed.favoriteArtistIds) {
      await ensureFavoriteArtistIds(parsed.favoriteArtistIds);
    }
    if (parsed.hasReleasedMusic !== undefined && !isArtistIntent(nextPrimaryIntent)) {
      throw new HttpError(400, "Release history is only available for artist accounts");
    }
    if (parsed.removeProfileImage && existing.profileImageStorageKey) {
      await storageService.deleteObject(existing.profileImageStorageKey);
    }
    if (parsed.removeHeaderImage && existing.headerImageStorageKey) {
      await storageService.deleteObject(existing.headerImageStorageKey);
    }

    const profile: UserProfile = {
      ...existing,
      walletAddress,
      email: parsed.email ?? existing.email,
      displayName: parsed.displayName ?? existing.displayName,
      primaryIntent: nextPrimaryIntent,
      location: parsed.location ?? existing.location,
      genres: parsed.genres ?? existing.genres,
      favoriteArtistIds: parsed.favoriteArtistIds ?? existing.favoriteArtistIds,
      interestedInLocalMusic:
        parsed.interestedInLocalMusic ?? existing.interestedInLocalMusic,
      notificationPreferences: {
        ...existing.notificationPreferences,
        ...parsed.notificationPreferences,
      },
      bio: parsed.bio ?? existing.bio,
      socialLinks: {
        ...existing.socialLinks,
        ...parsed.socialLinks,
      },
      hasReleasedMusic: parsed.hasReleasedMusic ?? existing.hasReleasedMusic,
      profileImageUrl: parsed.removeProfileImage
        ? undefined
        : existing.profileImageUrl,
      headerImageUrl: parsed.removeHeaderImage
        ? undefined
        : existing.headerImageUrl,
      profileImageStorageKey:
        parsed.removeProfileImage
          ? undefined
          : ensureOwnedProfileStorageKey(
              walletAddress,
              parsed.profileImageStorageKey,
            ) ?? existing.profileImageStorageKey,
      headerImageStorageKey:
        parsed.removeHeaderImage
          ? undefined
          : ensureOwnedProfileStorageKey(
              walletAddress,
              parsed.headerImageStorageKey,
            ) ?? existing.headerImageStorageKey,
      createdAt: existing.createdAt,
      updatedAt: timestamp,
    };

    return withArtistAccess(await usersRepository.upsert(profile));
  },

  createMediaUploadTarget(
    walletAddress: string,
    input: CreateUserMediaUploadInput,
  ) {
    const parsed = createUserMediaUploadSchema.parse(input);
    const id = createId("upl");
    const storageFolder =
      parsed.purpose === "profile_image" ? "profile-images" : "header-images";
    const storageKey = `${profileStoragePrefix(walletAddress)}/${storageFolder}/${id}-${sanitizeFileName(
      parsed.fileName,
    )}`;

    return {
      storageKey,
      uploadUrl: `${env.APP_BASE_URL}/api/v1/users/me/media/${encodeURIComponent(
        storageKey,
      )}`,
      method: "PUT" as const,
      headers: parsed.contentType
        ? {
            "Content-Type": parsed.contentType,
          }
        : {},
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  },

  async uploadMedia(
    walletAddress: string,
    storageKey: string,
    body: Buffer,
    contentType?: string,
  ) {
    ensureOwnedProfileStorageKey(walletAddress, storageKey);

    if (!contentType || !profileImageContentTypes.has(contentType)) {
      throw new HttpError(400, "Profile media must be a JPG, PNG, or WebP image");
    }

    if (body.length > maxProfileImageBytes) {
      throw new HttpError(400, "Profile media must be 10MB or smaller");
    }

    if (storageService.createUploadTarget(storageKey).provider === "local") {
      await storageService.saveLocalObject(
        storageKey,
        Readable.from(body) as unknown as NodeJS.ReadableStream,
      );
      return;
    }

    const target = storageService.createUploadTarget(storageKey);
    await storageService.uploadRemoteObject(
      target.uploadUrl,
      target.method,
      body,
      contentType ? { "Content-Type": contentType } : undefined,
    );
  },

  async listArtists() {
    const artists = await usersRepository.listArtists();
    const { engagementRepository } = await import(
      "../engagement/engagement.repository.js"
    );

    return Promise.all(
      artists.map(async (artist) => ({
        id: artist.id,
        walletAddress: artist.walletAddress,
        name: artist.displayName,
        genre: "Independent",
        city: artist.location || "Remote",
        monthlyListeners: "0",
        verified: artist.verified,
        followerCount: await engagementRepository.countArtistFollowers(artist.id),
      })),
    );
  },
};
