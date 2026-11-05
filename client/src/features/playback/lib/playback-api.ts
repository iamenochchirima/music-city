import type {
  PlaybackPreload,
  PlaybackSession,
  RecordPlaybackEventInput,
  TrackSummary,
} from "@music-city/shared";

import { ApiClientError, httpClient } from "@/lib/api/http-client";
import { clientEnv } from "@/lib/config/env";

import { audioPreloader } from "./audio-preloader";

const GUEST_IDENTITY_KEY = "music-city-guest-playback-token";

const readGuestIdentityToken = () =>
  typeof window === "undefined"
    ? null
    : window.localStorage.getItem(GUEST_IDENTITY_KEY);
let guestIdentityPromise: Promise<string> | null = null;

const ensureGuestIdentityToken = async () => {
  const existing = readGuestIdentityToken();
  if (existing) return existing;
  if (!guestIdentityPromise) {
    guestIdentityPromise = httpClient
      .get<{ guestIdentityToken: string }>("/playback/guest-identity")
      .then(({ guestIdentityToken }) => {
        if (typeof window !== "undefined")
          window.localStorage.setItem(GUEST_IDENTITY_KEY, guestIdentityToken);
        return guestIdentityToken;
      })
      .finally(() => {
        guestIdentityPromise = null;
      });
  }
  return guestIdentityPromise;
};

const isUnauthorizedGuestRequest = (error: unknown) =>
  error instanceof ApiClientError && error.status === 401;

const refreshGuestIdentityToken = async (expiredToken: string) => {
  if (typeof window === "undefined") return ensureGuestIdentityToken();
  if (readGuestIdentityToken() === expiredToken)
    window.localStorage.removeItem(GUEST_IDENTITY_KEY);
  return ensureGuestIdentityToken();
};

const withGuestIdentityRetry = async <T>(
  request: (guestToken: string, isRetry: boolean) => Promise<T>,
) => {
  let guestToken = await ensureGuestIdentityToken();
  try {
    return await request(guestToken, false);
  } catch (error) {
    if (!isUnauthorizedGuestRequest(error) || typeof window === "undefined")
      throw error;
    guestToken = await refreshGuestIdentityToken(guestToken);
    return request(guestToken, true);
  }
};

const resolveStreamUrl = (streamUrl: string) => {
  if (/^https?:\/\//i.test(streamUrl)) {
    return streamUrl;
  }

  return new URL(streamUrl, new URL(clientEnv.apiBaseUrl).origin).toString();
};

export const playbackApi = {
  getGuestIdentityToken: readGuestIdentityToken,

  preloadTracks(token: string | undefined, tracks: TrackSummary[]) {
    this.preloadTrackIds(
      token,
      tracks.filter((track) => track.playbackReady).map((track) => track.id),
    );
  },

  preloadTrackIds(token: string | undefined, trackIds: string[]) {
    audioPreloader.prime(trackIds, token ?? "guest", async (trackId) => {
      if (token)
        return httpClient.post<PlaybackPreload>("/playback/preload", { trackId }, token);
      return withGuestIdentityRetry((guestToken) =>
        httpClient.post<PlaybackPreload>(
          "/playback/preload",
          { trackId },
          undefined,
          { "X-Guest-Playback": guestToken },
        ),
      );
    });
  },

  async createSession(token: string | undefined, trackId: string) {
    const prepared = audioPreloader.peek(trackId, token ?? "guest");
    const create = (guestToken?: string, isRetry = false) =>
      httpClient.post<{
        playbackSession: PlaybackSession;
        guestIdentityToken?: string;
        preloadKey?: string;
      }>(
        "/playback/sessions",
        {
          trackId,
          ...(prepared && !isRetry ? { preloadTicket: prepared.ticket } : {}),
        },
        token,
        !token && guestToken ? { "X-Guest-Playback": guestToken } : {},
      );
    let response;
    response = token
      ? await create()
      : await withGuestIdentityRetry((guestToken, isRetry) =>
          create(guestToken, isRetry),
        );

    const playbackSession = {
      ...response.playbackSession,
      streamUrl: resolveStreamUrl(response.playbackSession.streamUrl),
    };
    if (prepared && response.preloadKey) {
      try {
        await audioPreloader.activate(
          trackId,
          prepared,
          response.preloadKey,
          playbackSession,
          token ?? "guest",
        );
      } catch {
        /* Playback remains authorized when a speculative buffer expires or is unavailable. */
      }
    }
    return playbackSession;
  },

  async recordEvent(
    token: string | undefined,
    playbackSession: PlaybackSession,
    input: RecordPlaybackEventInput,
  ) {
    const response = await httpClient.post<{
      playbackSession: PlaybackSession;
    }>(
      `/playback/sessions/${playbackSession.id}/events`,
      { ...input, token: playbackSession.token },
      token,
      !token && readGuestIdentityToken()
        ? { "X-Guest-Playback": readGuestIdentityToken()! }
        : {},
    );
    return response.playbackSession;
  },
};
