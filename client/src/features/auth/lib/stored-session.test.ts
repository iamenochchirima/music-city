import { describe, expect, it } from "vitest";
import { usableStoredSession } from "./stored-session";
const session = {
  walletAddress: "GD7GRIW7UKZVVFIJSSJG7NJSCUJOFLIH2E2BGFVVEDKYVXFAUJVURCOR",
  displayName: "Artist",
  primaryIntent: "artist",
  artistAccess: true,
  onboardingStatus: "complete",
  onboardingStep: "complete",
  onboardingVersion: 1,
  profileCompletion: {
    percentage: 100,
    completed: [],
    missing: [],
    requiredComplete: true,
  },
};
const saved = (exp: number) =>
  JSON.stringify({
    ...session,
    token: `header.${btoa(JSON.stringify({ exp }))}.signature`,
  });
describe("stored application session expiry", () => {
  it("restores a structurally valid unexpired session without treating it as API authorization", () => {
    expect(usableStoredSession(saved(200), 100000)?.walletAddress).toBe(
      session.walletAddress,
    );
  });
  it("drops expired sessions so Dynamic can obtain a fresh application session", () => {
    expect(usableStoredSession(saved(100), 100000)).toBeNull();
    expect(usableStoredSession(saved(99), 100000)).toBeNull();
  });
  it("drops malformed cache and missing expiry rather than retaining a logged-in shell", () => {
    for (const raw of [
      "not json",
      "{}",
      JSON.stringify({ ...session, token: "invalid" }),
      JSON.stringify({ ...session, token: `header.${btoa("{}")}.signature` }),
    ])
      expect(usableStoredSession(raw)).toBeNull();
  });
});
