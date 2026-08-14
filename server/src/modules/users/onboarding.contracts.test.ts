import assert from "node:assert/strict";
import test from "node:test";

import {
  authSessionSchema,
  completeOnboardingSchema,
  onboardingArtistIdentityStepSchema,
  onboardingIdentityStepSchema,
  onboardingIntentStepSchema,
  onboardingPersonalizeStepSchema,
  primaryIntentSchema,
  userProfileSchema,
} from "@music-city/shared";

const walletAddress = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const baseProfile = {
  id: "usr-contract",
  walletAddress,
  email: "",
  displayName: "Listener",
  primaryIntent: "listener" as const,
  artistAccess: false,
  onboardingStatus: "required" as const,
  onboardingStep: "intent" as const,
  onboardingVersion: 1,
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

test("primary intent accepts listener, artist, and both only", () => {
  assert.deepEqual(primaryIntentSchema.parse("listener"), "listener");
  assert.deepEqual(primaryIntentSchema.parse("artist"), "artist");
  assert.deepEqual(primaryIntentSchema.parse("both"), "both");
  assert.throws(() => primaryIntentSchema.parse("fan"));
});

test("listeners do not need artist-only fields", () => {
  assert.equal(userProfileSchema.parse(baseProfile).primaryIntent, "listener");
  assert.throws(() => userProfileSchema.parse({ ...baseProfile, displayName: "" }));
});

test("welcome input requires a display name and intent is a separate step", () => {
  const identity = onboardingIdentityStepSchema.parse({
    step: "identity",
    displayName: "Both Listener",
    email: "listener@example.com",
    location: "Durban",
  });

  assert.equal(identity.displayName, "Both Listener");
  assert.deepEqual(
    onboardingIntentStepSchema.parse({ step: "intent", primaryIntent: "both" }),
    { step: "intent", primaryIntent: "both" },
  );
  assert.throws(() =>
    onboardingIdentityStepSchema.parse({
      step: "identity",
      displayName: "",
    }),
  );
  assert.throws(() =>
    onboardingIdentityStepSchema.parse({
      step: "identity",
      displayName: "   ",
    }),
  );
  assert.throws(() =>
    onboardingIntentStepSchema.parse({
      step: "intent",
      primaryIntent: "unknown",
    }),
  );
});

test("personalization contracts reject unknown genres and invalid social URLs", () => {
  assert.throws(() =>
    onboardingPersonalizeStepSchema.parse({
      step: "personalize",
      genres: ["Not a real genre"],
      favoriteArtistIds: [],
      interestedInLocalMusic: false,
      notificationPreferences: {
        releaseNotifications: true,
        artistUpdates: true,
        productUpdates: false,
      },
    }),
  );
  assert.throws(() =>
    onboardingArtistIdentityStepSchema.parse({
      step: "artist_identity",
      bio: "Artist",
      genres: ["Jazz"],
      socialLinks: {
        website: "not-a-url",
        instagram: "",
        youtube: "",
        soundcloud: "",
        x: "",
      },
    }),
  );
});

test("session contract contains independent intent, access, and completion state", () => {
  const session = authSessionSchema.parse({
    walletAddress,
    email: "",
    displayName: "Artist",
    primaryIntent: "artist",
    artistAccess: false,
    onboardingStatus: "in_progress",
    onboardingStep: "artist_identity",
    onboardingVersion: 1,
    profileCompletion: {
      percentage: 25,
      completed: ["display_name"],
      missing: ["email", "location", "profile_image"],
      requiredComplete: true,
    },
  });

  assert.equal(session.primaryIntent, "artist");
  assert.equal(session.artistAccess, false);
  assert.equal(session.profileCompletion.requiredComplete, true);
  assert.throws(() => completeOnboardingSchema.parse({ step: "finish" }));
});

test("a pre-onboarding session may have no display name yet", () => {
  const session = authSessionSchema.parse({
    walletAddress,
    email: "listener@example.com",
    displayName: "",
    primaryIntent: "listener",
    onboardingStatus: "required",
    onboardingStep: "identity",
    onboardingVersion: 1,
    profileCompletion: {
      percentage: 0,
      completed: [],
      missing: ["display_name"],
      requiredComplete: false,
    },
  });

  assert.equal(session.displayName, "");
});
