const trimSlash = (value: string) => value.replace(/\/$/, "");

const readEnv = (key: string, fallback: string) => {
  const value = import.meta.env[key];
  return typeof value === "string" && value ? value : fallback;
};

export const adminEnv = {
  apiBaseUrl: trimSlash(
    readEnv("VITE_ADMIN_API_BASE_URL", "http://localhost:4319/api/v1/admin"),
  ),
  appBaseUrl: trimSlash(
    readEnv("VITE_ADMIN_APP_BASE_URL", "http://localhost:4318"),
  ),
};
