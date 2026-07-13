import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";
process.env.STELLAR_TREASURY_ADDRESS ??=
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const walletAddress = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const { paymentsService } = await import("./payments.service.js");
const { paymentsRepository } = await import("./payments.repository.js");
const { subscriptionsService } = await import("../subscriptions/subscriptions.service.js");
const { entitlementsService } = await import("../entitlements/entitlements.service.js");
const { royaltiesService } = await import("../royalties/royalties.service.js");
const { usersService } = await import("../users/users.service.js");

const restore = <T extends object, K extends keyof T>(
  target: T,
  key: K,
  replacement: T[K],
) => {
  const original = target[key];
  target[key] = replacement;
  return () => {
    target[key] = original;
  };
};

test("createPlatformSubscriptionIntent rejects wallets that already have an active platform subscription", async () => {
  const cleanup = [
    restore(
      subscriptionsService,
      "getPlatformPlan",
      (async () => ({
        enabled: true,
        name: "Music City Pass",
        description: "Unlock subscriber-only releases.",
        price: "15",
        assetCode: "XLM",
        assetIssuer: undefined,
        periodDays: 30,
      })) as typeof subscriptionsService.getPlatformPlan,
    ),
    restore(
      subscriptionsService,
      "hasActivePlatformSubscription",
      (async () => true) as typeof subscriptionsService.hasActivePlatformSubscription,
    ),
  ];

  try {
    await assert.rejects(
      () => paymentsService.createPlatformSubscriptionIntent(walletAddress),
      (error: { message?: string; statusCode?: number }) =>
        error.statusCode === 400 &&
        error.message === "Platform subscription is already active",
    );
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("confirm returns the existing purchase result when the same transaction is retried", async () => {
  const intent = {
    id: "payi-1",
    walletAddress,
    productType: "track_purchase" as const,
    trackId: "trk-1",
    amount: "5.0000100",
    assetCode: "XLM",
    destinationAddress: process.env.STELLAR_TREASURY_ADDRESS!,
    memo: "track_purchase:payi-1",
    status: "pending" as const,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const payment = {
    id: "pay-1",
    intentId: intent.id,
    walletAddress,
    productType: intent.productType,
    trackId: intent.trackId,
    txHash: "stellar-tx-1",
    amount: intent.amount,
    assetCode: "XLM",
    status: "confirmed" as const,
    confirmedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  const entitlement = {
    id: "ent-1",
    walletAddress,
    trackId: "trk-1",
    source: "purchase" as const,
    startsAt: new Date().toISOString(),
  };

  const cleanup = [
    restore(
      paymentsRepository,
      "findIntentById",
      (async () => intent) as typeof paymentsRepository.findIntentById,
    ),
    restore(
      paymentsRepository,
      "findPaymentByTxHash",
      (async (txHash: string) =>
        txHash === payment.txHash ? payment : null) as typeof paymentsRepository.findPaymentByTxHash,
    ),
    restore(
      entitlementsService,
      "findMineForTrack",
      (async () => entitlement) as typeof entitlementsService.findMineForTrack,
    ),
    restore(
      royaltiesService,
      "ensureTrackPurchaseLedgerEntries",
      (async () => []) as typeof royaltiesService.ensureTrackPurchaseLedgerEntries,
    ),
  ];

  try {
    const result = await paymentsService.confirm(walletAddress, {
      intentId: intent.id,
      txHash: payment.txHash,
    });

    assert.deepEqual(result, {
      payment,
      entitlement,
    });
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("confirm is idempotent after an intent has already been confirmed", async () => {
  const intent = {
    id: "payi-2",
    walletAddress,
    productType: "platform_subscription" as const,
    subscriptionScope: "platform" as const,
    amount: "8.0000100",
    assetCode: "XLM",
    destinationAddress: process.env.STELLAR_TREASURY_ADDRESS!,
    memo: "platform_subscription:payi-2",
    status: "confirmed" as const,
    txHash: "stellar-tx-2",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const payment = {
    id: "pay-2",
    intentId: intent.id,
    walletAddress,
    productType: intent.productType,
    subscriptionScope: intent.subscriptionScope,
    txHash: intent.txHash,
    amount: intent.amount,
    assetCode: "XLM",
    status: "confirmed" as const,
    confirmedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  const subscription = {
    id: "sub-1",
    walletAddress,
    scope: "platform" as const,
    status: "active" as const,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    paymentId: payment.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const cleanup = [
    restore(
      paymentsRepository,
      "findIntentById",
      (async () => intent) as typeof paymentsRepository.findIntentById,
    ),
    restore(
      paymentsRepository,
      "findPaymentByIntentId",
      (async () => payment) as typeof paymentsRepository.findPaymentByIntentId,
    ),
    restore(
      subscriptionsService,
      "findPlatformByPayment",
      (async () => subscription) as typeof subscriptionsService.findPlatformByPayment,
    ),
    restore(
      subscriptionsService,
      "getPlatformPlan",
      (async () => ({
        enabled: true,
        name: "Music City Pass",
        description: "Unlock subscriber-only releases.",
        price: "15",
        assetCode: "XLM",
        assetIssuer: undefined,
        periodDays: 30,
      })) as typeof subscriptionsService.getPlatformPlan,
    ),
    restore(
      royaltiesService,
      "ensurePlatformSubscriptionLedgerEntries",
      (async () => []) as typeof royaltiesService.ensurePlatformSubscriptionLedgerEntries,
    ),
  ];

  try {
    const result = await paymentsService.confirm(walletAddress, {
      intentId: intent.id,
      txHash: intent.txHash,
    });

    assert.deepEqual(result, {
      payment,
      subscription,
    });
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("createArtistOnboardingFeeIntent rejects wallets that already unlocked artist access", async () => {
  const cleanup = [
    restore(
      usersService,
      "hasArtistOnboardingAccess",
      (async () => true) as typeof usersService.hasArtistOnboardingAccess,
    ),
  ];

  try {
    await assert.rejects(
      () => paymentsService.createArtistOnboardingFeeIntent(walletAddress),
      (error: { message?: string; statusCode?: number }) =>
        error.statusCode === 400 &&
        error.message === "Artist onboarding has already been unlocked",
    );
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("confirm returns artist onboarding completion for the onboarding fee product", async () => {
  const intent = {
    id: "payi-artist-1",
    walletAddress,
    productType: "artist_onboarding_fee" as const,
    amount: "19.0000100",
    assetCode: "XLM",
    destinationAddress: process.env.STELLAR_TREASURY_ADDRESS!,
    memo: "artist_onboarding_fee:payi-artist-1",
    status: "confirmed" as const,
    txHash: "stellar-tx-artist-1",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const payment = {
    id: "pay-artist-1",
    intentId: intent.id,
    walletAddress,
    productType: intent.productType,
    txHash: intent.txHash,
    amount: intent.amount,
    assetCode: "XLM",
    status: "confirmed" as const,
    confirmedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const cleanup = [
    restore(
      paymentsRepository,
      "findIntentById",
      (async () => intent) as typeof paymentsRepository.findIntentById,
    ),
    restore(
      paymentsRepository,
      "findPaymentByIntentId",
      (async () => payment) as typeof paymentsRepository.findPaymentByIntentId,
    ),
  ];

  try {
    const result = await paymentsService.confirm(walletAddress, {
      intentId: intent.id,
      txHash: intent.txHash,
    });

    assert.deepEqual(result, {
      payment,
      artistOnboardingFeePaid: true,
    });
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("confirm rejects retry attempts that use a different transaction hash", async () => {
  const intent = {
    id: "payi-3",
    walletAddress,
    productType: "platform_subscription" as const,
    subscriptionScope: "platform" as const,
    amount: "8.0000100",
    assetCode: "XLM",
    destinationAddress: process.env.STELLAR_TREASURY_ADDRESS!,
    memo: "platform_subscription:payi-3",
    status: "confirmed" as const,
    txHash: "stellar-tx-3",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const cleanup = [
    restore(
      paymentsRepository,
      "findIntentById",
      (async () => intent) as typeof paymentsRepository.findIntentById,
    ),
  ];

  try {
    await assert.rejects(
      () =>
        paymentsService.confirm(walletAddress, {
          intentId: intent.id,
          txHash: "different-tx-hash",
        }),
      (error: { message?: string; statusCode?: number }) =>
        error.statusCode === 400 &&
        error.message === "Payment intent has already been confirmed",
    );
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});
