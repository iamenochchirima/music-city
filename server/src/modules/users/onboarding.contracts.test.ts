import assert from "node:assert/strict";
import test from "node:test";

import {
  authSessionSchema,
  completeOnboardingSchema,
  onboardingArtistIdentityStepSchema,
  onboardingArtistActivationStepSchema,
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
    facebook: "",
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
  assert.deepEqual(
    onboardingArtistActivationStepSchema.parse({ step: "artist_activation" }),
    { step: "artist_activation" },
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
        facebook: "",
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

test("all registration branches end with discovery and share the genre catalogue", async () => {
  const { onboardingSteps, nextOnboardingStep, MUSIC_GENRES, FEATURED_MUSIC_GENRES, socialLinksSchema } = await import("@music-city/shared");
  for (const intent of ["artist", "both", "listener"] as const) {
    const steps = onboardingSteps(intent);
    assert.deepEqual(steps.slice(-3), ["visuals", "personalize", "complete"]);
    for (let index=0;index<steps.length-1;index++) assert.equal(nextOnboardingStep(intent,steps[index]!),steps[index+1]);
  }
  for (const genre of ["Traditional","Dance","Kwaito","Amapiano","Maskandi","R&B / Soul"]) {
    assert.ok((MUSIC_GENRES as readonly string[]).includes(genre));
    assert.ok((FEATURED_MUSIC_GENRES as readonly string[]).includes(genre));
  }
  assert.ok(!(MUSIC_GENRES as readonly string[]).includes("Soul"));
  assert.ok(!(MUSIC_GENRES as readonly string[]).includes("R&B"));
  assert.equal(socialLinksSchema.parse({facebook:"https://facebook.com/artist"}).facebook,"https://facebook.com/artist");
  assert.throws(()=>socialLinksSchema.parse({facebook:"not-a-url"}));
});
