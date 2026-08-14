const trimSlash = (value: string) => value.replace(/\/$/, "");

const readClientEnv = (viteKey: string, legacyKey: string, fallback?: string) => {
  const viteValue = import.meta.env[viteKey];
  const legacyValue = import.meta.env[legacyKey];
  return (typeof viteValue === "string" && viteValue) ||
    (typeof legacyValue === "string" && legacyValue) ||
    fallback;
};

const dynamicEnvironmentId =
  readClientEnv(
    "VITE_DYNAMIC_ENVIRONMENT_ID",
    "NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID",
    "dynamic-environment-id-required",
  )?.trim() || "dynamic-environment-id-required";

export const clientEnv = {
  apiBaseUrl: trimSlash(
    readClientEnv(
      "VITE_API_BASE_URL",
      "NEXT_PUBLIC_API_BASE_URL",
      "http://localhost:4319/api/v1",
    ) ?? "http://localhost:4319/api/v1",
  ),
  appBaseUrl: trimSlash(
    readClientEnv(
      "VITE_APP_BASE_URL",
      "NEXT_PUBLIC_APP_BASE_URL",
      "http://localhost:4317",
    ) ?? "http://localhost:4317",
  ),
  dynamicEnvironmentId,
  stellarHorizonUrl:
    readClientEnv(
      "VITE_STELLAR_HORIZON_URL",
      "NEXT_PUBLIC_STELLAR_HORIZON_URL",
      "https://horizon-testnet.stellar.org",
    ) ?? "https://horizon-testnet.stellar.org",
  stellarNetworkPassphrase:
    readClientEnv(
      "VITE_STELLAR_NETWORK_PASSPHRASE",
      "NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE",
      "Test SDF Network ; September 2015",
    ) ?? "Test SDF Network ; September 2015",
  stellarTestnetUsdcCode:
    readClientEnv(
      "VITE_STELLAR_TESTNET_USDC_CODE",
      "NEXT_PUBLIC_STELLAR_TESTNET_USDC_CODE",
      "USDC",
    ) ?? "USDC",
  stellarTestnetUsdcIssuer:
    readClientEnv(
      "VITE_STELLAR_TESTNET_USDC_ISSUER",
      "NEXT_PUBLIC_STELLAR_TESTNET_USDC_ISSUER",
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    ) ?? "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  isDynamicConfigured:
    dynamicEnvironmentId !== "dynamic-environment-id-required",
};
