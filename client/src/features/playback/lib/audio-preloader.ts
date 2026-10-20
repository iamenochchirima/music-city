import type { PlaybackPreload, PlaybackSession } from "@music-city/shared";

type Entry = { trackId: string; value: PlaybackPreload };
type Resource = {
  url: string;
  offset: number;
  length: number;
  contentType: string;
  totalBytes?: number;
  endSeconds?: number;
};
const decode = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
let registration: Promise<void> | null = null;
function registerWorker() {
  if (!registration)
    registration = (async () => {
      const existing = await navigator.serviceWorker.getRegistration("/");
      if (
        existing?.active &&
        !existing.active.scriptURL.endsWith("/playback-preload-worker.js")
      )
        return;
      await navigator.serviceWorker.register("/playback-preload-worker.js", {
        scope: "/",
      });
    })().catch(() => {
      registration = null;
    });
  return registration;
}
function message(data: unknown, transfer: Transferable[] = []) {
  return new Promise<void>((resolve) => {
    const worker = navigator.serviceWorker.controller;
    if (!worker || !worker.scriptURL.endsWith("/playback-preload-worker.js")) {
      resolve();
      return;
    }
    const channel = new MessageChannel();
    const finish = () => {
      clearTimeout(timer);
      channel.port1.close();
      resolve();
    };
    const timer = setTimeout(finish, 300);
    channel.port1.onmessage = finish;
    worker.postMessage(data, [channel.port2, ...transfer]);
  });
}

export class AudioPreloader {
  private actor: string | null = null;
  private entries = new Map<string, Entry>();
  private pending = new Set<string>();
  private failed = new Map<string, number>();
  private queue: {
    trackId: string;
    load: () => Promise<PlaybackPreload>;
    actor: string;
  }[] = [];
  private running = 0;
  private generation = 0;
  prime(
    trackIds: string[],
    actor: string,
    load: (id: string) => Promise<PlaybackPreload>,
  ) {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;
    void registerWorker();
    if (this.actor !== actor) {
      this.actor = actor;
      this.generation++;
      this.entries.clear();
      this.queue = [];
      this.pending.clear();
      this.failed.clear();
      void message({ type: "clear-audio" });
    }
    for (const trackId of [...new Set(trackIds)].slice(0, 12)) {
      if (
        this.peek(trackId, actor) ||
        this.pending.has(trackId) ||
        (this.failed.get(trackId) ?? 0) > Date.now()
      )
        continue;
      this.pending.add(trackId);
      this.queue.push({ trackId, actor, load: () => load(trackId) });
    }
    this.drain();
  }
  private drain() {
    while (this.running < 2 && this.queue.length) {
      const item = this.queue.shift()!;
      const generation = this.generation;
      this.running++;
      void item
        .load()
        .then((value) => {
          if (generation !== this.generation) return;
          this.entries.set(item.trackId, { trackId: item.trackId, value });
          while (this.entries.size > 12)
            this.entries.delete(this.entries.keys().next().value!);
        })
        .catch(() => {
          if (generation === this.generation)
            this.failed.set(item.trackId, Date.now() + 30000);
        })
        .finally(() => {
          this.running--;
          if (generation === this.generation) this.pending.delete(item.trackId);
          this.drain();
        });
    }
  }
  peek(trackId: string, actor: string) {
    if (actor !== this.actor) return undefined;
    const entry = this.entries.get(trackId);
    if (entry && Date.parse(entry.value.expiresAt) > Date.now() + 5000)
      return entry.value;
    this.entries.delete(trackId);
    return undefined;
  }
  async activate(
    trackId: string,
    prepared: PlaybackPreload,
    key: string,
    session: PlaybackSession,
    actor: string,
  ) {
    if (this.actor !== actor) return;
    this.entries.delete(trackId);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      decode(key),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const clear = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(prepared.iv) },
      cryptoKey,
      decode(prepared.ciphertext),
    );
    const headerLength = new DataView(clear).getUint32(0);
    const bundle = JSON.parse(
      new TextDecoder().decode(clear.slice(4, 4 + headerLength)),
    ) as { resources: Resource[] };
    const resources = bundle.resources.flatMap((resource) => {
      let bytes = new Uint8Array(
        clear.slice(
          4 + headerLength + resource.offset,
          4 + headerLength + resource.offset + resource.length,
        ),
      );
      if (resource.url === "media") {
        if (session.isGuest) {
          const remainingFraction = session.guestTrackDurationSeconds
            ? (session.guestRemainingSeconds ?? 0) /
              session.guestTrackDurationSeconds
            : 0;
          bytes = bytes.slice(
            0,
            Math.min(
              bytes.byteLength,
              Math.floor(
                (resource.totalBytes ?? 0) *
                  Math.min(1, remainingFraction),
              ),
            ),
          );
        }
        return [{ ...resource, url: session.streamUrl, bytes: bytes.buffer }];
      }
      if (
        session.isGuest &&
        resource.endSeconds !== undefined &&
        resource.endSeconds > (session.guestRemainingSeconds ?? 0)
      )
        return [];
      return [{ ...resource, bytes: bytes.buffer }];
    });
    if (this.actor !== actor) return;
    await message(
      { type: "buffer-audio", resources },
      resources.map((r) => r.bytes),
    );
  }
}
export const audioPreloader = new AudioPreloader();
