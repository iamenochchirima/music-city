import type {
  AuthSession,
  ChallengeResponse,
  DynamicSessionRequest,
  VerifyChallengeRequest,
} from "@music-city/shared";

import { httpClient } from "@/lib/api/http-client";

export const authApi = {
  requestChallenge(account: string) {
    return httpClient.get<ChallengeResponse>(
      `/auth/challenge?account=${encodeURIComponent(account)}`,
    );
  },

  async verifyChallenge(payload: VerifyChallengeRequest) {
    const response = await httpClient.post<{ session: AuthSession }>(
      "/auth/verify",
      payload,
    );

    return response.session;
  },

  async createDynamicSession(payload: DynamicSessionRequest, token: string) {
    const response = await httpClient.post<{ session: AuthSession }>(
      "/auth/dynamic/session",
      payload,
      token,
    );

    return response.session;
  },
};
