import type { PlaybackSession, TrackPlaybackStartedEvent } from "@music-city/shared";

import { createId } from "../../services/id.service.js";
import { muxService } from "../../services/mux.service.js";
import { tokenService } from "../../services/token.service.js";
import { storageService } from "../../services/storage.service.js";
import { logger } from "../../utils/logger.js";
import { HttpError } from "../../utils/http-error.js";
import { playbackRepository } from "./playback.repository.js";
import { tracksService } from "../tracks/tracks.service.js";

const expiresInMinutes = (minutes: number) =>
  new Date(Date.now() + minutes * 60 * 1000).toISOString();

const resolveTrackPlaybackUrl = (track: {
  mediaProvider?: "local" | "mux";
  streamMediaUrl?: string;
  masterStorageKey?: string;
}) => {
  if (track.mediaProvider !== "mux" && track.masterStorageKey) {
    return storageService.getDownloadUrl(track.masterStorageKey);
  }

  return track.streamMediaUrl;
};

export const playbackService = {
  async createSession(trackId: string, listenerUserId: string) {
    const track = await tracksService.getTrackForPlayback(trackId);

    if (!track?.playbackReady) {
      throw new HttpError(404, "Track media is not available");
    }

    const id = createId("ply");
    const token = tokenService.issuePlaybackToken({ playbackSessionId: id, trackId });
    let session: PlaybackSession;

    if (track.mediaProvider === "mux" && track.muxPlaybackId) {
      const streamUrl = await muxService.createPlaybackUrl(track.muxPlaybackId);

      session = {
        id,
        trackId,
        artistId: track.artistId,
        listenerUserId,
        provider: "mux",
        streamUrl,
        playbackId: track.muxPlaybackId,
        token,
        expiresAt: expiresInMinutes(15),
        createdAt: new Date().toISOString(),
        maxPositionSeconds: 0,
      };
    } else {
      const streamUrl = resolveTrackPlaybackUrl(track);

      if (!streamUrl) {
        throw new HttpError(404, "Track playback URL is not available");
      }

      session = {
        id,
        trackId,
        artistId: track.artistId,
        listenerUserId,
        provider: "local",
        streamUrl,
        token,
        expiresAt: expiresInMinutes(5),
        createdAt: new Date().toISOString(),
        maxPositionSeconds: 0,
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
        listenerUserId,
        "started",
        0,
        null,
        occurredAt,
        {
          trackId: savedSession.trackId,
          artistId: track.artistId,
          listenerUserId,
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

    if (claims.playbackSessionId !== id || claims.trackId !== session.trackId) {
      throw new HttpError(401, "Playback token does not match the session");
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

    const baseUrl = resolveTrackPlaybackUrl(track);

    if (!baseUrl) {
      throw new HttpError(404, "Track playback URL is not available");
    }

    const segmentUrl = `${baseUrl}${
      baseUrl.includes("?") ? "&" : "?"
    }playbackSession=${encodeURIComponent(session.id)}`;

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
      return session.streamUrl;
    }

    const track = await tracksService.getTrackForPlayback(session.trackId);

    if (!track?.playbackReady) {
      throw new HttpError(404, "Track media is not available");
    }

    const streamUrl = resolveTrackPlaybackUrl(track);

    if (!streamUrl) {
      throw new HttpError(404, "Track media is not available");
    }

    return streamUrl;
  },
};
