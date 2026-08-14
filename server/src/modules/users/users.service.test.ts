import assert from "node:assert/strict";
import test from "node:test";
import type { UserProfile } from "@music-city/shared";

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
    primaryIntent: "artist" as const,
    artistAccess: true,
    onboardingStatus: "complete" as const,
    onboardingStep: "complete" as const,
    onboardingVersion: 1,
    onboardingCompletedAt: new Date(0).toISOString(),
    location: "",
    genres: [],
    favoriteArtistIds: [],
    interestedInLocalMusic: false,
    notificationPreferences: {
      releaseNotifications: true,
      artistUpdates: true,
      productUpdates: false,
    },
    bio: "",
    socialLinks: {
      website: "",
      instagram: "",
      youtube: "",
      soundcloud: "",
      x: "",
    },
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

    assert.equal(hydrated?.artistAccess, true);
    const access = await usersService.requireArtistOnboardingAccess(
      walletAddress,
      "Create a profile first",
    );
    assert.equal(access.primaryIntent, "artist");
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

const createProfile = (
  overrides: Partial<UserProfile> = {},
): UserProfile => ({
  id: "usr-onboarding",
  walletAddress,
  email: "",
  displayName: "Listener",
  primaryIntent: "listener",
  artistAccess: false,
  onboardingStatus: "in_progress",
  onboardingStep: "personalize",
  onboardingVersion: 1,
  onboardingCompletedAt: undefined,
  location: "",
  genres: [],
  favoriteArtistIds: [],
  interestedInLocalMusic: false,
  notificationPreferences: {
    releaseNotifications: true,
    artistUpdates: true,
    productUpdates: false,
  },
  bio: "",
  socialLinks: {
    website: "",
    instagram: "",
    youtube: "",
    soundcloud: "",
    x: "",
  },
  hasReleasedMusic: undefined,
  profileImageUrl: undefined,
  profileImageStorageKey: undefined,
  headerImageUrl: undefined,
  headerImageStorageKey: undefined,
  verified: false,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  ...overrides,
});

test("saving the required intent advances a profile created by the welcome step", async () => {
  let stored: UserProfile | null = null;
  const cleanup = [
    restore(
      usersRepository,
      "findByWallet",
      (async () => stored) as typeof usersRepository.findByWallet,
    ),
    restore(
      usersRepository,
      "upsert",
      (async (profile) => {
        stored = profile;
        return profile;
      }) as typeof usersRepository.upsert,
    ),
  ];

  try {
    await usersService.saveOnboardingStep(walletAddress, {
      step: "identity",
      displayName: "New Listener",
      email: "",
      location: "Cape Town",
    });
    const profile = await usersService.saveOnboardingStep(walletAddress, {
      step: "intent",
      primaryIntent: "listener",
    });

    assert.ok(profile);
    assert.equal(profile.primaryIntent, "listener");
    assert.equal(profile.displayName, "New Listener");
    assert.equal(profile.onboardingStatus, "in_progress");
    assert.equal(profile.onboardingStep, "personalize");
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("saving welcome details creates the profile before intent selection", async () => {
  let stored: UserProfile | null = null;
  const cleanup = [
    restore(
      usersRepository,
      "findByWallet",
      (async () => stored) as typeof usersRepository.findByWallet,
    ),
    restore(
      usersRepository,
      "upsert",
      (async (profile) => {
        stored = profile;
        return profile;
      }) as typeof usersRepository.upsert,
    ),
  ];

  try {
    const profile = await usersService.saveOnboardingStep(walletAddress, {
      step: "identity",
      displayName: "Welcome Listener",
      email: "welcome@example.com",
      location: "Cape Town",
    });

    assert.ok(profile);
    assert.equal(profile.displayName, "Welcome Listener");
    assert.equal(profile.email, "welcome@example.com");
    assert.equal(profile.primaryIntent, "listener");
    assert.equal(profile.onboardingStep, "intent");
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("both intent persists listener and artist personalization without role ambiguity", async () => {
  let stored: UserProfile | null = null;
  const cleanup = [
    restore(
      usersRepository,
      "findByWallet",
      (async () => stored) as typeof usersRepository.findByWallet,
    ),
    restore(
      usersRepository,
      "upsert",
      (async (profile) => {
        stored = profile;
        return profile;
      }) as typeof usersRepository.upsert,
    ),
    restore(
      usersRepository,
      "listArtists",
      (async () => []) as typeof usersRepository.listArtists,
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
    await usersService.saveOnboardingStep(walletAddress, {
      step: "identity",
      displayName: "Both Sides",
      email: "both@example.com",
      location: "Johannesburg",
    });
    await usersService.saveOnboardingStep(walletAddress, {
      step: "intent",
      primaryIntent: "both",
    });
    await usersService.saveOnboardingStep(walletAddress, {
      step: "personalize",
      genres: ["Afrobeats", "House"],
      favoriteArtistIds: [],
      interestedInLocalMusic: true,
      notificationPreferences: {
        releaseNotifications: true,
        artistUpdates: false,
        productUpdates: false,
      },
    });
    const profile = await usersService.saveOnboardingStep(walletAddress, {
      step: "artist_identity",
      bio: "A sound from both sides of the city.",
      genres: ["Afrobeats", "House"],
      socialLinks: {
        website: "https://example.com",
        instagram: "",
        youtube: "",
        soundcloud: "",
        x: "",
      },
      hasReleasedMusic: true,
    });

    assert.ok(profile);
    assert.equal(profile.primaryIntent, "both");
    assert.deepEqual(profile.genres, ["Afrobeats", "House"]);
    assert.equal(profile.interestedInLocalMusic, true);
    assert.equal(profile.bio, "A sound from both sides of the city.");
    assert.equal(profile.hasReleasedMusic, true);
    assert.equal(profile.onboardingStep, "visuals");
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("completion requires only display name and intent and is idempotent", async () => {
  const completedAt = new Date(0).toISOString();
  let stored = createProfile({
    displayName: "Ready Listener",
    onboardingStep: "visuals",
  });
  const cleanup = [
    restore(
      usersRepository,
      "findByWallet",
      (async () => stored) as typeof usersRepository.findByWallet,
    ),
    restore(
      usersRepository,
      "upsert",
      (async (profile) => {
        stored = profile;
        return profile;
      }) as typeof usersRepository.upsert,
    ),
  ];

  try {
    const first = await usersService.completeOnboarding(walletAddress, {
      step: "complete",
    });
    const second = await usersService.completeOnboarding(walletAddress, {
      step: "complete",
    });

    assert.ok(first);
    assert.ok(second);
    assert.equal(first.onboardingStatus, "complete");
    assert.equal(first.onboardingStep, "complete");
    assert.ok(first.onboardingCompletedAt);
    assert.equal(second.onboardingCompletedAt, first.onboardingCompletedAt);
    assert.notEqual(first.onboardingCompletedAt, completedAt);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});
