/* Audio prefixes live only in memory and only for the requesting browser tab. */
const clientsAudio = new Map();
const MAX_BYTES = 4 * 1024 * 1024;
const canonical = (value) => {
  const url = new URL(value);
  if (url.hostname.endsWith(".mux.com")) url.searchParams.delete("token");
  return url.toString();
};
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("message", (event) => {
  const client = event.source;
  if (!client?.id || new URL(client.url).origin !== self.location.origin)
    return;
  if (event.data?.type === "clear-audio") clientsAudio.delete(client.id);
  if (event.data?.type === "buffer-audio") {
    let cache = clientsAudio.get(client.id);
    if (!cache) clientsAudio.set(client.id, (cache = new Map()));
    for (const resource of event.data.resources ?? []) {
      if (
        !(resource.bytes instanceof ArrayBuffer) ||
        resource.bytes.byteLength > 256 * 1024
      )
        continue;
      const url = new URL(resource.url);
      if (!["https:", "http:"].includes(url.protocol)) continue;
      cache.set(canonical(url), { ...resource, expires: Date.now() + 120000 });
    }
    let size = [...cache.values()].reduce((n, r) => n + r.bytes.byteLength, 0);
    for (const [key, resource] of cache) {
      if (size <= MAX_BYTES) break;
      cache.delete(key);
      size -= resource.bytes.byteLength;
    }
  }
  event.ports[0]?.postMessage({ ready: true });
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const cache = clientsAudio.get(event.clientId);
  if (!cache) return;
  const requested = new URL(event.request.url);
  // Guest HLS fragments retain the server-issued session URL. Only fragment bytes
  // already unlocked for this listener can be reused, never the bounded manifest.
  const resourceUrl = requested.pathname.endsWith("/segment")
    ? requested.searchParams.get("resource")
    : null;
  const key = canonical(resourceUrl || requested.toString());
  const resource = cache.get(key);
  if (!resource) return;
  if (resource.expires <= Date.now()) {
    cache.delete(key);
    return;
  }
  const range = event.request.headers.get("range");
  const headers = {
    "Content-Type": resource.contentType,
    "Cache-Control": "no-store",
  };
  if (resource.totalBytes) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range || "");
    if (!match) return;
    const start = Number(match[1]);
    if (start >= resource.bytes.byteLength) return;
    const end = Math.min(
      resource.bytes.byteLength - 1,
      match[2] ? Number(match[2]) : Infinity,
    );
    if (end < start) return;
    const bytes = resource.bytes.slice(start, end + 1);
    event.respondWith(
      new Response(bytes, {
        status: 206,
        headers: {
          ...headers,
          "Accept-Ranges": "bytes",
          "Content-Length": String(bytes.byteLength),
          "Content-Range": `bytes ${start}-${end}/${resource.totalBytes}`,
        },
      }),
    );
    return;
  }
  if (range) return;
  event.respondWith(
    new Response(resource.bytes.slice(0), {
      headers: {
        ...headers,
        "Content-Length": String(resource.bytes.byteLength),
      },
    }),
  );
});
