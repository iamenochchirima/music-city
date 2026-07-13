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

test("an existing artist role does not bypass the onboarding payment", async () => {
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
  ];

  try {
    const hydrated = await usersService.getProfile(walletAddress);

    assert.equal(hydrated?.artistOnboardingFeePaid, false);
    await assert.rejects(
      () =>
        usersService.requireArtistOnboardingAccess(
          walletAddress,
          "Create a profile first",
        ),
      (error: { message?: string; statusCode?: number }) =>
        error.statusCode === 402 &&
        error.message === "Pay the onboarding fee before accessing artist tools",
    );
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});
