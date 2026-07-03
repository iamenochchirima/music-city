import type {
  AdImpressionRecord,
  AdImpressionStatus,
  AdRecord,
  AdminAdListItem,
  AdminAccount,
  AdminAnalyticsOverview,
  AdminBootstrapStatus,
  ReconcileRoyaltyPayoutsInput,
  AdminPlatformSubscriptionSettings,
  ApproveRoyaltyLedgerEntriesInput,
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
  RoyaltyFeeSettings,
  RoyaltyPayoutReconciliationResult,
  RoyaltyPayoutSettings,
  TrackRoyaltySplitList,
  TrackRoyaltySplitRecord,
  RoyaltyPayoutExecutionResult,
  RoyaltyPayoutRecord,
  RunRoyaltyPayoutsInput,
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

  getAnalyticsOverview(token: string, windowDays?: 7 | 30 | 90) {
    return httpClient.get<AdminAnalyticsOverview>(
      `/analytics/overview${windowDays ? `?windowDays=${windowDays}` : ""}`,
      token,
    );
  },

  listAds(token: string) {
    return httpClient
      .get<{ items: AdminAdListItem[] }>("/ads", token)
      .then((response) => response.items);
  },

  createAd(input: Omit<AdRecord, "id" | "createdAt" | "updatedAt">, token: string) {
    return httpClient
      .post<{ ad: AdRecord }>("/ads", input, token)
      .then((response) => response.ad);
  },

  updateAd(
    adId: string,
    input: Partial<Omit<AdRecord, "id" | "createdAt" | "updatedAt">>,
    token: string,
  ) {
    return httpClient
      .put<{ ad: AdRecord }>(`/ads/${adId}`, input, token)
      .then((response) => response.ad);
  },

  archiveAd(adId: string, token: string) {
    return httpClient
      .delete<{ ad: AdRecord }>(`/ads/${adId}`, token)
      .then((response) => response.ad);
  },

  listAdImpressions(
    token: string,
    input?: {
      adId?: string;
      status?: AdImpressionStatus;
    },
  ) {
    const query = new URLSearchParams();

    if (input?.adId) {
      query.set("adId", input.adId);
    }

    if (input?.status) {
      query.set("status", input.status);
    }

    return httpClient
      .get<{ items: AdImpressionRecord[] }>(
        `/ads/impressions${query.size > 0 ? `?${query.toString()}` : ""}`,
        token,
      )
      .then((response) => response.items);
  },

  getRoyaltyConfig(token: string) {
    return httpClient
      .get<{ config: RoyaltyEngineConfig }>("/royalties/config", token)
      .then((response) => response.config);
  },

  getRoyaltyPayoutSettings(token: string) {
    return httpClient
      .get<{ settings: RoyaltyPayoutSettings }>("/royalties/payout-settings", token)
      .then((response) => response.settings);
  },

  updateRoyaltyPayoutSettings(input: RoyaltyPayoutSettings, token: string) {
    return httpClient
      .put<{ settings: RoyaltyPayoutSettings }>(
        "/royalties/payout-settings",
        input,
        token,
      )
      .then((response) => response.settings);
  },

  getRoyaltyFeeSettings(token: string) {
    return httpClient
      .get<{ settings: RoyaltyFeeSettings }>("/royalties/fee-settings", token)
      .then((response) => response.settings);
  },

  updateRoyaltyFeeSettings(input: RoyaltyFeeSettings, token: string) {
    return httpClient
      .put<{ settings: RoyaltyFeeSettings }>(
        "/royalties/fee-settings",
        input,
        token,
      )
      .then((response) => response.settings);
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

  listRoyaltyLedger(
    token: string,
    input?: {
      status?: "pending" | "approved" | "paid" | "reversed";
      recipientWalletAddress?: string;
    },
  ) {
    const query = new URLSearchParams();

    if (input?.status) {
      query.set("status", input.status);
    }

    if (input?.recipientWalletAddress) {
      query.set("recipientWalletAddress", input.recipientWalletAddress);
    }

    return httpClient
      .get<{ items: RoyaltyLedgerEntry[] }>(
        `/royalties/ledger${query.size > 0 ? `?${query.toString()}` : ""}`,
        token,
      )
      .then((response) => response.items);
  },

  approveRoyaltyLedgerEntries(
    input: ApproveRoyaltyLedgerEntriesInput,
    token: string,
  ) {
    return httpClient
      .post<{ items: RoyaltyLedgerEntry[] }>(
        "/royalties/ledger/approve",
        input,
        token,
      )
      .then((response) => response.items);
  },

  listRoyaltyPayouts(
    token: string,
    input?: {
      status?: "pending" | "submitted" | "confirmed" | "failed" | "cancelled";
      recipientWalletAddress?: string;
    },
  ) {
    const query = new URLSearchParams();

    if (input?.status) {
      query.set("status", input.status);
    }

    if (input?.recipientWalletAddress) {
      query.set("recipientWalletAddress", input.recipientWalletAddress);
    }

    return httpClient
      .get<{ items: RoyaltyPayoutRecord[] }>(
        `/royalties/payouts${query.size > 0 ? `?${query.toString()}` : ""}`,
        token,
      )
      .then((response) => response.items);
  },

  runRoyaltyPayouts(input: RunRoyaltyPayoutsInput, token: string) {
    return httpClient.post<RoyaltyPayoutExecutionResult>(
      "/royalties/payouts/run",
      input,
      token,
    );
  },

  reconcileRoyaltyPayouts(
    input: ReconcileRoyaltyPayoutsInput,
    token: string,
  ) {
    return httpClient.post<RoyaltyPayoutReconciliationResult>(
      "/royalties/payouts/reconcile",
      input,
      token,
    );
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
