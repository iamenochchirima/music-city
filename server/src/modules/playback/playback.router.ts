import {
  createPlaybackSessionSchema,
  recordPlaybackEventSchema,
} from "@music-city/shared";
import { Router } from "express";
import { Readable } from "node:stream";

import { createRateLimit } from "../../middleware/rate-limit.js";
import { optionalSession } from "../../middleware/optional-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { entitlementsService } from "../entitlements/entitlements.service.js";
import { engagementService } from "../engagement/engagement.service.js";
import { tracksService } from "../tracks/tracks.service.js";
import { usersService } from "../users/users.service.js";
import { playbackService } from "./playback.service.js";
import { tokenService } from "../../services/token.service.js";
import { storageService } from "../../services/storage.service.js";
import { guestPlaybackRepository } from "./guest-playback.repository.js";
import { env } from "../../config/env.js";

import { playbackPreload } from "./playback-preload.js";

const playbackRouter = Router();
const playbackEventRateLimit = createRateLimit({
  bucketName: "playback-events",
  maxRequests: 240,
  windowMs: 60_000,
});
const playbackSessionRateLimit = createRateLimit({
  bucketName: "playback-sessions",
  maxRequests: 30,
  windowMs: 60_000,
});
const playbackGuestRateLimit = createRateLimit({
  bucketName: "guest-playback-sessions",
  maxRequests: 30,
  windowMs: 60_000,
});
const playbackMediaRateLimit = createRateLimit({
  bucketName: "playback-media",
  maxRequests: 1_200,
  windowMs: 60_000,
});

playbackRouter.use((_request, response, next) => {
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});

playbackRouter.get("/guest-identity", playbackGuestRateLimit, (_request, response) => {
  if (!env.GUEST_PLAYBACK_ENABLED) throw new HttpError(503, "Guest playback is unavailable");
  response.json({ guestIdentityToken: tokenService.createGuestIdentity().token });
});

const preloadRateLimit = createRateLimit({bucketName:"playback-preload",maxRequests:120,windowMs:60_000});
playbackRouter.post("/preload", optionalSession, preloadRateLimit, asyncHandler(async(request,response)=>{
  const input=createPlaybackSessionSchema.parse(request.body);
  const track=await tracksService.getTrackForPlayback(input.trackId);
  if(!track?.playbackReady)throw new HttpError(404,"Track not found");
  let actor:string;
  if(request.session){
    if(!await entitlementsService.canPlayTrack(request.session.walletAddress,track.id))throw new HttpError(403,"You do not have access to this track");
    actor=`wallet:${request.session.walletAddress}`;
  }else{
    if(!env.GUEST_PLAYBACK_ENABLED||!await tracksService.isTrackPublic(track.id))throw new HttpError(403,"Sign in to listen to this track");
    actor=`guest:${tokenService.verifyGuestIdentity(String(request.headers["x-guest-playback"]??""))}`;
  }
  response.setHeader("Cache-Control","no-store");
  response.json(await playbackPreload.prepare(track,actor));
}));

playbackRouter.post(
  "/sessions",
  optionalSession,
  playbackGuestRateLimit,
  playbackSessionRateLimit,
  asyncHandler(async (request, response) => {
    const input = createPlaybackSessionSchema.parse(request.body);
    const track = await tracksService.getTrackForPlayback(input.trackId);

    if (!track) {
      throw new HttpError(404, "Track not found");
    }

    let listenerUserId: string | undefined;
    let guestId: string | undefined;
    let guestIdentityToken: string | undefined;
    if (request.session) {
      const canPlay = await entitlementsService.canPlayTrack(request.session.walletAddress, input.trackId);
      if (!canPlay) throw new HttpError(403, "You do not have access to this track");
      const profile = await usersService.getProfile(request.session.walletAddress);
      if (!profile) throw new HttpError(401, "Profile not found");
      listenerUserId = profile.id;
    } else {
      if (!env.GUEST_PLAYBACK_ENABLED) throw new HttpError(403, "Sign in to listen to this track");
      const suppliedIdentity = String(request.headers["x-guest-playback"] ?? "");
      if (suppliedIdentity) {
        guestId = tokenService.verifyGuestIdentity(suppliedIdentity);
        guestIdentityToken = suppliedIdentity;
      } else {
        const identity = tokenService.createGuestIdentity();
        guestId = identity.guestId;
        guestIdentityToken = identity.token;
      }
      if (!(await tracksService.isTrackPublic(track.id))) {
        throw new HttpError(404, "Track not found");
      }
    }

    const playbackSession = await playbackService.createSession(input.trackId, listenerUserId, guestId);
    const clientSession = playbackSession.guestIdHash
      ? {
          ...playbackSession,
          guestIdHash: undefined,
          isGuest: true,
          ...(playbackSession.provider === "mux"
            ? { streamUrl: `${env.APP_BASE_URL}/api/v1/playback/sessions/${encodeURIComponent(playbackSession.id)}/manifest.m3u8?token=${encodeURIComponent(playbackSession.token)}` }
            : {}),
        }
      : playbackSession;

    const preloadKey=input.preloadTicket ? playbackPreload.unlock(input.preloadTicket,track,request.session ? `wallet:${request.session.walletAddress}` : `guest:${guestId}`) : null;
    response.setHeader("Cache-Control","no-store");
    response.status(201).json({
      playbackSession: clientSession,
      ...(preloadKey ? {preloadKey} : {}),
      ...(guestIdentityToken ? { guestIdentityToken } : {}),
    });
  }),
);

