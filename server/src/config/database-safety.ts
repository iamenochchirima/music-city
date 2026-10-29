const localDatabaseHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function assertDatabaseTargetAllowed(
  databaseUrl: string,
  nodeEnvironment: "development" | "test" | "production",
) {
  if (nodeEnvironment === "production") return;

  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    throw new Error("Refusing database startup outside production because DATABASE_URL is invalid.");
  }

  const localTarget =
    ["postgres:", "postgresql:"].includes(target.protocol) &&
    localDatabaseHosts.has(target.hostname.toLowerCase()) &&
    /^\/[A-Za-z0-9_]+_test$/.test(target.pathname) &&
    !target.searchParams.has("host");

  if (!localTarget) {
    throw new Error(
      "Refusing database startup outside production with an unsafe DATABASE_URL. Use an isolated loopback PostgreSQL database ending in _test.",
    );
  }
}
