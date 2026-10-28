import assert from "node:assert/strict";
import test from "node:test";
import { checkLocalDemoConfig } from "./check-sow2-local-env.mjs";

const sandbox = "2bf133b3-0bd0-4e1d-b956-7e613ed3d319";
const server = { DATABASE_URL: "postgres://test:password@127.0.0.1:5432/demo_test", DYNAMIC_ENVIRONMENT_ID: sandbox, DYNAMIC_JWKS_URL: `https://app.dynamic.xyz/api/v0/sdk/${sandbox}/.well-known/jwks`, RAMPS_SANDBOX_ENABLED: "false", PORT: "4339" };
const client = { VITE_DYNAMIC_ENVIRONMENT_ID: sandbox, VITE_API_BASE_URL: "http://localhost:4339/api/v1" };
const admin = { VITE_ADMIN_API_BASE_URL: "http://localhost:4339/api/v1/admin" };
test("accepts an isolated local Sandbox and Testnet configuration", () => assert.deepEqual(checkLocalDemoConfig(server, client, admin), []));
test("rejects live identity, signing keys, databases, network and API endpoints", () => {
  for (const [changedServer, changedClient] of [
    [{ ...server, DYNAMIC_ENVIRONMENT_ID: "live" }, client],
    [{ ...server, DYNAMIC_JWKS_URL: "https://app.dynamic.xyz/api/v0/sdk/live/.well-known/jwks" }, client],
    [{ ...server, DATABASE_URL: "postgres://test@db.example.test/demo_test" }, client],
    [{ ...server, DATABASE_URL: "postgres://test@localhost/production" }, client],
    [{ ...server, STELLAR_NETWORK_PASSPHRASE: "Public Global Stellar Network ; September 2015" }, client],
    [{ ...server, STELLAR_HORIZON_URL: "https://horizon.stellar.org" }, client],
    [{ ...server, RAMPS_SANDBOX_ENABLED: "true" }, client],
    [{ ...server, STORAGE_PROVIDER: "s3" }, client],
    [server, { ...client, VITE_API_BASE_URL: "http://localhost:4319/api/v1" }],
    [server, { ...client, VITE_DYNAMIC_ENVIRONMENT_ID: "live" }],
    [server, { ...client, VITE_API_BASE_URL: "https://example.test/api/v1" }],
  ]) assert.ok(checkLocalDemoConfig(changedServer, changedClient, admin).length > 0);
  assert.ok(checkLocalDemoConfig(server, client, { VITE_ADMIN_API_BASE_URL: "https://example.test/api/v1/admin" }).length > 0);
  assert.ok(checkLocalDemoConfig(server, client, { VITE_ADMIN_API_BASE_URL: "http://localhost:4319/api/v1/admin" }).length > 0);
});