playbackRouter.post(
  "/sessions/:sessionId/events",
  optionalSession,
  playbackEventRateLimit,
  asyncHandler(async (request, response) => {
    const session = await playbackService.getSession(
      String(request.params.sessionId),
      String(request.body?.token ?? ""),
    );
    if (session.listenerUserId) {
      const profile = request.session
        ? await usersService.getProfile(request.session.walletAddress)
        : null;
      if (!profile || session.listenerUserId !== profile.id) {
        throw new HttpError(403, "Playback session does not belong to this user");
      }
    } else if (!session.guestIdHash) {
      throw new HttpError(403, "Playback session does not belong to this listener");
    }

    const playbackSession = await engagementService.recordPlaybackEvent(
      session,
      recordPlaybackEventSchema.parse(request.body),
    );
    if (
      session.guestIdHash &&
      session.guestTrackDurationSeconds
    ) {
      await guestPlaybackRepository.addListenedSeconds(
        session.guestIdHash,
        Math.max(0, (playbackSession.listenedSeconds ?? 0) - (session.listenedSeconds ?? 0)),
      );
    }

    response.json({ playbackSession: { ...playbackSession, guestIdHash: undefined, isGuest: Boolean(playbackSession.guestIdHash) } });
  }),
);

playbackRouter.get(
  "/sessions/:sessionId/manifest.m3u8",
  playbackMediaRateLimit,
  asyncHandler(async (request, response) => {
    const token = String(request.query.token ?? "");
    const manifest = await playbackService.getManifest(
      String(request.params.sessionId),
      token,
    );

    response.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    response.setHeader("Cache-Control", "no-store");
    response.send(manifest);
  }),
);

playbackRouter.get(
  "/sessions/:sessionId/segment",
  playbackMediaRateLimit,
  asyncHandler(async (request, response) => {
    const token = String(request.query.token ?? "");
    const resource = String(request.query.resource ?? "");
    if (!resource) throw new HttpError(400, "Media segment is required");
    const segment = await playbackService.getMuxSegment(String(request.params.sessionId), token, resource);
    response.setHeader("Content-Type", segment.headers.get("content-type") ?? "audio/mp2t");
    response.setHeader("Cache-Control", "no-store");
    response.status(segment.status);
    Readable.fromWeb(segment.body as import("node:stream/web").ReadableStream).pipe(response);
  }),
);

playbackRouter.get(
  "/sessions/:sessionId/media",
  playbackMediaRateLimit,
  asyncHandler(async (request, response) => {
    const token = String(request.query.token ?? "");
    const session = await playbackService.getSession(String(request.params.sessionId), token);
    if (session.provider === "mux") {
      const url = await playbackService.getMediaRedirect(session.id, token);
      if (!url) throw new HttpError(404, "Media not found");
      response.redirect(url);
      return;
    }
    const track = await tracksService.getTrackForPlayback(session.trackId);
    if (!track?.masterStorageKey) throw new HttpError(404, "Media not found");
    const authorization = await playbackService.getLocalMediaAuthorization(track.masterStorageKey, session.id, token);
    const metadata = await storageService.getStoredObjectMetadata(track.masterStorageKey, track.sourceFileName);
    const maxBytes = Math.max(1, Math.floor(metadata.sizeBytes * authorization.maxFraction));
    const range = request.headers.range;
    let start = 0;
    let end = maxBytes - 1;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) throw new HttpError(416, "Invalid media range");
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), maxBytes - 1) : maxBytes - 1;
      if (!Number.isSafeInteger(start) || start < 0 || start >= maxBytes || end < start) {
        response.setHeader("Content-Range", `bytes */${maxBytes}`);
        throw new HttpError(416, "Media range exceeds guest allowance");
      }
    }
    const media = await storageService.openStoredObjectRange(track.masterStorageKey, start, end);
    response.status(range ? 206 : 200);
    response.setHeader("Content-Type", media.contentType);
    response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("Content-Length", String(end - start + 1));
    if (range) response.setHeader("Content-Range", `bytes ${start}-${end}/${metadata.sizeBytes}`);
    response.setHeader("Cache-Control", "no-store");
    media.stream.on("error", () => response.destroy());
    media.stream.pipe(response);
  }),
);

export { playbackRouter };
