// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import type { UserConfigFn } from "vite";
import clientConfig from "../../vite.config";
import adminConfig from "../../../admin/vite.config";

afterEach(() => vi.unstubAllEnvs());

for (const [name, factory] of Object.entries({ client: clientConfig, admin: adminConfig })) {
  it(`${name} exposes public configuration while excluding build and backend secrets`, async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://public.example/api/v1");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "private-build-token-sentinel");
    vi.stubEnv("DATABASE_URL", "private-database-sentinel");
    vi.stubEnv("STELLAR_TREASURY_SECRET", "private-treasury-sentinel");
    const config = await (factory as UserConfigFn)({ command: "build", mode: "production" });
    const exposed = JSON.parse(config.define!["process.env"]);
    expect(exposed.VITE_API_BASE_URL).toBe("https://public.example/api/v1");
    expect(exposed.NODE_ENV).toBe("production");
    expect(exposed).not.toHaveProperty("VERCEL_OIDC_TOKEN");
    expect(exposed).not.toHaveProperty("DATABASE_URL");
    expect(exposed).not.toHaveProperty("STELLAR_TREASURY_SECRET");
    expect(JSON.stringify(exposed)).not.toContain("private-");
  });
}
