import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { TrackSummary } from "@music-city/shared";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const audioFailed = (track: TrackSummary) =>
  track.status === "failed" || track.muxAssetStatus === "errored";

export function ReleaseAudioStatus({
  tracks,
  busy,
  onFix,
}: {
  tracks: TrackSummary[];
  busy: boolean;
  onFix: () => void;
}) {
  const ready = tracks.filter((track) => track.playbackReady).length;
  const failed = tracks.some(audioFailed);
  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-4 rounded-md border border-warning/50 bg-warning/5 p-4"
    >
      <div className="flex items-center gap-3">
        {failed ? (
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
            {failed ? "Audio needs attention" : "Processing audio"}
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
    </div>
  );
}
