import assert from "node:assert/strict";
import test from "node:test";

import { envSchema } from "./env.js";

const productionMuxEnvironment = (overrides: Record<string, string> = {}) => ({
  NODE_ENV: "production",
  DATABASE_URL: "postgres://music-city:secret@db.example/music-city",
  JWT_SECRET: "production-jwt-secret-with-more-than-24-chars",
  ADMIN_JWT_SECRET: "production-admin-jwt-secret-over-24-chars",
  ADMIN_BOOTSTRAP_TOKEN: "production-one-time-bootstrap-token-long-enough",
  PLAYBACK_TOKEN_SECRET: "production-playback-token-secret-over-24-chars",
  CLIENT_ORIGIN: "https://musiccity.example",
  ADMIN_CLIENT_ORIGIN: "https://admin.musiccity.example",
  APP_BASE_URL: "https://api.musiccity.example",
  STELLAR_HOME_DOMAIN: "musiccity.example",
  STELLAR_SEP10_SECRET: "production-stellar-auth-secret",
  STELLAR_ALLOW_TESTNET_IN_PRODUCTION: "true",
  STELLAR_TREASURY_ADDRESS: "GTESTTREASURY",
  STORAGE_PROVIDER: "s3",
  STORAGE_ENDPOINT: "https://s3.example.com",
  STORAGE_ACCESS_KEY_ID: "access-key",
  STORAGE_SECRET_ACCESS_KEY: "secret-key",
  STORAGE_PATH_STYLE: "false",
  MEDIA_PROVIDER: "mux",
  MUX_TOKEN_ID: "mux-token-id",
  MUX_TOKEN_SECRET: "mux-token-secret",
  MUX_WEBHOOK_SECRET: "mux-webhook-secret",
  ...overrides,
});

test("production Mux configuration refuses unsigned or unverifiable playback", () => {
  const missingKeys = envSchema.safeParse(productionMuxEnvironment());
  assert.equal(missingKeys.success, false);
  if (missingKeys.success) return;
  const missingPaths = missingKeys.error.issues.map((issue) => issue.path[0]);
  assert.ok(missingPaths.includes("MUX_SIGNING_KEY"));
  assert.ok(missingPaths.includes("MUX_PRIVATE_KEY"));

  const configured = envSchema.safeParse(productionMuxEnvironment({
    MUX_SIGNING_KEY: "production-mux-signing-key",
    MUX_PRIVATE_KEY: "production-mux-private-key",
  }));
  assert.equal(configured.success, true);
});
