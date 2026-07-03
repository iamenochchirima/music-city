import type {
  AdDecision,
  AdImpressionRecord,
  StartAdImpressionInput,
  UpdateAdImpressionInput,
} from "@music-city/shared";

import { httpClient } from "@/lib/api/http-client";
import { clientEnv } from "@/lib/config/env";

const resolveAssetUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return new URL(url, new URL(clientEnv.apiBaseUrl).origin).toString();
};

export const adsApi = {
  async getPlaybackDecision(token: string, trackId: string) {
    const response = await httpClient.get<AdDecision>(
      `/ads/playback-decision/${trackId}`,
      token,
    );

    if (!response.ad) {
      return response;
    }

    return {
      ...response,
      ad: {
        ...response.ad,
        audioUrl: resolveAssetUrl(response.ad.audioUrl),
      },
    };
  },

  async startImpression(token: string, input: StartAdImpressionInput) {
    return httpClient
      .post<{ impression: AdImpressionRecord }>("/ads/impressions", input, token)
      .then((response) => response.impression);
  },

  async updateImpression(
    token: string,
    impressionId: string,
    input: UpdateAdImpressionInput,
  ) {
    return httpClient
      .put<{ impression: AdImpressionRecord }>(
        `/ads/impressions/${impressionId}`,
        input,
        token,
      )
      .then((response) => response.impression);
  },
};
