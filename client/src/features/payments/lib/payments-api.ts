"use client";

import type {
  ConfirmPaymentInput,
  PaymentIntentRecord,
  PaymentRecord,
  SubscriptionRecord,
} from "@music-city/shared";

import { httpClient } from "@/lib/api/http-client";

export const paymentsApi = {
  async getArtistOnboardingFeeStatus(token: string) {
    return httpClient.get<{ paid: boolean }>(
      "/payments/artist-onboarding-fee/status",
      token,
    );
  },

  async listMine(token: string) {
    const response = await httpClient.get<{ items: PaymentRecord[] }>(
      "/payments/mine",
      token,
    );

    return response.items;
  },

  async createTrackPurchaseIntent(token: string, trackId: string) {
    const response = await httpClient.post<{ intent: PaymentIntentRecord }>(
      `/payments/intents/track/${trackId}`,
      {},
      token,
    );

    return response.intent;
  },

  async createPlatformSubscriptionIntent(token: string) {
    const response = await httpClient.post<{ intent: PaymentIntentRecord }>(
      "/payments/intents/platform-subscription",
      {},
      token,
    );

    return response.intent;
  },

  async createArtistOnboardingFeeIntent(token: string) {
    const response = await httpClient.post<{ intent: PaymentIntentRecord }>(
      "/payments/intents/artist-onboarding-fee",
      {},
      token,
    );

    return response.intent;
  },

  async confirm(token: string, input: ConfirmPaymentInput) {
    return httpClient.post<{
      payment: PaymentRecord;
      entitlement?: { id: string; trackId: string };
      subscription?: SubscriptionRecord;
      artistOnboardingFeePaid?: boolean;
    }>("/payments/confirm", input, token);
  },
};
