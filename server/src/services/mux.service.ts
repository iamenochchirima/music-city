import Mux from "@mux/mux-node";

import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

const createClient = () =>
  new Mux({
    tokenId: env.MUX_TOKEN_ID,
    tokenSecret: env.MUX_TOKEN_SECRET,
    webhookSecret: env.MUX_WEBHOOK_SECRET,
    jwtSigningKey: env.MUX_SIGNING_KEY,
    jwtPrivateKey: env.MUX_PRIVATE_KEY,
  });

const requireClient = () => {
  if (!env.MUX_TOKEN_ID || !env.MUX_TOKEN_SECRET) {
    throw new HttpError(500, "MUX_TOKEN_ID and MUX_TOKEN_SECRET are required");
  }

  return createClient();
};

export const muxService = {
  isEnabled() {
    return env.MEDIA_PROVIDER === "mux";
  },

  usesSignedPlayback() {
    return Boolean(env.MUX_SIGNING_KEY && env.MUX_PRIVATE_KEY);
  },

  async createDirectUpload(input: {
    trackId: string;
    title: string;
    artistId: string;
  }) {
    const client = requireClient();
    const upload = await client.video.uploads.create({
      cors_origin: env.CLIENT_ORIGIN,
      timeout: 60 * 30,
      new_asset_settings: {
        passthrough: input.trackId,
        normalize_audio: true,
        playback_policies: [this.usesSignedPlayback() ? "signed" : "public"],
      },
    });

    if (!upload.url) {
      throw new HttpError(502, "Mux did not return an upload URL");
    }

    return upload;
  },

  async createAssetFromUrl(sourceUrl: string, trackId: string) {
    return requireClient().video.assets.create({
      inputs: [{ url: sourceUrl }],
      passthrough: trackId,
      normalize_audio: true,
      playback_policies: [this.usesSignedPlayback() ? "signed" : "public"],
    });
  },

  async findAssetByPassthrough(passthrough: string) {
    let inspected=0;
    for await (const asset of requireClient().video.assets.list({limit:100})) {
      if(asset.passthrough===passthrough)return asset;
      if(++inspected>=1000)break;
    }
    return null;
  },

  async getUpload(uploadId: string) {
    return requireClient().video.uploads.retrieve(uploadId);
  },

  async getAsset(assetId: string) {
    return requireClient().video.assets.retrieve(assetId);
  },

  async deleteAsset(assetId: string) {
    return requireClient().video.assets.delete(assetId);
  },

  async cancelUpload(uploadId: string) {
    return requireClient().video.uploads.cancel(uploadId);
  },

  async unwrapWebhook(body: string, headers: Headers) {
    return requireClient().webhooks.unwrap(body, headers);
  },

  async createPlaybackUrl(playbackId: string) {
    if (!this.usesSignedPlayback()) {
      return `https://stream.mux.com/${playbackId}.m3u8`;
    }

    const token = await requireClient().jwt.signPlaybackId(playbackId, {
      type: "video",
      expiration: "24h",
    });

    return `https://stream.mux.com/${playbackId}.m3u8?token=${encodeURIComponent(token)}`;
  },
};
