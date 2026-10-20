import type {
  PaymentIntentRecord,
  PaymentRecord,
  TrackSale,
} from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export const paymentsRepository = {
  async listTrackSales(walletAddress: string) {
    return databaseService.transaction(async (client) => {
      const result = await client.query<TrackSale>(
        `
        SELECT p.id, p.track_id AS "trackId", t.payload->>'title' AS "trackTitle",
          p.payload->>'amount' AS amount, p.payload->>'assetCode' AS "assetCode",
          p.payload->>'networkPassphrase' AS "networkPassphrase", p.payload->>'confirmedAt' AS "confirmedAt", p.payload->>'txHash' AS "txHash"
        FROM payments p JOIN tracks t ON t.id=p.track_id JOIN users u ON u.id=t.artist_id
        WHERE u.wallet_address=$1 AND p.product_type='track_purchase' AND p.payload->>'status'='confirmed'
        ORDER BY p.confirmed_at DESC, p.id DESC`,
        [walletAddress],
      );
      return result.rows;
    });
  },
  async findIntentById(id: string) {
    return databaseService.findPayloadById<PaymentIntentRecord>(
      "payment_intents",
      id,
    );
  },

  async listIntentsByWallet(walletAddress: string) {
    return databaseService.listPaymentIntentsByWallet<PaymentIntentRecord>(
      walletAddress,
    );
  },

  async upsertIntent(intent: PaymentIntentRecord) {
    await databaseService.upsertPaymentIntent(
      intent.id,
      intent.walletAddress,
      intent.productType,
      intent.trackId ?? null,
      intent.status,
      intent.expiresAt,
      intent,
    );

    return intent;
  },

  async findPaymentById(id: string) {
    return databaseService.findPayloadById<PaymentRecord>("payments", id);
  },

  async listAllPayments() {
    return databaseService.listPayloads<PaymentRecord>("payments");
  },

  async findPaymentByTxHash(txHash: string) {
    return databaseService.findPaymentByTxHash<PaymentRecord>(txHash);
  },

  async findPaymentByIntentId(intentId: string) {
    return databaseService.findPaymentByIntentId<PaymentRecord>(intentId);
  },

  async listPaymentsByWallet(walletAddress: string) {
    return databaseService.listPaymentsByWallet<PaymentRecord>(walletAddress);
  },

  async upsertPayment(payment: PaymentRecord) {
    await databaseService.upsertPayment(
      payment.id,
      payment.intentId,
      payment.walletAddress,
      payment.txHash,
      payment.productType,
      payment.trackId ?? null,
      payment.confirmedAt,
      payment,
    );

    return payment;
  },
};
