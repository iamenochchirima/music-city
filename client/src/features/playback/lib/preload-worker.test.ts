// @vitest-environment node
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

async function worker() {
  const events: Record<string, (event: any) => void> = {};
  runInNewContext(
    await readFile(
      new URL("../../../../public/playback-preload-worker.js", import.meta.url),
      "utf8",
    ),
    {
      self: {
        location: { origin: "https://app.test" },
        addEventListener: (name: string, handler: any) =>
          (events[name] = handler),
      },
      URL,
      Map,
      Date,
      ArrayBuffer,
      Response,
      Infinity,
      Number,
    },
  );
  const send = (data: any) =>
    events.message!({
      source: { id: "tab", url: "https://app.test/stream" },
      data,
      ports: [],
    });
  const read = async (url: string, range?: string, clientId = "tab") => {
    let result: Promise<Response> | Response | undefined;
    events.fetch!({
      clientId,
      request: new Request(url, { headers: range ? { Range: range } : {} }),
      respondWith: (r: Response | Promise<Response>) => (result = r),
    });
    return await result;
  };
  return { send, read };
}
it("reuses a prepared prefix for byte ranges and lets the remaining audio stream normally", async () => {
  const w = await worker();
  const url =
    "https://api.test/api/v1/playback/sessions/session/media?token=bound";
  w.send({
    type: "buffer-audio",
    resources: [
      {
        url,
        bytes: new Uint8Array([1, 2, 3, 4]).buffer,
        totalBytes: 100,
        contentType: "audio/mpeg",
      },
    ],
  });
  const response = await w.read(url, "bytes=0-");
  expect(response?.status).toBe(206);
  expect(response?.headers.get("content-range")).toBe("bytes 0-3/100");
  expect([...new Uint8Array(await response!.arrayBuffer())]).toEqual([
    1, 2, 3, 4,
  ]);
  expect(await w.read(url, "bytes=4-")).toBeUndefined();
  expect(await w.read(url, "bytes=0-", "other-tab")).toBeUndefined();
  w.send({ type: "clear-audio" });
  expect(await w.read(url, "bytes=0-")).toBeUndefined();
});
it("matches a guest HLS fragment without replacing its bounded session manifest", async () => {
  const w = await worker();
  const resource = "https://video.mux.com/first.ts";
  w.send({
    type: "buffer-audio",
    resources: [
      {
        url: resource,
        bytes: new Uint8Array([1, 2]).buffer,
        contentType: "audio/mp2t",
      },
    ],
  });
  const url =
    "https://api.test/playback/sessions/session/segment?token=bound&resource=" +
    encodeURIComponent(resource);
  expect((await w.read(url))?.status).toBe(200);
  expect(
    await w.read(
      "https://api.test/playback/sessions/session/manifest.m3u8?token=bound",
    ),
  ).toBeUndefined();
});
