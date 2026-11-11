const trimSlash = (value: string) => value.replace(/\/$/, "");

const readEnv = (key: string, fallback: string) => {
  const value = import.meta.env[key];
  return typeof value === "string" && value ? value : fallback;
};

export const adminEnv = {
  dynamicEnvironmentId: readEnv("VITE_DYNAMIC_ENVIRONMENT_ID", ""),
  stellarHorizonUrl: readEnv("VITE_STELLAR_HORIZON_URL", "https://horizon-testnet.stellar.org"),
  stellarNetworkPassphrase: readEnv("VITE_STELLAR_NETWORK_PASSPHRASE", "Test SDF Network ; September 2015"),
  apiBaseUrl: trimSlash(
    readEnv("VITE_ADMIN_API_BASE_URL", "http://localhost:4319/api/v1/admin"),
  ),
  appBaseUrl: trimSlash(
    readEnv("VITE_ADMIN_APP_BASE_URL", "http://localhost:4318"),
  ),
};
