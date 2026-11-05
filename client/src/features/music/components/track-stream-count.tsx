import type { TrackSummary } from "@music-city/shared";
import { useStreamCount } from "@/features/playback/lib/stream-counts";

export function TrackStreamCount({ track, showLabel = true }: { track: TrackSummary; showLabel?: boolean }) {
  const count = useStreamCount(track.id, track.plays);
  return <>{count.toLocaleString()}{showLabel ? ` ${count === 1 ? "stream" : "streams"}` : ""}</>;
}
