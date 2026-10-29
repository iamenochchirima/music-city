import assert from "node:assert/strict";
import test from "node:test";
import { checkLocalDemoConfig } from "./check-sow2-local-env.mjs";

const sandbox = "2bf133b3-0bd0-4e1d-b956-7e613ed3d319";
const testnetUsdcIssuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const server = { DATABASE_URL: "postgres://test:password@127.0.0.1:5432/demo_test", DYNAMIC_ENVIRONMENT_ID: sandbox, DYNAMIC_JWKS_URL: `https://app.dynamic.xyz/api/v0/sdk/${sandbox}/.well-known/jwks`, RAMPS_SANDBOX_ENABLED: "false", PORT: "4339", CLIENT_ORIGIN: "http://localhost:3000", APP_BASE_URL: "http://localhost:4339", STELLAR_SETTLEMENT_ASSET_CODE: "USDC", STELLAR_SETTLEMENT_ASSET_ISSUER: testnetUsdcIssuer, STELLAR_TREASURY_ADDRESS: "GAGX4VX7XATS7247VUYFYDX5FZISYL3ME6SAO2MOTWVFEUVDBFQGBEB5", AGREEMENT_TREASURY_ADDRESS: "GAGX4VX7XATS7247VUYFYDX5FZISYL3ME6SAO2MOTWVFEUVDBFQGBEB5", ROYALTY_REGISTRY_CONTRACT_ID: "CDIKALTGUF3XQGHCHUKH3IFNFFRE4ZGMCVTOGO3HUC654WS2XQZQQ3SX", SETTLEMENT_CONTRACT_ID: "CAQNSYYWEMMEYKB4JTSZRKBIQP4MSWURA2FMCBDVPUQ22ENI2BGCKXNW" };
const client = { VITE_DYNAMIC_ENVIRONMENT_ID: sandbox, VITE_API_BASE_URL: "http://localhost:4339/api/v1", VITE_APP_BASE_URL: "http://localhost:3000" };
const admin = { VITE_ADMIN_API_BASE_URL: "http://localhost:4339/api/v1/admin" };
test("accepts an isolated local Sandbox and Testnet configuration", () => assert.deepEqual(checkLocalDemoConfig(server, client, admin), []));
test("rejects live identity, signing keys, databases, network and API endpoints", () => {
  for (const [changedServer, changedClient] of [
    [{ ...server, DYNAMIC_ENVIRONMENT_ID: "live" }, client],
    [{ ...server, DYNAMIC_JWKS_URL: "https://app.dynamic.xyz/api/v0/sdk/live/.well-known/jwks" }, client],
    [{ ...server, DATABASE_URL: "postgres://test@db.example.test/demo_test" }, client],
    [{ ...server, DATABASE_URL: "postgres://test@localhost/production" }, client],
    [{ ...server, DATABASE_URL: "postgres://test@localhost/demo_test?host=remote.example" }, client],
    [{ ...server, DATABASE_URL: "https://localhost/demo_test" }, client],
    [{ ...server, STELLAR_NETWORK_PASSPHRASE: "Public Global Stellar Network ; September 2015" }, client],
    [{ ...server, STELLAR_HORIZON_URL: "https://horizon.stellar.org" }, client],
    [{ ...server, APP_BASE_URL: "http://localhost:3000" }, client],
    [{ ...server, APP_BASE_URL: "https://example.test" }, client],
    [{ ...server, APP_BASE_URL: "http://localhost:4339/api/v1" }, client],
    [{ ...server, RAMPS_SANDBOX_ENABLED: "true" }, client],
    [{ ...server, STELLAR_SETTLEMENT_ASSET_CODE: "XLM" }, client],
    [{ ...server, STELLAR_SETTLEMENT_ASSET_ISSUER: undefined }, client],
    [{ ...server, STELLAR_SETTLEMENT_ASSET_ISSUER: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" }, client],
    [{ ...server, STELLAR_TREASURY_ADDRESS: undefined }, client],
    [{ ...server, STELLAR_TREASURY_ADDRESS: "not-a-stellar-address" }, client],
    [{ ...server, AGREEMENT_TREASURY_ADDRESS: undefined }, client],
    [{ ...server, AGREEMENT_TREASURY_ADDRESS: "not-a-stellar-address" }, client],
    [{ ...server, ROYALTY_REGISTRY_CONTRACT_ID: undefined }, client],
    [{ ...server, ROYALTY_REGISTRY_CONTRACT_ID: "not-a-contract" }, client],
    [{ ...server, SETTLEMENT_CONTRACT_ID: undefined }, client],
    [{ ...server, SETTLEMENT_CONTRACT_ID: "not-a-contract" }, client],
    [server, { ...client, VITE_STELLAR_TESTNET_USDC_CODE: "XLM" }],
    [server, { ...client, VITE_STELLAR_TESTNET_USDC_ISSUER: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" }],
    [{ ...server, STORAGE_PROVIDER: "s3" }, client],
    [{ ...server, MEDIA_PROVIDER: "mux" }, client],
    [server, { ...client, VITE_API_BASE_URL: "http://localhost:4319/api/v1" }],
    [server, { ...client, VITE_DYNAMIC_ENVIRONMENT_ID: "live" }],
    [server, { ...client, VITE_API_BASE_URL: "https://example.test/api/v1" }],
  ]) assert.ok(checkLocalDemoConfig(changedServer, changedClient, admin).length > 0);
  assert.ok(checkLocalDemoConfig(server, client, { VITE_ADMIN_API_BASE_URL: "https://example.test/api/v1/admin" }).length > 0);
  assert.ok(checkLocalDemoConfig(server, client, { VITE_ADMIN_API_BASE_URL: "http://localhost:4319/api/v1/admin" }).length > 0);
});


test("rejects a connection string whose query overrides its apparent local host", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(new URL("../server/package.json", import.meta.url));
  const { Client } = require("pg");
  const database = "postgres://test@localhost/demo_test?host=remote.example";
  assert.equal(new Client({ connectionString: database }).connectionParameters.host, "remote.example");
  assert.ok(checkLocalDemoConfig({ ...server, DATABASE_URL: database }, client, admin).some((error) => error.includes("DATABASE_URL")));
});

test("rejects mismatched or non-local client origins before the browser check", () => {
  assert.ok(checkLocalDemoConfig({ ...server, CLIENT_ORIGIN: "http://localhost:4317" }, client, admin)
    .some((error) => error.includes("must match VITE_APP_BASE_URL")));
  assert.ok(checkLocalDemoConfig(server, { ...client, VITE_APP_BASE_URL: "https://musiccity.pro" }, admin)
    .some((error) => error.includes("VITE_APP_BASE_URL must be a local origin")));
  assert.ok(checkLocalDemoConfig({ ...server, CLIENT_ORIGIN: "http://localhost:3000/app" }, client, admin)
    .some((error) => error.includes("CLIENT_ORIGIN must be a local origin")));
});
