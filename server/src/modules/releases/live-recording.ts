import type { TrackSummary } from "@music-city/shared";

// Revision snapshots freeze recording content, not listening counters or sales settings.
export const liveRecording = (
  current: TrackSummary,
  snapshot: TrackSummary,
): TrackSummary => ({
  ...current,
  ...snapshot,
  plays: current.plays,
  likes: current.likes,
  purchaseEnabled: current.purchaseEnabled,
  purchasePrice: current.purchasePrice,
  purchaseAssetCode: current.purchaseAssetCode,
  purchaseAssetIssuer: current.purchaseAssetIssuer,
});
