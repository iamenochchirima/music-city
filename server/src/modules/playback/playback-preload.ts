import {
  createCipheriv,
  createHmac,
  randomBytes,
  randomUUID,
  createHash,
} from "node:crypto";
import jwt from "jsonwebtoken";
import type { TrackSummary } from "@music-city/shared";
import { env } from "../../config/env.js";
import { storageService } from "../../services/storage.service.js";
import { muxService } from "../../services/mux.service.js";
import { HttpError } from "../../utils/http-error.js";

export const PRELOAD_BYTES = 256 * 1024;
type Resource = {
  url: string;
  body: string;
  contentType: string;
  totalBytes?: number;
  endSeconds?: number;
};
const fingerprint = (track: TrackSummary) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        track.id,
        track.mediaProvider,
        track.mediaStorageProvider,
        track.masterStorageKey,
        track.muxPlaybackId,
      ]),
    )
    .digest("hex");
const keyFor = (ticket: string) =>
  createHmac("sha256", env.PLAYBACK_TOKEN_SECRET)
    .update(`playback-preload:${ticket}`)
    .digest();
const actorFor = (actor: string) =>
  createHmac("sha256", env.PLAYBACK_TOKEN_SECRET)
    .update(`preload-actor:${actor}`)
    .digest("hex");

async function readBounded(response: Response, maximum: number) {
  if (!response.ok || !response.body)
    throw new HttpError(502, "Audio preparation unavailable");
  const reader = response.body.getReader();
  const parts: Buffer[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum)
        throw new HttpError(413, "Audio preparation exceeds its buffer budget");
      parts.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(parts);
}
const muxUrl = (value: string, base?: string) => {
  const url = new URL(value, base);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".mux.com"))
    throw new HttpError(502, "Unexpected media provider URL");
  return url.toString();
};

export const playbackPreload = {
  async prepare(track: TrackSummary, actor: string) {
    let remaining = PRELOAD_BYTES;
    const resources: Resource[] = [];
    if (track.mediaProvider === "mux" && track.muxPlaybackId) {
      const source = await muxService.createPlaybackUrl(track.muxPlaybackId);
      const get = async (
        url: string,
        contentType?: string,
        endSeconds?: number,
      ) => {
        const response = await fetch(muxUrl(url), {
          signal: AbortSignal.timeout(5000),
        });
        const body = await readBounded(response, remaining);
        remaining -= body.length;
        resources.push({
          url,
          body: body.toString("base64"),
          contentType:
            contentType ??
            response.headers.get("content-type") ??
            "application/octet-stream",
          endSeconds,
        });
        return body.toString("utf8");
      };
      const master = await get(source, "application/vnd.apple.mpegurl");
      const first = master
        .split(/\r?\n/)
        .find((line) => line.trim() && !line.startsWith("#"));
      const playlistUrl =
        master.includes("#EXT-X-STREAM-INF:") && first
          ? muxUrl(first, source)
          : source;
      const playlist =
        playlistUrl === source
          ? master
          : await get(playlistUrl, "application/vnd.apple.mpegurl");
      const init = playlist.match(/#EXT-X-MAP:.*URI="([^"]+)"/);
      if (init) await get(muxUrl(init[1]!, playlistUrl));
      // One complete fragment is reusable by HLS; a truncated fragment is not.
      const fragment = playlist.match(
        /#EXTINF:([\d.]+)[^\n]*\r?\n([^#\r\n][^\r\n]*)/,
      );
      if (fragment && Number(fragment[1]) <= 10 && remaining > 0) {
        try {
          await get(
            muxUrl(fragment[2]!, playlistUrl),
            undefined,
            Number(fragment[1]),
          );
        } catch (error) {
          if (!(error instanceof HttpError && error.statusCode === 413))
            throw error;
        }
      }
    } else if (track.masterStorageKey) {
      const metadata = await storageService.getStoredObjectMetadata(
        track.masterStorageKey,
        track.sourceFileName,
      );
      const end = Math.min(metadata.sizeBytes, remaining) - 1;
      if (end < 0) throw new HttpError(404, "Audio is empty");
      const media = await storageService.openStoredObjectRange(
        track.masterStorageKey,
        0,
        end,
      );
      const parts: Buffer[] = [];
      let size = 0;
      try {
        for await (const chunk of media.stream) {
          const part = Buffer.from(chunk);
          size += part.length;
          if (size > PRELOAD_BYTES)
            throw new HttpError(
              413,
              "Audio preparation exceeds its buffer budget",
            );
          parts.push(part);
        }
      } finally {
        media.stream.destroy();
      }
      resources.push({
        url: "media",
        body: Buffer.concat(parts).toString("base64"),
        contentType: media.contentType,
        totalBytes: metadata.sizeBytes,
      });
    } else throw new HttpError(404, "Audio preparation unavailable");
    const ticket = jwt.sign(
      {
        purpose: "playback-preload",
        trackId: track.id,
        actor: actorFor(actor),
        fingerprint: fingerprint(track),
        nonce: randomUUID(),
      },
      env.PLAYBACK_TOKEN_SECRET,
      { expiresIn: 600 },
    );
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", keyFor(ticket), iv);
    const safeResources = actor.startsWith("guest:")
      ? resources
          .filter((r) => !r.contentType.includes("mpegurl"))
          .map((r) => {
            if (r.url === "media") return r;
            const url = new URL(r.url);
            url.searchParams.delete("token");
            return { ...r, url: url.toString() };
          })
      : resources;
    const bodies = safeResources.map((resource) =>
      Buffer.from(resource.body, "base64"),
    );
    let offset = 0;
    const header = Buffer.from(
      JSON.stringify({
        resources: safeResources.map(({ body, ...resource }, index) => {
          const length = bodies[index]!.length;
          const entry = { ...resource, offset, length };
          offset += length;
          return entry;
        }),
      }),
    );
    const headerLength = Buffer.alloc(4);
    headerLength.writeUInt32BE(header.length);
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.concat([headerLength, header, ...bodies])),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    return {
      ticket,
      iv: iv.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    };
  },
  unlock(ticket: string, track: TrackSummary, actor: string) {
    try {
      const claims = jwt.verify(ticket, env.PLAYBACK_TOKEN_SECRET) as {
        purpose: string;
        trackId: string;
        actor: string;
        fingerprint: string;
      };
      if (
        claims.purpose !== "playback-preload" ||
        claims.trackId !== track.id ||
        claims.actor !== actorFor(actor) ||
        claims.fingerprint !== fingerprint(track)
      )
        return null;
      return keyFor(ticket).toString("base64");
    } catch {
      return null;
    }
  },
};
