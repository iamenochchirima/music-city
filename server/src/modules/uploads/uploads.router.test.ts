import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { basename, dirname, relative, resolve } from "node:path";
import test from "node:test";
import express from "express";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const { uploadsRouter } = await import("./uploads.router.js");
const { env } = await import("../../config/env.js");
const { storageService } = await import("../../services/storage.service.js");
const { HttpError } = await import("../../utils/http-error.js");
const { uploadsService } = await import("./uploads.service.js");
const { tracksService } = await import("../tracks/tracks.service.js");
const { tokenService } = await import("../../services/token.service.js");

const restore = <T extends object, K extends keyof T>(target: T, key: K, replacement: T[K]) => {
  const original = target[key];
  target[key] = replacement;
  return () => { target[key] = original; };
};

test("public media route rejects traversal and still serves valid byte ranges", async () => {
  const originalStorageProvider = env.STORAGE_PROVIDER;
  env.STORAGE_PROVIDER = "local";
  const mediaRoot = resolve(process.cwd(), env.LOCAL_MEDIA_ROOT);
  const outsidePath = resolve(process.cwd(), "music-city-path-traversal-sentinel.txt");
  const outsideKey = relative(mediaRoot, outsidePath).split("\\").join("/");
  const validKey = "beta-hardening-tests/valid-object.bin";
  const validPath = storageService.getLocalPath(validKey);
  const audioKey = "beta-hardening-tests/valid-audio.mp3";
  const audioPath = storageService.getLocalPath(audioKey);
  const validCoverKey = "beta-hardening-tests/valid-cover.webp";
  const validCoverPath = storageService.getLocalPath(validCoverKey);

  await mkdir(dirname(outsidePath), { recursive: true });
  await mkdir(dirname(validPath), { recursive: true });
  await writeFile(outsidePath, "outside-media-secret-sentinel");
  await writeFile(validPath, "abcdef");
  await writeFile(audioPath, "audio-bytes");
  const coverBytes = Buffer.from("RIFF0000WEBP");
  await writeFile(validCoverPath, coverBytes);

  const app = express();
  app.use("/api/v1/uploads", uploadsRouter);
  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof URIError) {
      response.status(404).json({ error: "Media not found" });
      return;
    }
    response
      .status(error instanceof HttpError ? error.statusCode : 500)
      .json({ error: error instanceof HttpError ? error.message : "Internal server error" });
  });

  const server = createServer(app);
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/v1/uploads`;

  try {
    const hostilePaths = [
      `/content/${outsideKey}`,
      `/content/${encodeURIComponent(outsideKey)}`,
      `/content/${encodeURIComponent(encodeURIComponent(outsideKey))}`,
      `/content/%2e%2e%2f${encodeURIComponent(basename(outsidePath))}`,
      "/content/%2Fetc%2Fpasswd",
      "/content/%E0%A4%A",
    ];
    for (const path of hostilePaths) {
      const response = await fetch(`${base}${path}`);
      assert.ok(response.status >= 400 && response.status < 500);
      assert.doesNotMatch(await response.text(), /outside-media-secret-sentinel/);
    }

    const validResponse = await fetch(`${base}/content/${encodeURIComponent(validKey)}`, {
      headers: { Range: "bytes=1-3" },
    });
    assert.equal(validResponse.status, 206);
    assert.equal(validResponse.headers.get("content-range"), "bytes 1-3/6");
    assert.equal(await validResponse.text(), "bcd");

    const audioResponse = await fetch(`${base}/content/${encodeURIComponent(audioKey)}`);
    assert.equal(audioResponse.status, 403);

    const coverResponse = await fetch(`${base}/content/${encodeURIComponent(validCoverKey)}`);
    assert.equal(coverResponse.status, 200);
    assert.equal(coverResponse.headers.get("content-type"), "image/webp");
    assert.deepEqual(Buffer.from(await coverResponse.arrayBuffer()), coverBytes);
  } finally {
    env.STORAGE_PROVIDER = originalStorageProvider;
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose());
    });
    await Promise.all([
      rm(outsidePath, { force: true }),
      rm(dirname(validPath), { recursive: true, force: true }),
    ]);
  }
});

test("upload relay checks actual bytes and media signatures before storage", async () => {
  const session = {
    id: "upl-test",
    trackId: "trk-test",
    purpose: "audio" as const,
    fileName: "track.mp3",
    contentType: "audio/mpeg",
    sizeBytes: 3,
    storageKey: "masters/tracks/trk-test/upl-test-track.mp3",
    directUploadUrl: "https://storage.example/upload-secret",
    uploadUrl: "http://localhost/upload",
    method: "PUT" as const,
    headers: {},
    provider: "local" as const,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  let storedBody = "";
  const cleanup = [
    restore(uploadsService, "requireActiveSession", (async () => session) as typeof uploadsService.requireActiveSession),
    restore(tracksService, "userOwnsTrack", (async () => true) as typeof tracksService.userOwnsTrack),
    restore(storageService, "saveLocalObject", (async (_key, stream) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk));
      storedBody = Buffer.concat(chunks).toString("ascii");
      return "/tmp/test-upload";
    }) as typeof storageService.saveLocalObject),
  ];

  const app = express();
  app.use("/api/v1/uploads", uploadsRouter);
  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(error instanceof HttpError ? error.statusCode : 500).json({ error: error.message });
  });
  const server = createServer(app);
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const token = tokenService.issueSession({
    walletAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    email: "", displayName: "Artist", primaryIntent: "artist", artistAccess: true,
    onboardingStatus: "complete", onboardingStep: "complete", onboardingVersion: 1,
    profileCompletion: { percentage: 100, completed: [], missing: [], requiredComplete: true },
  });
  const uploadUrl = `http://127.0.0.1:${address.port}/api/v1/uploads/sessions/${session.id}/content`;

  try {
    const oversized = await fetch(uploadUrl, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "audio/mpeg" }, body: Buffer.from("ID3x"),
    });
    assert.equal(oversized.status, 400);
    assert.equal(storedBody, "");

    const chunkedOversized = await fetch(uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "audio/mpeg" },
      body: Readable.from([Buffer.from("ID"), Buffer.from("3x")]) as never,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    assert.equal(chunkedOversized.status, 400);
    assert.equal(storedBody, "");

    const invalidType = await fetch(uploadUrl, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "audio/mpeg" }, body: Buffer.from("bad"),
    });
    assert.equal(invalidType.status, 400);
    assert.equal(storedBody, "");

    const valid = await fetch(uploadUrl, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "audio/mpeg" }, body: Buffer.from("ID3"),
    });
    assert.equal(valid.status, 204);
    assert.equal(storedBody, "ID3");
  } finally {
    cleanup.reverse().forEach((fn) => fn());
    await new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  }
});

test("S3 relay streams staged bytes with a measured content length", async () => {
  const expectedBody = Buffer.from("ID3-streamed");
  let receivedBody = Buffer.alloc(0);
  let receivedLength = "";
  const server = createServer(async (request, response) => {
    receivedLength = String(request.headers["content-length"] ?? "");
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    receivedBody = Buffer.concat(chunks);
    response.setHeader("ETag", '"test-etag"');
    response.statusCode = 200;
    response.end();
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    const result = await storageService.uploadRemoteObject(
      `http://127.0.0.1:${address.port}/upload`,
      "PUT",
      Readable.from([expectedBody]),
      { "Content-Type": "audio/mpeg" },
      expectedBody.length,
    );
    assert.equal(result.eTag, '"test-etag"');
    assert.equal(receivedLength, String(expectedBody.length));
    assert.deepEqual(receivedBody, expectedBody);
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  }
});
