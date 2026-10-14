import { useEffect, useRef, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import type { TrackSummary } from "@music-city/shared";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { tracksApi } from "@/features/music/lib/tracks-api";

export const audioFailed = (track: TrackSummary) =>
  track.status === "failed" || track.muxAssetStatus === "errored";

export function ReleaseAudioStatus({
  tracks,
  token,
  busy,
  onUpdated,
  onFix,
}: {
  tracks: TrackSummary[];
  token: string;
  busy: boolean;
  onUpdated: (tracks: TrackSummary[]) => void;
  onFix: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const callback = useRef(onUpdated);
  callback.current = onUpdated;
  const pendingIds = tracks
    .filter((track) => !track.playbackReady && !audioFailed(track))
    .map((track) => track.id)
    .sort()
    .join(",");
  useEffect(() => {
    if (!pendingIds || busy) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      if (document.visibilityState === "hidden") {
        timer = setTimeout(check, 5000);
        return;
      }
      setChecking(true);
      try {
        const updated = await Promise.all(
          pendingIds
            .split(",")
            .map((id) => tracksApi.syncTrackMedia(token, id)),
        );
        if (cancelled) return;
        setCheckFailed(false);
        callback.current(updated);
        timer = setTimeout(check, 5000);
      } catch {
        if (!cancelled) setCheckFailed(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    timer = setTimeout(check, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pendingIds, token, busy, retry]);
  const ready = tracks.filter((track) => track.playbackReady).length;
  const failed = tracks.some(audioFailed);
  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-4 rounded-md border border-warning/50 bg-warning/5 p-4"
    >
      <div className="flex items-center gap-3">
        {failed || checkFailed ? (
          <CircleAlert
            aria-hidden="true"
            className="h-6 w-6 shrink-0 text-warning"
          />
        ) : (
          <LoaderCircle
            aria-hidden="true"
            className="h-6 w-6 shrink-0 animate-spin motion-reduce:animate-none text-warning"
          />
        )}
        <div className="min-w-0">
          <p className="font-medium">
            {failed
              ? "Audio needs attention"
              : checkFailed
                ? "Status check interrupted"
                : "Processing audio"}
          </p>
          <p className="text-sm text-muted-foreground">
            {ready} of {tracks.length}{" "}
            {tracks.length === 1 ? "recording" : "recordings"} ready
          </p>
        </div>
      </div>
      <Progress
        value={(ready / tracks.length) * 100}
        aria-label="Recordings ready"
      />
      <ul className="divide-y divide-border">
        {tracks.map((track) => (
          <li key={track.id} className="flex items-center gap-3 py-2 text-sm">
            {track.playbackReady ? (
              <CircleCheck
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-primary"
              />
            ) : audioFailed(track) ? (
              <CircleAlert
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-destructive"
              />
            ) : (
              <LoaderCircle
                aria-hidden="true"
                className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none text-warning"
              />
            )}
            <span className="min-w-0 flex-1 break-words">{track.title}</span>
            <span className="shrink-0 text-muted-foreground">
              {track.playbackReady
                ? "Ready"
                : audioFailed(track)
                  ? "Failed"
                  : "Processing"}
            </span>
          </li>
        ))}
      </ul>
      {failed ? (
        <Button variant="outline" disabled={busy} onClick={onFix}>
          Fix audio
        </Button>
      ) : null}
      {checkFailed ? (
        <Button
          variant="outline"
          disabled={busy || checking}
          onClick={() => {
            setCheckFailed(false);
            setRetry((value) => value + 1);
          }}
        >
          <RefreshCw />
          Retry status check
        </Button>
      ) : null}
    </div>
  );
}
