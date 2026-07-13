import type {
  ConfirmPaymentInput,
  PaymentIntentRecord,
  PaymentProductType,
  PaymentRecord,
  StellarAssetDescriptor,
  SubscriptionScope,
} from "@music-city/shared";
import {
  confirmPaymentSchema,
  paymentIntentSchema,
} from "@music-city/shared";

import { env } from "../../config/env.js";
import { entitlementsService } from "../entitlements/entitlements.service.js";
import { tracksService } from "../tracks/tracks.service.js";
import { usersService } from "../users/users.service.js";
import { createId } from "../../services/id.service.js";
import { normalizePositiveAmount, normalizeStellarAsset } from "../../utils/commerce.js";
import { HttpError } from "../../utils/http-error.js";
import { paymentsRepository } from "./payments.repository.js";
import { subscriptionsService } from "../subscriptions/subscriptions.service.js";
import { adminService } from "../admin/admin.service.js";
import { royaltiesService } from "../royalties/royalties.service.js";

const INTENT_TTL_MS = 15 * 60 * 1000;

const normalizeAmount = (value: string) =>
  Number(normalizePositiveAmount(value, "Payment amount")).toFixed(7);

const withIntentPrecision = (amount: string, intentId: string) => {
  const baseUnits = Math.round(
    Number(normalizePositiveAmount(amount, "Payment amount")) * 10_000_000,
  );
  const nonce = [...intentId].reduce(
    (sum, char, index) => (sum + char.charCodeAt(0) * (index + 1)) % 100_000,
    0,
  );

  return ((baseUnits + nonce) / 10_000_000).toFixed(7);
};

const settlementAsset = (): StellarAssetDescriptor => ({
  ...normalizeStellarAsset(
    {
      code: env.STELLAR_SETTLEMENT_ASSET_CODE,
      issuer: env.STELLAR_SETTLEMENT_ASSET_ISSUER,
    },
    "Settlement",
  ),
});

