import type {
  ArtistSummary,
  ArtistPublicProfile,
  CreateUserMediaUploadInput,
  ReleaseSummary,
  TrackSummary,
  UpsertUserProfileInput,
  UserMediaUploadTarget,
  UserProfile,
} from "@music-city/shared";

import { httpClient } from "@/lib/api/http-client";

export const usersApi = {
  async getMe(token: string) {
    const response = await httpClient.get<{ profile: UserProfile | null }>(
      "/users/me",
      token,
    );

    return response.profile;
  },

  async saveMe(token: string, input: UpsertUserProfileInput) {
    const response = await httpClient.put<{ profile: UserProfile }>(
      "/users/me",
      input,
      token,
    );

    return response.profile;
  },

  async createMediaUploadTarget(
    token: string,
    input: CreateUserMediaUploadInput,
  ) {
    const response = await httpClient.post<{
      uploadTarget: UserMediaUploadTarget;
    }>("/users/me/media-upload-targets", input, token);

    return response.uploadTarget;
  },

  async uploadMedia(
    token: string,
    uploadTarget: UserMediaUploadTarget,
    file: File,
  ) {
    const response = await fetch(uploadTarget.uploadUrl, {
      method: uploadTarget.method,
      headers: {
        ...uploadTarget.headers,
        Authorization: `Bearer ${token}`,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error("Profile image upload failed");
    }
  },

  async listArtists() {
    const response = await httpClient.get<{ items: ArtistSummary[] }>(
      "/users/artists",
    );

    return response.items;
  },

  async getArtistProfile(artistId: string) {
    const response = await httpClient.get<{ profile: ArtistPublicProfile | null }>(
      `/users/artists/${artistId}`,
    );

    return response.profile;
  },

  async getArtistTracks(artistId: string) {
    const response = await httpClient.get<{ items: TrackSummary[] }>(
      `/users/artists/${artistId}/tracks`,
    );

    return response.items;
  },

  async getArtistReleases(artistId: string) {
    const response = await httpClient.get<{ items: ReleaseSummary[] }>(
      `/users/artists/${artistId}/releases`,
    );

    return response.items;
  },
};
