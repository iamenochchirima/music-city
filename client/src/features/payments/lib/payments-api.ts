"use client";

import type {
  ArtistActivationQuote,
  CheckoutAttempt,
  ConfirmPaymentInput,
  PaymentIntentRecord,
  PaymentRecord,
  TrackSale,
  SubscriptionRecord,
} from "@music-city/shared";

import { httpClient } from "@/lib/api/http-client";

export const paymentsApi = {
  async listTrackSales(token: string) {
    return (
      await httpClient.get<{ items: TrackSale[] }>("/payments/sales", token)
    ).items;
  },
  async prepareCheckout(token: string, intentId: string) {
    const response = await httpClient.post<{ checkout: CheckoutAttempt }>(
      `/payments/intents/${intentId}/checkout`,
      {},
      token,
    );
    return response.checkout;
  },
  async getCheckout(token: string, id: string) {
    const response = await httpClient.get<{ checkout: CheckoutAttempt }>(
      `/payments/checkouts/${id}`,
      token,
    );
    return response.checkout;
  },
  async authorizeCheckout(
    token: string,
    id: string,
    signedTransaction: string,
  ) {
    const response = await httpClient.post<{ checkout: CheckoutAttempt }>(
      `/payments/checkouts/${id}/authorize`,
      { signedTransaction },
      token,
    );
    return response.checkout;
  },
  async submitCheckout(token: string, id: string) {
    const response = await httpClient.post<{ checkout: CheckoutAttempt }>(
      `/payments/checkouts/${id}/submit`,
      {},
      token,
    );
    return response.checkout;
  },
  async getArtistOnboardingFeeStatus(token: string) {
    return httpClient.get<ArtistActivationQuote>(
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
      artistAccess?: boolean;
    }>("/payments/confirm", input, token);
  },
};
