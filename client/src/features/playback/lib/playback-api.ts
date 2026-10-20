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
      const guestToken = token ? null : await ensureGuestIdentityToken();
      return httpClient.post<PlaybackPreload>(
        "/playback/preload",
        { trackId },
        token,
        guestToken ? { "X-Guest-Playback": guestToken } : {},
      );
    });
  },

  async createSession(token: string | undefined, trackId: string) {
    const prepared = audioPreloader.peek(trackId, token ?? "guest");
    let guestToken = token ? null : await ensureGuestIdentityToken();
    const create = () =>
      httpClient.post<{
        playbackSession: PlaybackSession;
        guestIdentityToken?: string;
        preloadKey?: string;
      }>(
        "/playback/sessions",
        { trackId, ...(prepared ? { preloadTicket: prepared.ticket } : {}) },
        token,
        guestToken ? { "X-Guest-Playback": guestToken } : {},
      );
    let response;
    try {
      response = await create();
    } catch (error) {
      if (
        token ||
        !(error instanceof ApiClientError) ||
        error.status !== 401 ||
        typeof window === "undefined"
      )
        throw error;
      window.localStorage.removeItem(GUEST_IDENTITY_KEY);
      guestToken = await ensureGuestIdentityToken();
      response = await create();
    }

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
