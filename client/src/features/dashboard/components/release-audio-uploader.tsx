import { useEffect, useRef, useState } from "react";
import type { ReleaseDetail, TrackSummary } from "@music-city/shared";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { releasesApi } from "@/features/music/lib/releases-api";
import { uploadsApi } from "@/features/uploads/lib/uploads-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { LoaderCircle, CircleCheck, CircleAlert } from "lucide-react";
type Upload = {
  file: File;
  progress: number;
  state: "uploading" | "done" | "failed";
  track?: TrackSummary;
  error?: string;
  replaceId?: string;
};
export function ReleaseAudioUploader({
  release,
  token,
  onAdded,
  onSaved,
  onBusy,
  onClose,
  initialFiles = [],
  replaceId,
}: {
  release: ReleaseDetail;
  token: string;
  onSaved: (t: TrackSummary) => void;
  onAdded: (r: ReleaseDetail, t: TrackSummary) => void;
  onBusy: (busy: boolean) => void;
  onClose: () => void;
  initialFiles?: File[];
  replaceId?: string;
}) {
  const [items, setItems] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const running = useRef(false);
  const callbacks = useRef({ onAdded, onSaved, onBusy });
  callbacks.current = { onAdded, onSaved, onBusy };
  async function run(batch: Upload[]) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    callbacks.current.onBusy(true);
    for (const item of batch) {
      const update = (patch: Partial<Upload>) => {
        Object.assign(item, patch);
        setItems((current) =>
          current.map((row) => (row.file === item.file ? { ...item } : row)),
        );
      };
      let createdId: string | undefined;
      let sessionId: string | undefined;
      update({ state: "uploading", error: undefined });
      try {
        if (
          item.file.size > 500 * 1024 * 1024 ||
          !/\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(item.file.name)
        )
          throw new Error("Choose a supported audio file up to 500 MB.");
        if (!item.track) {
          const track = item.replaceId
            ? release.tracks.find((t) => t.trackId === item.replaceId)!.track
            : await tracksApi.createTrack(token, {
                title: item.file.name.replace(/\.[^.]+$/, "").slice(0, 160),
                artistName: release.artistName,
                genre: release.genre,
                isExplicit: false,
                featuredArtists: [],
                credits: [],
              });
          if (!item.replaceId) createdId = track.id;
          const session = await uploadsApi.createSession(token, {
            trackId: track.id,
            purpose: "audio",
            fileName: item.file.name,
            contentType: item.file.type || "audio/wav",
            sizeBytes: item.file.size,
          });
          sessionId = session.id;
          const eTag = await uploadsApi.uploadFile(
            token,
            session,
            item.file,
            (value) => update({ progress: value }),
          );
          const result = await uploadsApi.completeSession(token, session.id, {
            uploadSessionId: session.id,
            eTag,
          });
          if (!result.track) throw new Error("Couldn't complete this upload.");
          update({ track: result.track });
          callbacks.current.onSaved(result.track);
        }
        const updated = item.replaceId
          ? await releasesApi.getManageRelease(token, release.id)
          : await releasesApi.addTrackToRelease(token, release.id, {
              trackId: item.track!.id,
              discNumber: 1,
              isFocusTrack: false,
            });
        if (!updated) throw new Error("Couldn't add the song to your release.");
        callbacks.current.onAdded(updated, item.track!);
        update({ state: "done", progress: 100 });
      } catch (e) {
        if (!item.track) {
          if (sessionId)
            await uploadsApi
              .cancelSession(token, sessionId)
              .catch(() => undefined);
          if (createdId)
            await tracksApi
              .deleteTrack(token, createdId)
              .catch(() => undefined);
        }
        update({
          state: "failed",
          error: e instanceof Error ? e.message : "Upload failed",
        });
      }
    }
    running.current = false;
    setBusy(false);
    callbacks.current.onBusy(false);
  }
  const choose = (files: File[]) => {
    const batch = files.map((file) => ({
      file,
      progress: 0,
      state: "uploading" as const,
      replaceId,
    }));
    setItems((current) => [...current, ...batch]);
    void run(batch);
  };
  useEffect(() => {
    if (!started.current && initialFiles.length) {
      started.current = true;
      choose(initialFiles);
    }
  }, []);
  return (
    <section className="space-y-4 rounded-lg border border-dashed border-input p-5">
      <label className="block space-y-2">
        <span className="block font-semibold">
          {replaceId ? "Replace audio" : "Add audio files"}
        </span>
        <Input
          type="file"
          aria-label={replaceId ? "Replacement audio" : "Audio files"}
          multiple={!replaceId}
          disabled={busy}
          accept="audio/*,.flac,.m4a"
          className="h-auto py-2"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) choose(files);
            e.target.value = "";
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        MP3, WAV, FLAC, AAC, OGG, or M4A · up to 500 MB each
      </p>
      {items.map((item, i) => (
        <div key={i} className="space-y-2" role="status">
          <div className="flex items-center gap-2 text-sm">
            {item.state === "uploading" ? (
              <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
            ) : item.state === "done" ? (
              <CircleCheck className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <CircleAlert className="h-4 w-4 shrink-0 text-destructive" />
            )}
            <span className="min-w-0 flex-1 break-words">{item.file.name}</span>
            <span>
              {item.state === "uploading"
                ? `${item.progress}%`
                : item.state === "done"
                  ? "Uploaded"
                  : "Failed"}
            </span>
          </div>
          {item.state === "uploading" && (
            <Progress
              value={item.progress}
              aria-label={`Uploading ${item.file.name}`}
            />
          )}{" "}
          {item.error && (
            <p role="alert" className="text-sm text-destructive">
              {item.error}
            </p>
          )}
          {item.state === "failed" && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void run([item])}
            >
              {item.track ? "Retry adding song" : "Retry upload"}
            </Button>
          )}
        </div>
      ))}
      {!busy && (
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      )}
    </section>
  );
}
