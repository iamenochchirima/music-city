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
    !target.searchParams.has("host");

  if (!localTarget) {
    throw new Error(
      "Refusing database startup outside production with a non-local DATABASE_URL. Use an isolated local PostgreSQL database.",
    );
  }
}
