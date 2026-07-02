import type { SubscriptionRecord } from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export const subscriptionsRepository = {
  async findById(id: string) {
    return databaseService.findPayloadById<SubscriptionRecord>("subscriptions", id);
  },

  async listAll() {
    return databaseService.listPayloads<SubscriptionRecord>("subscriptions");
  },

  async listByWallet(walletAddress: string) {
    return databaseService.listSubscriptionsByWallet<SubscriptionRecord>(
      walletAddress,
    );
  },
  async upsert(subscription: SubscriptionRecord) {
    await databaseService.upsertSubscription(
      subscription.id,
      subscription.walletAddress,
      subscription.scope,
      subscription.status,
      subscription.endsAt,
      subscription,
    );

    return subscription;
  },
};
