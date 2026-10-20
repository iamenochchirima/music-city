import { afterEach, expect, it, vi } from "vitest";
import { AudioPreloader } from "./audio-preloader";
const value = {
  ticket: "ticket",
  iv: "iv",
  ciphertext: "cipher",
  expiresAt: new Date(Date.now() + 120000).toISOString(),
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("bounds concurrent preparation, deduplicates repeated renders and isolates account changes", async () => {
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: vi.fn(async () => ({
        active: { scriptURL: "https://app/other-worker.js" },
      })),
      controller: null,
    },
  });
  const resolvers: (() => void)[] = [];
  let active = 0,
    maximum = 0;
  const load = vi.fn(
    () =>
      new Promise<typeof value>((resolve) => {
        active++;
        maximum = Math.max(maximum, active);
        resolvers.push(() => {
          active--;
          resolve(value);
        });
      }),
  );
  const preloader = new AudioPreloader();
  preloader.prime(["a", "b", "c"], "one", load);
  preloader.prime(["a", "b", "c"], "one", load);
  expect(load).toHaveBeenCalledTimes(2);
  resolvers[0]!();
  resolvers[1]!();
  await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(3));
  resolvers[2]!();
  await vi.waitFor(() => expect(preloader.peek("c", "one")).toBeTruthy());
  expect(maximum).toBe(2);
  expect(preloader.peek("c", "other")).toBeUndefined();
  preloader.prime([], "other", load);
  expect(preloader.peek("c", "one")).toBeUndefined();
});
it("expired preparation is not reused", async () => {
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: vi.fn(async () => ({
        active: { scriptURL: "https://app/other-worker.js" },
      })),
      controller: null,
    },
  });
  const preloader = new AudioPreloader();
  preloader.prime(["a"], "one", async () => ({
    ...value,
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  }));
  await Promise.resolve();
  await Promise.resolve();
  expect(preloader.peek("a", "one")).toBeUndefined();
});
it("only unlocks bytes after activation and clamps a guest prefix to the authorized allowance", async () => {
  const { webcrypto } = await import("node:crypto");
  vi.stubGlobal("crypto", webcrypto);
  const posted: unknown[] = [];
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: vi.fn(async () => ({
        active: { scriptURL: "https://app/other-worker.js" },
      })),
      controller: {
        scriptURL: "https://app/playback-preload-worker.js",
        postMessage: (data: unknown, ports: MessagePort[]) => {
          posted.push(data);
          ports[0]?.postMessage({ ready: true });
        },
      },
    },
  });
  const header = new TextEncoder().encode(
    JSON.stringify({
      resources: [
        {
          url: "media",
          offset: 0,
          length: 8,
          totalBytes: 8,
          contentType: "audio/mpeg",
        },
      ],
    }),
  );
  const clear = new Uint8Array(4 + header.length + 8);
  new DataView(clear.buffer).setUint32(0, header.length);
  clear.set(header, 4);
  clear.set([1, 2, 3, 4, 5, 6, 7, 8], 4 + header.length);
  const key = webcrypto.getRandomValues(new Uint8Array(32));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const aes = await webcrypto.subtle.importKey("raw", key, "AES-GCM", false, [
    "encrypt",
  ]);
  const encrypted = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aes,
    clear,
  );
  const prepared = {
    ticket: "ticket",
    iv: Buffer.from(iv).toString("base64"),
    ciphertext: Buffer.from(encrypted).toString("base64"),
    expiresAt: new Date(Date.now() + 120000).toISOString(),
  };
  const preloader = new AudioPreloader();
  preloader.prime(["track"], "guest", async () => prepared);
  await vi.waitFor(() => expect(preloader.peek("track", "guest")).toBeTruthy());
  expect(posted.every((item: any) => item.type !== "buffer-audio")).toBe(true);
  await preloader.activate(
    "track",
    prepared,
    Buffer.from(key).toString("base64"),
    {
      streamUrl: "https://api/media?token=bound",
      isGuest: true,
      guestRemainingSeconds: 2,
      guestTrackDurationSeconds: 8,
    } as never,
    "guest",
  );
  const message = posted.find(
    (item: any) => item.type === "buffer-audio",
  ) as any;
  expect(message.resources[0].bytes.byteLength).toBe(2);
  expect(message.resources[0].url).toBe("https://api/media?token=bound");
});