const createIntentRecord = async (input: {
  walletAddress: string;
  productType: PaymentProductType;
  subscriptionScope?: SubscriptionScope;
  trackId?: string;
  amount: string;
  asset: StellarAssetDescriptor;
}) => {
  const timestamp = new Date().toISOString();
  const id = createId("payi");
  const preciseAmount = withIntentPrecision(input.amount, id);
  const destinationAddress = await adminService.getTreasuryWalletAddress();

  return paymentIntentSchema.parse({
    id,
    walletAddress: input.walletAddress,
    productType: input.productType,
    subscriptionScope: input.subscriptionScope,
    trackId: input.trackId,
    amount: preciseAmount,
    assetCode: input.asset.code,
    assetIssuer: input.asset.issuer,
    destinationAddress,
    memo: `${input.productType}:${id}`,
    status: "pending",
    expiresAt: new Date(Date.now() + INTENT_TTL_MS).toISOString(),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
};

const paymentResultFromExistingRecord = async (
  walletAddress: string,
  intent: PaymentIntentRecord,
  payment: PaymentRecord,
) => {
  if (intent.productType === "track_purchase" && intent.trackId) {
    await royaltiesService.ensureTrackPurchaseLedgerEntries(payment);

    const entitlement =
      (await entitlementsService.findMineForTrack(walletAddress, intent.trackId)) ??
      (await entitlementsService.grantPurchase(walletAddress, intent.trackId));

    return { payment, entitlement };
  }

  if (intent.productType === "platform_subscription") {
    await royaltiesService.ensurePlatformSubscriptionLedgerEntries(payment);

    const plan = await subscriptionsService.getPlatformPlan();

    const subscription =
      (await subscriptionsService.findPlatformByPayment(
        walletAddress,
        payment.id,
      )) ??
      (await subscriptionsService.activateOrExtendPlatform(
        walletAddress,
        payment.id,
        plan.periodDays,
      ));

    return { payment, subscription };
  }

  if (intent.productType === "artist_onboarding_fee") {
    return { payment, artistOnboardingFeePaid: true };
  }

  throw new HttpError(400, "Unsupported payment product");
};

type HorizonTransaction = {
  successful?: boolean;
  source_account?: string;
  memo?: string;
  memo_type?: string;
  hash?: string;
};

type HorizonOperation = {
  type?: string;
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
};

const fetchTransaction = async (txHash: string) => {
  const response = await fetch(
    `${env.STELLAR_HORIZON_URL}/transactions/${encodeURIComponent(txHash)}`,
  );

  if (!response.ok) {
    throw new HttpError(400, "Stellar transaction could not be found");
  }

  return (await response.json()) as HorizonTransaction;
};

const fetchTransactionOperations = async (txHash: string) => {
  const response = await fetch(
    `${env.STELLAR_HORIZON_URL}/transactions/${encodeURIComponent(txHash)}/operations?limit=200&order=asc`,
  );

  if (!response.ok) {
    throw new HttpError(400, "Stellar transaction operations could not be loaded");
  }

  const payload = (await response.json()) as {
    _embedded?: { records?: HorizonOperation[] };
  };

  return payload._embedded?.records ?? [];
};

const operationMatchesAsset = (
  operation: HorizonOperation,
  intent: PaymentIntentRecord,
) => {
  const nativeIntent =
    intent.assetCode.toUpperCase() === "XLM" && !intent.assetIssuer;

  if (nativeIntent) {
    return operation.asset_type === "native";
  }

  return (
    operation.asset_code === intent.assetCode &&
    operation.asset_issuer === intent.assetIssuer
  );
};

const verifyTransactionAgainstIntent = async (
  walletAddress: string,
  txHash: string,
  intent: PaymentIntentRecord,
) => {
  const transaction = await fetchTransaction(txHash);

  if (!transaction.successful) {
    throw new HttpError(400, "Stellar payment transaction was not successful");
  }

  if (transaction.source_account !== walletAddress) {
    throw new HttpError(403, "Stellar payment source account does not match session wallet");
  }

  if (
    transaction.memo &&
    (transaction.memo_type !== "text" || transaction.memo !== intent.memo)
  ) {
    throw new HttpError(400, "Stellar payment memo does not match payment intent");
  }

  const operations = await fetchTransactionOperations(txHash);
  const paymentOperation = operations.find(
    (operation) =>
      operation.type === "payment" &&
      operation.to === intent.destinationAddress &&
      operationMatchesAsset(operation, intent) &&
      normalizeAmount(operation.amount ?? "0") === normalizeAmount(intent.amount),
  );

  if (!paymentOperation) {
    throw new HttpError(400, "No matching Stellar payment operation was found");
  }

  return {
    transaction,
    paymentOperation,
  };
};

export const paymentsService = {
  async listMine(walletAddress: string) {
    return (await paymentsRepository.listPaymentsByWallet(walletAddress)).filter(
      (payment) =>
        payment.productType === "track_purchase" ||
        payment.productType === "platform_subscription" ||
        payment.productType === "artist_onboarding_fee",
    );
  },

  async createTrackPurchaseIntent(walletAddress: string, trackId: string) {
    const track = await tracksService.getTrackForPlayback(trackId);

    if (!track || !track.playbackReady || track.access === "private") {
      throw new HttpError(404, "Track not found");
    }

    if (track.artistId === (await usersService.getProfile(walletAddress))?.id) {
      throw new HttpError(400, "Artists do not need to purchase their own track");
    }

    if (!track.purchaseEnabled || !track.purchasePrice) {
      throw new HttpError(400, "Track purchase is not enabled");
    }

    const existingEntitlements = await entitlementsService.listMine(walletAddress);

    if (existingEntitlements.some((entitlement) => entitlement.trackId === trackId)) {
      throw new HttpError(400, "Track is already unlocked for this wallet");
    }

    const intent = await createIntentRecord({
      walletAddress,
      productType: "track_purchase",
      trackId,
      amount: normalizePositiveAmount(track.purchasePrice, "Track purchase price"),
      asset: normalizeStellarAsset(
        {
          code: track.purchaseAssetCode ?? settlementAsset().code,
          issuer: track.purchaseAssetIssuer ?? settlementAsset().issuer,
        },
        "Track purchase",
      ),
    });

    return paymentsRepository.upsertIntent(intent);
  },

  async createPlatformSubscriptionIntent(walletAddress: string) {
    const plan = await subscriptionsService.getPlatformPlan();

    if (!plan.enabled) {
      throw new HttpError(400, "Platform subscription is not enabled");
    }

    if (await subscriptionsService.hasActivePlatformSubscription(walletAddress)) {
      throw new HttpError(400, "Platform subscription is already active");
    }

    const intent = await createIntentRecord({
      walletAddress,
      productType: "platform_subscription",
      subscriptionScope: "platform",
      amount: normalizePositiveAmount(
        plan.price,
        "Platform subscription price",
      ),
      asset: normalizeStellarAsset(
        {
          code: plan.assetCode,
          issuer: plan.assetIssuer,
        },
        "Platform subscription",
      ),
    });

    return paymentsRepository.upsertIntent(intent);
  },

  async createArtistOnboardingFeeIntent(walletAddress: string) {
    if (await usersService.hasArtistOnboardingAccess(walletAddress)) {
      throw new HttpError(400, "Artist onboarding has already been unlocked");
    }

    const intent = await createIntentRecord({
      walletAddress,
      productType: "artist_onboarding_fee",
      amount: normalizePositiveAmount(
        env.ARTIST_ONBOARDING_FEE_PRICE,
        "Artist onboarding fee",
      ),
      asset: settlementAsset(),
    });

    return paymentsRepository.upsertIntent(intent);
  },

  async getArtistOnboardingFeeStatus(walletAddress: string) {
    return {
      paid: await usersService.hasArtistOnboardingAccess(walletAddress),
    };
  },

  async confirm(walletAddress: string, input: ConfirmPaymentInput) {
    const parsed = confirmPaymentSchema.parse(input);
    const intent = await paymentsRepository.findIntentById(parsed.intentId);

    if (!intent || intent.walletAddress !== walletAddress) {
      throw new HttpError(404, "Payment intent not found");
    }

    if (intent.status === "confirmed") {
      if (intent.txHash && intent.txHash !== parsed.txHash) {
        throw new HttpError(400, "Payment intent has already been confirmed");
      }

      const existingPayment =
        (await paymentsRepository.findPaymentByIntentId(intent.id)) ??
        (intent.txHash
          ? await paymentsRepository.findPaymentByTxHash(intent.txHash)
          : null);

      if (!existingPayment) {
        throw new HttpError(409, "Payment confirmation is incomplete; please contact support");
      }

      return paymentResultFromExistingRecord(walletAddress, intent, existingPayment);
    }

    if (intent.status !== "pending") {
      throw new HttpError(400, "Payment intent is no longer pending");
    }

    if (Date.parse(intent.expiresAt) < Date.now()) {
      await paymentsRepository.upsertIntent({
        ...intent,
        status: "expired",
        updatedAt: new Date().toISOString(),
      });
      throw new HttpError(400, "Payment intent has expired");
    }

    const existingPayment = await paymentsRepository.findPaymentByTxHash(
      parsed.txHash,
    );

    if (existingPayment) {
      if (existingPayment.intentId === intent.id) {
        return paymentResultFromExistingRecord(walletAddress, intent, existingPayment);
      }

      throw new HttpError(400, "Transaction has already been used");
    }

    await verifyTransactionAgainstIntent(walletAddress, parsed.txHash, intent);

    const timestamp = new Date().toISOString();
    const payment: PaymentRecord = {
      id: createId("pay"),
      intentId: intent.id,
      walletAddress,
      productType: intent.productType,
      subscriptionScope: intent.subscriptionScope,
      trackId: intent.trackId,
      txHash: parsed.txHash,
      amount: intent.amount,
      assetCode: intent.assetCode,
      assetIssuer: intent.assetIssuer,
      status: "confirmed",
      confirmedAt: timestamp,
      createdAt: timestamp,
    };

    try {
      await paymentsRepository.upsertPayment(payment);
    } catch (error) {
      const existingByIntent = await paymentsRepository.findPaymentByIntentId(intent.id);

      if (existingByIntent) {
        return paymentResultFromExistingRecord(walletAddress, intent, existingByIntent);
      }

      const existingByTxHash = await paymentsRepository.findPaymentByTxHash(parsed.txHash);

      if (existingByTxHash?.intentId === intent.id) {
        return paymentResultFromExistingRecord(walletAddress, intent, existingByTxHash);
      }

      throw error;
    }
    await paymentsRepository.upsertIntent({
      ...intent,
      status: "confirmed",
      txHash: parsed.txHash,
      updatedAt: timestamp,
    });

    return paymentResultFromExistingRecord(walletAddress, intent, payment);
  },
};
