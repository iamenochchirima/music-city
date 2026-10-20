import type { PlaybackSession, TrackPlaybackStartedEvent } from "@music-city/shared";
import { createHash } from "node:crypto";

import { env } from "../../config/env.js";
import { createId } from "../../services/id.service.js";
import { muxService } from "../../services/mux.service.js";
import { tokenService } from "../../services/token.service.js";
import { storageService } from "../../services/storage.service.js";
import { logger } from "../../utils/logger.js";
import { HttpError } from "../../utils/http-error.js";
import { playbackRepository } from "./playback.repository.js";
import { tracksService } from "../tracks/tracks.service.js";
import { guestPlaybackRepository } from "./guest-playback.repository.js";

const expiresInMinutes = (minutes: number) =>
  new Date(Date.now() + minutes * 60 * 1000).toISOString();

const guestHash = (guestId: string) =>
  createHash("sha256").update(`${env.PLAYBACK_TOKEN_SECRET}:${guestId}`).digest("hex");

const getMediaPath = (id: string, token: string) =>
  `${env.APP_BASE_URL}/api/v1/playback/sessions/${encodeURIComponent(id)}/media?token=${encodeURIComponent(token)}`;

const runtimeSeconds = (runtime: string) => {
  const match = runtime.match(/^(\d+):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 3600;
};

const resolveTrackPlaybackUrl = (track: {
  mediaProvider?: "local" | "mux";
  mediaStorageProvider?: "local" | "s3";
  streamMediaUrl?: string;
  masterStorageKey?: string;
}) => {
  if (track.mediaProvider !== "mux" && track.masterStorageKey) {
    return storageService.getDownloadUrl(track.masterStorageKey, track.mediaStorageProvider);
  }

  return track.streamMediaUrl;
};

export const playbackService = {
  async createSession(trackId: string, listenerUserId?: string, guestId?: string) {
    const track = await tracksService.getTrackForPlayback(trackId);

    if (!track?.playbackReady) {
      throw new HttpError(404, "Track media is not available");
    }

    const id = createId("ply");
    const guestIdHash = guestId ? guestHash(guestId) : undefined;
    const guestTrackDurationSeconds = guestIdHash ? runtimeSeconds(track.runtime) : undefined;
    const guestAllowance = guestIdHash
      ? await guestPlaybackRepository.claimTime(guestIdHash, guestTrackDurationSeconds!)
      : undefined;
    if (guestAllowance && guestAllowance.remainingSeconds <= 0) {
      throw new HttpError(429, "Guest listening limit reached. Sign in to keep listening.");
    }
    const token = tokenService.issuePlaybackToken({ playbackSessionId: id, trackId, guestIdHash });
    const createdAt = new Date().toISOString();
    let session: PlaybackSession;

    if (track.mediaProvider === "mux" && track.muxPlaybackId) {
      const streamUrl = await muxService.createPlaybackUrl(track.muxPlaybackId);

      session = {
        id,
        trackId,
        artistId: track.artistId,
        ...(listenerUserId ? { listenerUserId } : {}),
        provider: "mux",
        streamUrl,
        playbackId: track.muxPlaybackId,
        token,
        expiresAt: expiresInMinutes(24 * 60),
        createdAt,
        maxPositionSeconds: 0,
        listenedSeconds: 0,
        lastPlaybackEventAt: createdAt,
        ...(guestIdHash ? {
          guestIdHash,
          isGuest: true,
          guestLimitSeconds: guestAllowance?.maximumSeconds,
          guestRemainingSeconds: guestAllowance?.remainingSeconds,
          guestBudgetRemainingSeconds: guestAllowance?.budgetRemainingSeconds,
          guestTrackDurationSeconds,
        } : {}),
      };
    } else {
      const sourceUrl = resolveTrackPlaybackUrl(track);

      if (!sourceUrl) {
        throw new HttpError(404, "Track playback URL is not available");
      }

      const streamUrl = getMediaPath(id, token);

      session = {
        id,
        trackId,
        artistId: track.artistId,
        ...(listenerUserId ? { listenerUserId } : {}),
        provider: "local",
        streamUrl,
        token,
        expiresAt: expiresInMinutes(24 * 60),
        createdAt,
        maxPositionSeconds: 0,
        listenedSeconds: 0,
        lastPlaybackEventAt: createdAt,
        ...(guestIdHash ? {
          guestIdHash,
          isGuest: true,
          guestLimitSeconds: guestAllowance?.maximumSeconds,
          guestRemainingSeconds: guestAllowance?.remainingSeconds,
          guestBudgetRemainingSeconds: guestAllowance?.budgetRemainingSeconds,
          guestTrackDurationSeconds,
        } : {}),
      };
    }

    const savedSession = await playbackRepository.upsert(session);
    const { engagementRepository } = await import("../engagement/engagement.repository.js");
    const occurredAt = new Date().toISOString();

    try {
      await engagementRepository.insertPlaybackEvent(
        createId("evt"),
        savedSession.id,
        savedSession.trackId,
        track.artistId,
        listenerUserId ?? null,
        "started",
        0,
        null,
        occurredAt,
        {
          trackId: savedSession.trackId,
          artistId: track.artistId,
          listenerUserId: listenerUserId ?? null,
        },
      );
    } catch (error) {
      logger.warn("Playback session started without playback event persistence", {
        playbackSessionId: savedSession.id,
        trackId: savedSession.trackId,
        listenerUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const analyticsEvent: TrackPlaybackStartedEvent = {
      id: createId("anl"),
      eventType: "track_playback_started",
      occurredAt,
      actorUserId: listenerUserId,
      artistId: track.artistId,
      trackId: savedSession.trackId,
      sessionId: savedSession.id,
      source: "server.playback",
      surface: "global_playback_provider",
    };

    try {
      await engagementRepository.insertAnalyticsEvent(analyticsEvent);
    } catch (error) {
      logger.warn("Playback session started without analytics event persistence", {
        playbackSessionId: savedSession.id,
        trackId: savedSession.trackId,
        listenerUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return savedSession;
  },

  async getSession(id: string, token: string) {
    const session = await playbackRepository.findById(id);

    if (!session) {
      throw new HttpError(404, "Playback session not found");
    }

    const claims = tokenService.verifyPlaybackToken(token);

    if (
      claims.playbackSessionId !== id ||
      claims.trackId !== session.trackId ||
      claims.guestIdHash !== session.guestIdHash
    ) {
      throw new HttpError(401, "Playback token does not match the session");
    }

    if (session.guestIdHash && !env.GUEST_PLAYBACK_ENABLED) {
      throw new HttpError(403, "Guest playback is unavailable");
    }

    if (Date.parse(session.expiresAt) < Date.now()) {
      throw new HttpError(401, "Playback session expired");
    }

    return session;
  },

  async getManifest(sessionId: string, token: string) {
    const session = await this.getSession(sessionId, token);
    const track = await tracksService.getTrackForPlayback(session.trackId);

    if (!track?.playbackReady) {
      throw new HttpError(404, "Track media is not available");
    }

    if (session.provider === "mux" && session.guestIdHash) {
      return this.getMuxManifest(session, token);
    }

    const baseUrl = resolveTrackPlaybackUrl(track);

    if (!baseUrl) {
      throw new HttpError(404, "Track playback URL is not available");
    }

    const segmentUrl = getMediaPath(session.id, token);

    return [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXT-X-TARGETDURATION:30",
      "#EXT-X-MEDIA-SEQUENCE:0",
      "#EXTINF:30.0,",
      segmentUrl,
      "#EXT-X-ENDLIST",
      "",
    ].join("\n");
  },

  async getMediaRedirect(sessionId: string, token: string) {
    const session = await this.getSession(sessionId, token);

    if (session.provider === "mux") {
      if (session.guestIdHash) {
        throw new HttpError(403, "Guest media must use the bounded playback manifest");
      }
      return session.streamUrl;
    }
    throw new HttpError(404, "Media redirect is not available for this session");
  },

  async getLocalMediaAuthorization(storageKey: string, sessionId: string, token: string) {
    const session = await this.getSession(sessionId, token);
    const track = await tracksService.getTrackForPlayback(session.trackId);
    if (!track?.playbackReady || track.masterStorageKey !== storageKey) {
      throw new HttpError(404, "Media not found");
    }
    if (session.guestIdHash && !(await tracksService.isTrackPublic(track.id))) {
      throw new HttpError(404, "Media not found");
    }
    const remainingFraction = session.guestRemainingSeconds !== undefined && session.guestTrackDurationSeconds
      ? session.guestRemainingSeconds / session.guestTrackDurationSeconds
      : 1;
    return { session, track, maxFraction: Math.min(1, remainingFraction) };
  },

  async getMuxManifest(session: PlaybackSession, token: string) {
    const masterResponse = await fetch(session.streamUrl);
    if (!masterResponse.ok) throw new HttpError(502, "Media provider could not load the playlist");
    const masterText = await masterResponse.text();
    const firstUri = masterText.split(/\r?\n/).find((line) => line && !line.startsWith("#"));
    const hasVariants = masterText.includes("#EXT-X-STREAM-INF:");
    const playlist = hasVariants && firstUri ? new URL(firstUri, session.streamUrl) : new URL(session.streamUrl);
    const muxToken = new URL(session.streamUrl).searchParams.get("token");
    const playlistUrl = playlist.toString();
    const playlistResponse = hasVariants ? await fetch(playlistUrl) : null;
    if (playlistResponse && !playlistResponse.ok) throw new HttpError(502, "Media provider could not load the track playlist");
    const playlistText = playlistResponse ? await playlistResponse.text() : masterText;
    const rows = playlistText.split(/\r?\n/);
    const durations = rows.flatMap((row) => row.startsWith("#EXTINF:")
      ? [Number(row.slice(8).split(",")[0])]
      : []);
    const playlistDuration = durations.reduce((total, item) => total + item, 0);
    const maximumSeconds = Math.min(playlistDuration, session.guestRemainingSeconds ?? Number.POSITIVE_INFINITY);
    let position = 0;
    let currentDuration = 0;
    const output: string[] = [];
    for (const row of rows) {
      if (row.startsWith("#EXTINF:")) {
        currentDuration = Number(row.slice(8).split(",")[0]);
        if (position + currentDuration > maximumSeconds) break;
        output.push(row);
      } else if (row && !row.startsWith("#")) {
        if (position + currentDuration > maximumSeconds) break;
        const segment = new URL(row, playlistUrl);
        if (muxToken && segment.searchParams.get("token") === muxToken) {
          segment.searchParams.delete("token");
        }
        output.push(`${env.APP_BASE_URL}/api/v1/playback/sessions/${encodeURIComponent(session.id)}/segment?token=${encodeURIComponent(token)}&resource=${encodeURIComponent(segment.toString())}`);
        position += currentDuration;
        currentDuration = 0;
      } else if (row.startsWith("#") && row.includes("URI=\"")) {
        output.push(row.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          const mediaResource = new URL(uri, playlistUrl);
          if (muxToken && mediaResource.searchParams.get("token") === muxToken) {
            mediaResource.searchParams.delete("token");
          }
          const resource = mediaResource.toString();
          return `URI="${env.APP_BASE_URL}/api/v1/playback/sessions/${encodeURIComponent(session.id)}/segment?token=${encodeURIComponent(token)}&resource=${encodeURIComponent(resource)}"`;
        }));
      } else if (row.startsWith("#") && row !== "#EXT-X-ENDLIST") {
        output.push(row);
      } else if (row === "#EXT-X-ENDLIST") {
        continue;
      }
    }
    output.push("#EXT-X-ENDLIST", "");
    return output.join("\n");
  },

  async getMuxSegment(sessionId: string, token: string, resource: string) {
    const session = await this.getSession(sessionId, token);
    if (session.provider !== "mux") throw new HttpError(404, "Media not found");
    const requested = new URL(resource);
    const source = new URL(session.streamUrl);
    if (requested.protocol !== "https:" || !requested.hostname.endsWith(".mux.com")) {
      throw new HttpError(404, "Media not found");
    }
    const manifest = await this.getMuxManifest(session, token);
    if (!manifest.includes(encodeURIComponent(requested.toString()))) {
      throw new HttpError(403, "Media segment is outside the guest allowance");
    }
    const muxToken = source.searchParams.get("token");
    if (muxToken && requested.hostname === "stream.mux.com" && !requested.searchParams.has("token")) {
      requested.searchParams.set("token", muxToken);
    }
    const response = await fetch(requested);
    if (!response.ok || !response.body) throw new HttpError(502, "Media provider could not load this segment");
    return response;
  },
};
