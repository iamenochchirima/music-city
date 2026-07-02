import type {
  PaymentIntentRecord,
  PaymentRecord,
} from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export const paymentsRepository = {
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
