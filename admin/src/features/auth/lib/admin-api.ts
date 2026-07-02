import type {
  AdminAccount,
  AdminBootstrapStatus,
  AdminPlatformSubscriptionSettings,
  AdminSubscriptionList,
  AdminUserList,
  AdminTreasuryOverview,
  AdminTreasurySettings,
  AdminSession,
  AdminLoginInput,
  BootstrapAdminInput,
  CreateAdminInput,
  RoyaltyLedgerEntry,
  RoyaltyEngineConfig,
  TrackRoyaltySplitList,
  TrackRoyaltySplitRecord,
  TrackSummary,
  UpsertTrackRoyaltySplitInput,
} from "@music-city/shared";

import { httpClient } from "@/lib/api/http-client";

type AuthResponse = {
  admin: AdminAccount;
  session: AdminSession;
};

export const adminApi = {
  getBootstrapStatus() {
    return httpClient.get<AdminBootstrapStatus>("/auth/bootstrap-status");
  },

  bootstrap(input: BootstrapAdminInput) {
    return httpClient.post<AuthResponse>("/auth/bootstrap", input);
  },

  login(input: AdminLoginInput) {
    return httpClient.post<AuthResponse>("/auth/login", input);
  },

  getMe(token: string) {
    return httpClient.get<AuthResponse>("/auth/me", token);
  },

  listAdmins(token: string) {
    return httpClient
      .get<{ items: AdminAccount[] }>("/admins", token)
      .then((response) => response.items);
  },

  createAdmin(input: CreateAdminInput, token: string) {
    return httpClient
      .post<{ admin: AdminAccount }>("/admins", input, token)
      .then((response) => response.admin);
  },

  getPlatformSubscriptionSettings(token: string) {
    return httpClient
      .get<{ settings: AdminPlatformSubscriptionSettings }>(
        "/subscriptions/platform-plan",
        token,
      )
      .then((response) => response.settings);
  },

  updatePlatformSubscriptionSettings(
    input: AdminPlatformSubscriptionSettings,
    token: string,
  ) {
    return httpClient
      .put<{ settings: AdminPlatformSubscriptionSettings }>(
        "/subscriptions/platform-plan",
        input,
        token,
      )
      .then((response) => response.settings);
  },

  getTreasury(token: string) {
    return httpClient.get<AdminTreasuryOverview>("/treasury", token);
  },

  listSubscriptions(token: string) {
    return httpClient.get<AdminSubscriptionList>("/subscriptions", token);
  },

  listUsers(token: string) {
    return httpClient.get<AdminUserList>("/users", token);
  },

  listTracks(token: string) {
    return httpClient
      .get<{ items: TrackSummary[] }>("/tracks", token)
      .then((response) => response.items);
  },

  getRoyaltyConfig(token: string) {
    return httpClient
      .get<{ config: RoyaltyEngineConfig }>("/royalties/config", token)
      .then((response) => response.config);
  },

  listTrackRoyaltySplits(trackId: string, token: string) {
    return httpClient.get<TrackRoyaltySplitList>(
      `/royalties/tracks/${trackId}/splits`,
      token,
    );
  },

  listTrackRoyaltyLedger(trackId: string, token: string) {
    return httpClient
      .get<{ items: RoyaltyLedgerEntry[] }>(
        `/royalties/tracks/${trackId}/ledger`,
        token,
      )
      .then((response) => response.items);
  },

  updateTrackRoyaltySplits(
    trackId: string,
    input: UpsertTrackRoyaltySplitInput,
    token: string,
  ) {
    return httpClient
      .put<{ split: TrackRoyaltySplitRecord }>(
        `/royalties/tracks/${trackId}/splits`,
        input,
        token,
      )
      .then((response) => response.split);
  },

  updateTreasury(input: AdminTreasurySettings, token: string) {
    return httpClient.put<AdminTreasuryOverview>("/treasury", input, token);
  },
};
