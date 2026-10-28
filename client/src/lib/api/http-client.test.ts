import { afterEach, expect, it, vi } from "vitest";
import { httpClient } from "./http-client";

afterEach(() => vi.unstubAllGlobals());
it("accepts a successful empty response to a post", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  await expect(httpClient.post("/cash-out/cancel", {}, "session")).resolves.toBeUndefined();
});
