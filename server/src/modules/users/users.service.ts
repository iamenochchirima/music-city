import {
  artistPublicProfileSchema,
  createUserMediaUploadSchema,
  upsertUserProfileSchema,
  type CreateUserMediaUploadInput,
  type UpsertUserProfileInput,
  type UserProfile,
} from "@music-city/shared";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { env } from "../../config/env.js";
import { createId } from "../../services/id.service.js";
import { storageService } from "../../services/storage.service.js";
import { HttpError } from "../../utils/http-error.js";
import { usersRepository } from "./users.repository.js";

const nowIso = () => new Date().toISOString();

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

const withMediaUrls = (profile: UserProfile | null) => {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    profileImageUrl: profile.profileImageStorageKey
      ? storageService.getDownloadUrl(profile.profileImageStorageKey)
      : profile.profileImageUrl,
    headerImageUrl: profile.headerImageStorageKey
      ? storageService.getDownloadUrl(profile.headerImageStorageKey)
      : profile.headerImageUrl,
  };
};

export const usersService = {
  async listAllProfiles() {
    return (await usersRepository.listAll()).map((profile) => withMediaUrls(profile)) as UserProfile[];
  },

  async getPublicArtistProfile(id: string) {
    const profile = await this.getProfileById(id);

    if (!profile || profile.role !== "artist") {
      return null;
    }

    return artistPublicProfileSchema.parse({
      id: profile.id,
      walletAddress: profile.walletAddress,
      displayName: profile.displayName,
      location: profile.location,
      profileImageUrl: profile.profileImageUrl,
      headerImageUrl: profile.headerImageUrl,
      verified: profile.verified,
    });
  },

  async getPublicArtistTracks(id: string) {
    const profile = await this.getProfileById(id);

    if (!profile || profile.role !== "artist") {
      return [];
    }

    const { tracksService } = await import("../tracks/tracks.service.js");
    return tracksService.listPublicTracksByArtist(id);
  },

  async getPublicArtistReleases(id: string) {
    const profile = await this.getProfileById(id);

    if (!profile || profile.role !== "artist") {
      return [];
    }

    const { releasesService } = await import("../releases/releases.service.js");
    return releasesService.listPublicReleasesByArtist(id);
  },

  async getProfileById(id: string) {
    return withMediaUrls(await usersRepository.findById(id));
  },

  async getProfile(walletAddress: string) {
    return withMediaUrls(await usersRepository.findByWallet(walletAddress));
  },

  async upsertProfile(walletAddress: string, input: UpsertUserProfileInput) {
    const parsed = upsertUserProfileSchema.parse(input);
    const existing = await usersRepository.findByWallet(walletAddress);
    const timestamp = nowIso();

    const profile: UserProfile = {
      id: existing?.id ?? createId("usr"),
      walletAddress,
      email: parsed.email ?? existing?.email ?? "",
      displayName: parsed.displayName,
      role: parsed.role,
      location: parsed.location ?? existing?.location ?? "",
      profileImageStorageKey:
        ensureOwnedProfileStorageKey(
          walletAddress,
          parsed.profileImageStorageKey,
        ) ?? existing?.profileImageStorageKey,
      headerImageStorageKey:
        ensureOwnedProfileStorageKey(
          walletAddress,
          parsed.headerImageStorageKey,
        ) ?? existing?.headerImageStorageKey,
      verified: existing?.verified ?? false,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    return withMediaUrls(await usersRepository.upsert(profile));
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

    return artists.map((artist) => ({
      id: artist.id,
      walletAddress: artist.walletAddress,
      name: artist.displayName,
      genre: "Independent",
      city: artist.location || "Remote",
      monthlyListeners: "0",
      verified: artist.verified,
    }));
  },
};
