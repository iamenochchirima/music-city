import type {
  ReleaseCreateInput,
  ReleaseDetail,
  ReleaseSummary,
  ReleaseTrackAssignInput,
  ReleaseTrackReorderInput,
  ReleaseUpdateInput,
} from "@music-city/shared";

import { httpClient } from "@/lib/api/http-client";

export const releasesApi = {
  async listReleases() {
    const response = await httpClient.get<{ items: ReleaseSummary[] }>("/releases");
    return response.items;
  },

  async listMyReleases(token: string) {
    const response = await httpClient.get<{ items: ReleaseSummary[] }>(
      "/releases/mine",
      token,
    );
    return response.items;
  },

  async getRelease(releaseId: string) {
    const response = await httpClient.get<{ release: ReleaseDetail | null }>(
      `/releases/${releaseId}`,
    );
    return response.release;
  },

  async getManageRelease(token: string, releaseId: string) {
    const response = await httpClient.get<{ release: ReleaseDetail | null }>(
      `/releases/${releaseId}/manage`,
      token,
    );
    return response.release;
  },

  async createRelease(token: string, input: ReleaseCreateInput) {
    const response = await httpClient.post<{ release: ReleaseDetail }>(
      "/releases",
      input,
      token,
    );
    return response.release;
  },

  async updateRelease(token: string, releaseId: string, input: ReleaseUpdateInput) {
    const response = await httpClient.put<{ release: ReleaseDetail }>(
      `/releases/${releaseId}`,
      input,
      token,
    );
    return response.release;
  },

  async addTrackToRelease(
    token: string,
    releaseId: string,
    input: ReleaseTrackAssignInput,
  ) {
    const response = await httpClient.post<{ release: ReleaseDetail }>(
      `/releases/${releaseId}/tracks`,
      input,
      token,
    );
    return response.release;
  },

  async reorderReleaseTracks(
    token: string,
    releaseId: string,
    input: ReleaseTrackReorderInput,
  ) {
    const response = await httpClient.put<{ release: ReleaseDetail }>(
      `/releases/${releaseId}/tracks/order`,
      input,
      token,
    );
    return response.release;
  },

  async removeTrackFromRelease(token: string, releaseId: string, trackId: string) {
    const response = await httpClient.delete(
      `/releases/${releaseId}/tracks/${trackId}`,
      token,
    );
    return response;
  },

  async deleteRelease(token: string, releaseId: string) {
    return httpClient.delete(`/releases/${releaseId}`, token);
  },
};
