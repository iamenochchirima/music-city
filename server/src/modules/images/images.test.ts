import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import express from "express";
import sharp from "sharp";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";
const { imageKey, imageToken, storedImageUrl } = await import("./image-url.js");
const { imagesRouter } = await import("./images.router.js");
const { imagesService } = await import("./images.service.js");
const { storageService } = await import("../../services/storage.service.js");
const { HttpError } = await import("../../utils/http-error.js");

test("image capabilities are stable, bind the exact storage key and cannot expose audio or arbitrary URLs", () => {
  const key = "covers/releases/test/upload-one.png";
  const token = imageToken(key);
  assert.equal(imageKey(token), key);
  assert.equal(imageToken(key), token);
  assert.equal(storedImageUrl(key), storedImageUrl(key));
  assert.notEqual(storedImageUrl(key), storedImageUrl("covers/releases/test/upload-two.png"));
  assert.throws(() => imageKey(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0")));
  for (const invalid of ["masters/track/audio.png", "covers/../secret.png", "/etc/file.png", "https://private.example/a.png", "covers/%2e%2e/secret.png", "covers/a.mp3"]) {
    assert.throws(() => imageToken(invalid));
  }
});

test("image route resizes, persists and caches WebP without exposing the original", async () => {
  const source = await sharp({ create: { width: 1254, height: 1254, channels: 3, background: "#339966" } }).png().toBuffer();
  const objects = new Map<string, Buffer>([["covers/image-http-test.png", source]]);
  const originalRead = storageService.readStoredObject;
  const originalWrite = storageService.putStoredObject;
  let sourceReads = 0;
  storageService.readStoredObject = async (key) => {
    const bytes = objects.get(key);
    if (!bytes) throw new HttpError(404, "Missing");
    if (key === "covers/image-http-test.png") sourceReads++;
    return bytes;
  };
  storageService.putStoredObject = async (key, bytes, type) => { assert.equal(type, "image/webp"); objects.set(key, bytes); };
  const app = express();
  app.use("/images", imagesRouter);
  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => response.status(error instanceof HttpError ? error.statusCode : 500).json({ error: error.message }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/images/v1/${imageToken("covers/image-http-test.png")}/384.webp`;
  try {
    const [response, concurrent] = await Promise.all([fetch(url), fetch(url)]);
    assert.equal(response.status, 200); assert.equal(concurrent.status, 200);
    assert.match(response.headers.get("cache-control")!, /31536000.*immutable/);
    assert.equal(response.headers.get("content-type"), "image/webp");
    const bytes = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, 384); assert.equal(metadata.format, "webp");
    assert.ok(bytes.length < source.length);
    assert.ok([...objects.keys()].some((key) => key.startsWith("image-variants/v1/")));
    const cached = await fetch(url, { headers: { "If-None-Match": response.headers.get("etag")! } });
    assert.equal(cached.status, 304); assert.equal(sourceReads, 1);
    assert.equal((await fetch(url.replace("384.webp", "999.webp"))).status, 400);
    assert.equal((await fetch(url.replace(/v1\/[^/]+\//, "v1/forged/"))).status, 404);
    await assert.rejects(imagesService.getVariant("covers/image-http-test.png", 999));
  } finally {
    storageService.readStoredObject = originalRead;
    storageService.putStoredObject = originalWrite;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
