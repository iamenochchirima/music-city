import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sandboxId = "2bf133b3-0bd0-4e1d-b956-7e613ed3d319";
const testnet = "Test SDF Network ; September 2015";
const sandboxJwks = `https://app.dynamic.xyz/api/v0/sdk/${sandboxId}/.well-known/jwks`;
const testnetUsdcCode = "USDC";
const testnetUsdcIssuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export function checkLocalDemoConfig(server, client, admin = {}) {
  const failures = [];
  let database;
  try { database = new URL(server.DATABASE_URL); } catch { failures.push("Set DATABASE_URL to an isolated local test database."); }
  // pg permits query parameters such as host to override the URL authority.
  // Disallow them so the connection the app opens matches what we check here.
  if (database && (!["postgres:", "postgresql:"].includes(database.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
      !/^\/[A-Za-z0-9_]+_test$/.test(database.pathname) || database.search || database.hash))
    failures.push("DATABASE_URL must use localhost and a database name ending in _test, without query parameters.");
  if (server.NODE_ENV === "production") failures.push("Use a non-production server environment.");
  if (server.STORAGE_PROVIDER && server.STORAGE_PROVIDER !== "local") failures.push("Use local media storage for the demo.");
  if (server.MEDIA_PROVIDER && server.MEDIA_PROVIDER !== "local") failures.push("Use local media processing for the demo.");
  const configuredClientOrigin = server.CLIENT_ORIGIN || "http://localhost:4317";
  const configuredAppBaseUrl = client.VITE_APP_BASE_URL || "http://localhost:4317";
  let allowedClientOrigin;
  let appBaseOrigin;
  try { allowedClientOrigin = new URL(configuredClientOrigin); } catch { failures.push("Set CLIENT_ORIGIN to the local client origin."); }
  try { appBaseOrigin = new URL(configuredAppBaseUrl); } catch { failures.push("Set VITE_APP_BASE_URL to the local client origin."); }
  if (allowedClientOrigin && (allowedClientOrigin.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(allowedClientOrigin.hostname) ||
      allowedClientOrigin.pathname !== "/" || allowedClientOrigin.search || allowedClientOrigin.hash ||
      allowedClientOrigin.username || allowedClientOrigin.password))
    failures.push("CLIENT_ORIGIN must be a local origin without a path or credentials.");
  if (appBaseOrigin && (appBaseOrigin.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(appBaseOrigin.hostname) ||
      appBaseOrigin.pathname !== "/" || appBaseOrigin.search || appBaseOrigin.hash ||
      appBaseOrigin.username || appBaseOrigin.password))
    failures.push("VITE_APP_BASE_URL must be a local origin without a path or credentials.");
  if (allowedClientOrigin && appBaseOrigin && allowedClientOrigin.origin !== appBaseOrigin.origin)
    failures.push("CLIENT_ORIGIN must match VITE_APP_BASE_URL so the API accepts requests from the local client.");
  if (server.DYNAMIC_ENVIRONMENT_ID !== sandboxId || client.VITE_DYNAMIC_ENVIRONMENT_ID !== sandboxId)
    failures.push("Set both Dynamic environment IDs to the Music City Sandbox ID.");
  if (server.DYNAMIC_JWKS_URL && server.DYNAMIC_JWKS_URL !== sandboxJwks)
    failures.push("DYNAMIC_JWKS_URL must use the Music City Sandbox signing-key endpoint.");
  if ((server.STELLAR_NETWORK_PASSPHRASE || testnet) !== testnet || (client.VITE_STELLAR_NETWORK_PASSPHRASE || testnet) !== testnet)
    failures.push("Set both Stellar networks to Testnet.");
  if (server.STELLAR_SETTLEMENT_ASSET_CODE !== testnetUsdcCode)
    failures.push("Set STELLAR_SETTLEMENT_ASSET_CODE=USDC for the SOW 2 purchase and earnings lifecycle.");
  if (server.STELLAR_SETTLEMENT_ASSET_ISSUER !== testnetUsdcIssuer)
    failures.push("Set STELLAR_SETTLEMENT_ASSET_ISSUER to the Stellar Testnet USDC issuer.");
  const clientUsdcCode = client.VITE_STELLAR_TESTNET_USDC_CODE || testnetUsdcCode;
  const clientUsdcIssuer = client.VITE_STELLAR_TESTNET_USDC_ISSUER || testnetUsdcIssuer;
  if (clientUsdcCode !== testnetUsdcCode || clientUsdcIssuer !== testnetUsdcIssuer)
    failures.push("Configure the client to use the same Stellar Testnet USDC asset as the API.");
  if (!/^G[A-Z2-7]{55}$/.test(server.STELLAR_TREASURY_ADDRESS || ""))
    failures.push("Set STELLAR_TREASURY_ADDRESS to the approved Stellar Testnet treasury public key.");
  const expectedNetworks = [
    [server.STELLAR_HORIZON_URL, "https://horizon-testnet.stellar.org"],
    [client.VITE_STELLAR_HORIZON_URL, "https://horizon-testnet.stellar.org"],
    [server.STELLAR_SOROBAN_RPC_URL, "https://soroban-testnet.stellar.org"],
  ];
  if (expectedNetworks.some(([actual, expected]) => actual && actual.replace(/\/$/, "") !== expected))
    failures.push("Use the Stellar Testnet Horizon and Soroban endpoints.");
  const port = server.PORT || "4319";
  let appBase;
  try { appBase = new URL(server.APP_BASE_URL || `http://localhost:${port}`); } catch { failures.push("Set APP_BASE_URL to the local API origin."); }
  if (appBase && (appBase.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(appBase.hostname) ||
      (appBase.port || "80") !== port || appBase.pathname !== "/" || appBase.search || appBase.hash || appBase.username || appBase.password))
    failures.push("APP_BASE_URL must use the configured local API origin because playback streams are served there.");
  let api;
  try { api = new URL(client.VITE_API_BASE_URL || "http://localhost:4319/api/v1"); } catch { failures.push("Set the client API URL to the local server."); }
  if (api && !["localhost", "127.0.0.1", "[::1]"].includes(api.hostname)) failures.push("The client API URL must use localhost.");
  let adminApi;
  try { adminApi = new URL(admin.VITE_ADMIN_API_BASE_URL || "http://localhost:4319/api/v1/admin"); } catch { failures.push("Set the admin API URL to the local server."); }
  if (adminApi && !["localhost", "127.0.0.1", "[::1]"].includes(adminApi.hostname)) failures.push("The admin API URL must use localhost.");
  for (const [url, path, label] of [[api, "/api/v1", "client"], [adminApi, "/api/v1/admin", "admin"]]) {
    if (url && (url.protocol !== "http:" || (url.port || "80") !== port || url.pathname.replace(/\/$/, "") !== path || url.search || url.hash || url.username || url.password))
      failures.push(`The ${label} API URL must use the configured local server port and expected API path.`);
  }
  if (server.RAMPS_SANDBOX_ENABLED && server.RAMPS_SANDBOX_ENABLED !== "false") failures.push("Disable provider ramps for the core earnings demo.");
  return failures;
}

async function main() {
  const serverRequire = createRequire(resolve(root, "server/package.json"));
  const dotenv = serverRequire("dotenv");
  const server = { ...process.env };
  const localServerEnv = resolve(root, "server/.env");
  dotenv.config({ path: existsSync(localServerEnv) ? localServerEnv : resolve(root, ".env"), processEnv: server, quiet: true });
  const clientRequire = createRequire(resolve(root, "client/package.json"));
  const { loadEnv } = await import(pathToFileURL(clientRequire.resolve("vite")).href);
  const client = loadEnv("development", resolve(root, "client"), "VITE_");
  const admin = loadEnv("development", resolve(root, "admin"), "VITE_");
  const failures = checkLocalDemoConfig(server, client, admin);
  if (failures.length) { for (const failure of failures) console.error(`- ${failure}`); process.exitCode = 1; }
  else console.log("Local SOW 2 demo configuration passed. Verify the running services use these same settings.");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
