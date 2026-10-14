import type Mux from "@mux/mux-node";
import { muxService } from "../../services/mux.service.js";
import { tracksService } from "../tracks/tracks.service.js";
import { tracksRepository } from "../tracks/tracks.repository.js";
export const mediaService = {
  async unwrapMuxWebhook(body: string, headers: Headers) {
    return muxService.unwrapWebhook(body, headers);
  },
  async handleMuxWebhook(event: Mux.Webhooks.UnwrapWebhookEvent) {
    const data = event.data as {
      id: string;
      passthrough?: string;
      asset_id?: string;
      new_asset_settings?: { passthrough?: string };
    };
    const trackId = (
      data.passthrough ?? data.new_asset_settings?.passthrough
    )?.split("|")[0];
    if (!trackId) return null;
    const track = await tracksRepository.findById(trackId);
    if (!track || track.mediaProvider !== "mux") return null;
    const uploadEvent = event.type.startsWith("video.upload.");
    if (uploadEvent && track.muxUploadId !== data.id) return null;
    if (!uploadEvent && track.muxAssetId !== data.id) return null;
    if (event.type === "video.upload.asset_created" && data.asset_id) {
      await tracksService.applyMediaPatch(trackId, track.muxUploadId, {
        muxAssetId: data.asset_id,
      });
    }
    // Provider read-back resolves duplicate and reordered notifications authoritatively.
    return tracksService.syncMediaFromWorker(trackId);
  },
};
