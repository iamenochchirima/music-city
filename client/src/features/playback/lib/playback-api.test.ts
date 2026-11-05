import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  prime: vi.fn(),
  peek: vi.fn(),
  activate: vi.fn(),
}));

vi.mock("@/lib/api/http-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/http-client")>();
  return {
    ...actual,
    httpClient: { get: mocks.get, post: mocks.post },
  };
});

vi.mock("./audio-preloader", () => ({
  audioPreloader: {
    prime: mocks.prime,
    peek: mocks.peek,
    activate: mocks.activate,
  },
}));

import { ApiClientError } from "@/lib/api/http-client";
import { playbackApi } from "./playback-api";

const guestIdentityKey = "music-city-guest-playback-token";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it("replaces an expired guest token and retries background audio preloading", async () => {
  localStorage.setItem(guestIdentityKey, "expired-guest-token");
  let loadTrack: (trackId: string) => Promise<unknown> = async () => undefined;
  mocks.prime.mockImplementation(
    (_trackIds: string[], _actor: string, load: typeof loadTrack) => {
      loadTrack = load;
    },
  );
  mocks.get.mockResolvedValue({ guestIdentityToken: "fresh-guest-token" });
  mocks.post
    .mockRejectedValueOnce(new ApiClientError("Invalid guest identity", 401))
    .mockResolvedValueOnce({ ticket: "fresh-ticket" });

  playbackApi.preloadTrackIds(undefined, ["track-1"]);
  await expect(loadTrack("track-1")).resolves.toEqual({ ticket: "fresh-ticket" });

  expect(mocks.get).toHaveBeenCalledWith("/playback/guest-identity");
  expect(mocks.post).toHaveBeenNthCalledWith(
    1,
    "/playback/preload",
    { trackId: "track-1" },
    undefined,
    { "X-Guest-Playback": "expired-guest-token" },
  );
  expect(mocks.post).toHaveBeenNthCalledWith(
    2,
    "/playback/preload",
    { trackId: "track-1" },
    undefined,
    { "X-Guest-Playback": "fresh-guest-token" },
  );
  expect(localStorage.getItem(guestIdentityKey)).toBe("fresh-guest-token");
});

it("retries guest playback without a stale preload ticket", async () => {
  localStorage.setItem(guestIdentityKey, "expired-guest-token");
  mocks.peek.mockReturnValue({ ticket: "stale-ticket" });
  mocks.get.mockResolvedValue({ guestIdentityToken: "fresh-guest-token" });
  mocks.post
    .mockRejectedValueOnce(new ApiClientError("Invalid guest identity", 401))
    .mockResolvedValueOnce({
      playbackSession: {
        id: "session-1",
        token: "playback-token",
        streamUrl: "https://media.example.test/track",
      },
    });

  await expect(playbackApi.createSession(undefined, "track-1")).resolves.toMatchObject({
    id: "session-1",
    streamUrl: "https://media.example.test/track",
  });

  expect(mocks.post).toHaveBeenNthCalledWith(
    1,
    "/playback/sessions",
    { trackId: "track-1", preloadTicket: "stale-ticket" },
    undefined,
    { "X-Guest-Playback": "expired-guest-token" },
  );
  expect(mocks.post).toHaveBeenNthCalledWith(
    2,
    "/playback/sessions",
    { trackId: "track-1" },
    undefined,
    { "X-Guest-Playback": "fresh-guest-token" },
  );
  expect(localStorage.getItem(guestIdentityKey)).toBe("fresh-guest-token");
});
