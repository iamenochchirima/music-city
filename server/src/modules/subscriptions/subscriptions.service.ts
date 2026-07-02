import type {
  AdminPlatformSubscriptionSettings,
  PlatformSubscriptionPlan,
  SubscriptionRecord,
} from "@music-city/shared";

import { createId } from "../../services/id.service.js";
import { env } from "../../config/env.js";
import { databaseService } from "../../services/database.service.js";
import { subscriptionsRepository } from "./subscriptions.repository.js";

const nowMs = () => Date.now();

const isActive = (subscription: SubscriptionRecord) =>
  subscription.status === "active" && Date.parse(subscription.endsAt) > nowMs();

const PLATFORM_SUBSCRIPTION_SETTINGS_KEY = "platform_subscription_settings";

const defaultPlatformPlan = (): AdminPlatformSubscriptionSettings => ({
  enabled: env.PLATFORM_SUBSCRIPTION_ENABLED,
  name: env.PLATFORM_SUBSCRIPTION_NAME,
  description: env.PLATFORM_SUBSCRIPTION_DESCRIPTION,
  price: env.PLATFORM_SUBSCRIPTION_PRICE,
  assetCode: env.PLATFORM_SUBSCRIPTION_ASSET_CODE,
  assetIssuer: env.PLATFORM_SUBSCRIPTION_ASSET_ISSUER ?? "",
  periodDays: env.PLATFORM_SUBSCRIPTION_PERIOD_DAYS,
});

const normalizePlatformPlan = (
  settings?: Partial<AdminPlatformSubscriptionSettings> | null,
): AdminPlatformSubscriptionSettings => ({
  ...defaultPlatformPlan(),
  ...settings,
  assetCode: env.PLATFORM_SUBSCRIPTION_ASSET_CODE,
  assetIssuer: env.PLATFORM_SUBSCRIPTION_ASSET_ISSUER ?? "",
});

export const subscriptionsService = {
  async getPlatformPlan(): Promise<PlatformSubscriptionPlan> {
    const stored = await databaseService.findSetting<AdminPlatformSubscriptionSettings>(
      PLATFORM_SUBSCRIPTION_SETTINGS_KEY,
    );
    const plan = normalizePlatformPlan(stored);

    return {
      enabled: plan.enabled,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      assetCode: plan.assetCode,
      assetIssuer: plan.assetIssuer || undefined,
      periodDays: plan.periodDays,
    };
  },

  async listMine(walletAddress: string) {
    const items = (await subscriptionsRepository.listByWallet(walletAddress)).filter(
      (subscription) => subscription.scope === "platform",
    );
    return items.map((subscription) =>
      isActive(subscription)
        ? subscription
        : {
            ...subscription,
            status: "expired" as const,
          },
    );
  },

  async hasActivePlatformSubscription(walletAddress: string) {
    const items = await subscriptionsRepository.listByWallet(walletAddress);

    return items.some(
      (subscription) =>
        subscription.scope === "platform" && isActive(subscription),
    );
  },

  async findPlatformByPayment(walletAddress: string, paymentId: string) {
    const items = await subscriptionsRepository.listByWallet(walletAddress);

    return items.find(
      (subscription) =>
        subscription.scope === "platform" &&
        subscription.paymentId === paymentId,
    );
  },

  async activateOrExtendPlatform(
    walletAddress: string,
    paymentId: string,
    periodDays: number,
  ) {
    const existing = (await subscriptionsRepository.listByWallet(walletAddress))
      .filter((subscription) => subscription.scope === "platform")
      .sort(
        (left, right) =>
          Date.parse(right.endsAt) - Date.parse(left.endsAt),
      )[0];

    const baseMs =
      existing && Date.parse(existing.endsAt) > nowMs()
        ? Date.parse(existing.endsAt)
        : nowMs();
    const startsAt =
      existing && Date.parse(existing.endsAt) > nowMs()
        ? existing.startsAt
        : new Date(nowMs()).toISOString();
    const endsAt = new Date(
      baseMs + periodDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const timestamp = new Date().toISOString();

    return subscriptionsRepository.upsert({
      id: existing?.id ?? createId("sub"),
      walletAddress,
      scope: "platform",
      status: "active",
      startsAt,
      endsAt,
      paymentId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
  },
};
