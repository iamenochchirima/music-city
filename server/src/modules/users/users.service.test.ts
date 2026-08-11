import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const walletAddress = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const { usersService } = await import("./users.service.js");
const { usersRepository } = await import("./users.repository.js");
const { paymentsRepository } = await import("../payments/payments.repository.js");

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

test("zero-priced artist onboarding grants artist access", async () => {
  const profile = {
    id: "usr-artist-1",
    walletAddress,
    email: "artist@example.com",
    displayName: "Existing Artist",
    role: "artist" as const,
    artistOnboardingFeePaid: true,
    location: "",
    verified: false,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
  const cleanup = [
    restore(
      usersRepository,
      "findByWallet",
      (async () => profile) as typeof usersRepository.findByWallet,
    ),
    restore(
      paymentsRepository,
      "listPaymentsByWallet",
      (async () => []) as typeof paymentsRepository.listPaymentsByWallet,
    ),
    restore(
      paymentsRepository,
      "upsertIntent",
      (async (intent) => intent) as typeof paymentsRepository.upsertIntent,
    ),
    restore(
      paymentsRepository,
      "upsertPayment",
      (async (payment) => payment) as typeof paymentsRepository.upsertPayment,
    ),
  ];

  try {
    const hydrated = await usersService.getProfile(walletAddress);

    assert.equal(hydrated?.artistOnboardingFeePaid, true);
    const access = await usersService.requireArtistOnboardingAccess(
      walletAddress,
      "Create a profile first",
    );
    assert.equal(access.role, "artist");
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});
