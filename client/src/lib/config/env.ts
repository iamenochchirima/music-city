const trimSlash = (value: string) => value.replace(/\/$/, "");

const readClientEnv = (key: string, fallback?: string) => {
  const value = import.meta.env[key];
  return (typeof value === "string" && value) || fallback;
};

const dynamicEnvironmentId =
  readClientEnv("VITE_DYNAMIC_ENVIRONMENT_ID", "dynamic-environment-id-required")?.trim() ||
  "dynamic-environment-id-required";

export const clientEnv = {
  apiBaseUrl: trimSlash(
    readClientEnv(
      "VITE_API_BASE_URL",
      "http://localhost:4319/api/v1",
    ) ?? "http://localhost:4319/api/v1",
  ),
  appBaseUrl: trimSlash(
    readClientEnv(
      "VITE_APP_BASE_URL",
      "http://localhost:4317",
    ) ?? "http://localhost:4317",
  ),
  dynamicEnvironmentId,
  isDynamicConfigured: dynamicEnvironmentId !== "dynamic-environment-id-required",
  stellarHorizonUrl:
    readClientEnv(
      "VITE_STELLAR_HORIZON_URL",
      "https://horizon-testnet.stellar.org",
    ) ?? "https://horizon-testnet.stellar.org",
  stellarNetworkPassphrase:
    readClientEnv(
      "VITE_STELLAR_NETWORK_PASSPHRASE",
      "Test SDF Network ; September 2015",
    ) ?? "Test SDF Network ; September 2015",
  stellarTestnetUsdcCode:
    readClientEnv(
      "VITE_STELLAR_TESTNET_USDC_CODE",
      "USDC",
    ) ?? "USDC",
  stellarTestnetUsdcIssuer:
    readClientEnv(
      "VITE_STELLAR_TESTNET_USDC_ISSUER",
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    ) ?? "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
};
