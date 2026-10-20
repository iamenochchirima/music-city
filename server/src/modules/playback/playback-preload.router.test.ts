import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/preload_test";
const { playbackRouter } = await import("./playback.router.js");
const { playbackPreload } = await import("./playback-preload.js");
const { playbackService } = await import("./playback.service.js");
const { tracksService } = await import("../tracks/tracks.service.js");
const { entitlementsService } = await import(
  "../entitlements/entitlements.service.js"
);
const { tokenService } = await import("../../services/token.service.js");
const { HttpError } = await import("../../utils/http-error.js");
const { env } = await import("../../config/env.js");
test("preload HTTP authorization never starts playback or reserves a guest slot", async () => {
  const original = {
    prepare: playbackPreload.prepare,
    create: playbackService.createSession,
    track: tracksService.getTrackForPlayback,
    public: tracksService.isTrackPublic,
    canPlay: entitlementsService.canPlayTrack,
    enabled: env.GUEST_PLAYBACK_ENABLED,
  };
  let publicTrack = true,
    allowed = true,
    started = 0;
  const actors: string[] = [];
  env.GUEST_PLAYBACK_ENABLED = true;
  tracksService.getTrackForPlayback = async () =>
    ({ id: "track", playbackReady: true }) as never;
  tracksService.isTrackPublic = async () => publicTrack;
  entitlementsService.canPlayTrack = async () => allowed;
  playbackService.createSession = async () => {
    started++;
    throw new Error("Must not create sessions during preparation");
  };
  playbackPreload.prepare = async (_track, actor) => {
    actors.push(actor);
    return {
      ticket: "ticket",
      iv: "iv",
      ciphertext: "encrypted",
      expiresAt: new Date().toISOString(),
    };
  };
  const app = express();
  app.use(express.json());
  app.use("/playback", playbackRouter);
  app.use(
    (
      error: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) =>
      res
        .status(error instanceof HttpError ? error.statusCode : 500)
        .json({ message: error.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const request = (headers: Record<string, string> = {}) =>
    fetch(`http://127.0.0.1:${address.port}/playback/preload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ trackId: "track" }),
    });
  const token = tokenService.issueSession({
    walletAddress: "G" + "B".repeat(55),
    displayName: "Listener",
    artistAccess: false,
    primaryIntent: "listener",
    onboardingStatus: "complete",
    onboardingStep: "complete",
    onboardingVersion: 1,
    profileCompletion: {
      percentage: 100,
      completed: [],
      missing: [],
      requiredComplete: true,
    },
  });
  try {
    assert.equal((await request()).status, 401);
    const guest = tokenService.createGuestIdentity();
    const prepared = await request({ "X-Guest-Playback": guest.token });
    assert.equal(prepared.status, 200);
    assert.equal(prepared.headers.get("cache-control"), "no-store");
    assert.equal(actors[0], `guest:${guest.guestId}`);
    assert.equal(started, 0);
    publicTrack = false;
    assert.equal(
      (await request({ "X-Guest-Playback": guest.token })).status,
      403,
    );
    assert.equal(
      (await request({ Authorization: `Bearer ${token}` })).status,
      200,
    );
    assert.equal(actors[1], "wallet:G" + "B".repeat(55));
    allowed = false;
    assert.equal(
      (await request({ Authorization: `Bearer ${token}` })).status,
      403,
    );
    assert.equal(started, 0);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    playbackPreload.prepare = original.prepare;
    playbackService.createSession = original.create;
    tracksService.getTrackForPlayback = original.track;
    tracksService.isTrackPublic = original.public;
    entitlementsService.canPlayTrack = original.canPlay;
    env.GUEST_PLAYBACK_ENABLED = original.enabled;
  }
});
