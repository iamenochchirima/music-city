import { authSessionSchema, type AuthSession } from "@music-city/shared";

export function usableStoredSession(
  raw: string | null,
  now = Date.now(),
): AuthSession | null {
  if (!raw) return null;
  try {
    const session = authSessionSchema.parse(JSON.parse(raw));
    const payload = session.token?.split(".")[1];
    if (!payload) return null;
    const claims = JSON.parse(
      atob(payload.replaceAll("-", "+").replaceAll("_", "/")),
    );
    // Expiry is a local refresh hint. The API still verifies the JWT signature and authorization.
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) return null;
    return session;
  } catch {
    return null;
  }
}
