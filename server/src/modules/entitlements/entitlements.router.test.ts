import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import express from "express";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const { entitlementsRouter } = await import("./entitlements.router.js");

test("the user API no longer exposes an entitlement grant endpoint", async () => {
  const app = express();
  app.use("/api/v1/entitlements", entitlementsRouter);
  app.use((_request, response) => response.status(404).json({ error: "Not found" }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/entitlements/grant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: "track-1", source: "purchase" }),
    });
    assert.equal(response.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
