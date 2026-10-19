import { useRef, useState, type ReactNode } from "react";
import { recordingDuration } from "../lib/recording-duration";
import {
  ArrowDown,
  ArrowUp,
  Trash2,
  CheckCircle2,
  LoaderCircle,
  Music2,
  Plus,
} from "lucide-react";
import type {
  ReleaseDetail,
  ReleaseTrack,
  TrackSummary,
} from "@music-city/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

export function ReleaseTracklistEditor({
  release,
  available,
  busy,
  audioOpen,
  onAdd,
  onUpload,
  onChange,
  onMove,
  onRemove,
  onReplace,
  onSetup,
  children,
}: {
  release: ReleaseDetail;
  available: TrackSummary[];
  busy: boolean;
  audioOpen: boolean;
  onAdd: (id: string) => void;
  onUpload: (files: File[]) => void;
  onChange: (id: string, patch: Partial<ReleaseTrack>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onReplace: (id: string) => void;
  onSetup: () => void;
  children?: ReactNode;
}) {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const planned = release.type === "single" ? 1 : release.expectedTrackCount;
  const remaining = planned
    ? Math.max(0, planned - release.tracks.length)
    : undefined;
  const complete = planned !== undefined && release.tracks.length === planned;
  const canAdd = remaining === undefined || remaining > 0;
  const library = available.filter((track) =>
    track.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section
      id="release-tracklist"
      tabIndex={-1}
      aria-label="Release tracklist"
      className="max-w-[800px] space-y-5 rounded-lg border border-border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {release.type === "single" ? "Your song" : "Your songs"}
          </h2>
          <p className="text-sm text-muted-foreground" role="status">
            {planned
              ? `${release.tracks.length} of ${planned} ${planned === 1 ? "song" : "songs"} added`
              : `${release.tracks.length} songs added`}
          </p>
        </div>
        <Button
          variant="link"
          className="h-auto p-0 text-sm"
          disabled={busy}
          onClick={onSetup}
        >
          Edit release setup
        </Button>
      </div>
      {release.tracks.length > 0 && (
        <ol className="divide-y divide-border">
          {release.tracks.map((item, index) => {
            const failed =
              item.track.status === "failed" ||
              item.track.muxAssetStatus === "errored";
            return (
              <li key={item.trackId} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="break-words font-medium">
                      {item.track.title}
                    </p>
                    <p
                      className={`flex items-center gap-2 text-sm ${failed ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {item.track.playbackReady ? (
                        <CheckCircle2 className="size-4 text-primary" />
                      ) : !failed ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : null}
                      {failed
                        ? "Audio needs replacing"
                        : item.track.playbackReady
                          ? "Audio ready"
                          : "Processing audio"}
                      {recordingDuration(item.track.runtime)
                        ? ` · ${recordingDuration(item.track.runtime)}`
                        : ""}
                    </p>
                    {failed && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => onReplace(item.trackId)}
                      >
                        Replace audio
                      </Button>
                    )}
                    {release.type !== "single" && (
                      <details className="text-sm text-muted-foreground">
                        <summary className="cursor-pointer py-1">
                          Track options
                        </summary>
                        <div className="mt-3 flex flex-wrap items-center gap-4">
                          <FormField
                            id={`disc-number-${item.trackId}`}
                            label="Disc"
                            className="w-20"
                          >
                            <Input
                              type="number"
                              min={1}
                              disabled={busy}
                              value={item.discNumber}
                              onChange={(e) =>
                                onChange(item.trackId, {
                                  discNumber: Number(e.target.value) || 1,
                                })
                              }
                            />
                          </FormField>
                          <label className="flex items-center gap-2">
                            <Checkbox
                              disabled={busy}
                              checked={item.isFocusTrack}
                              onChange={(e) =>
                                onChange(item.trackId, {
                                  isFocusTrack: e.target.checked,
                                })
                              }
                            />
                            Focus track
                          </label>
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {release.tracks.length > 1 && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={busy || index === 0}
                          onClick={() => onMove(index, -1)}
                          aria-label={`Move ${item.track.title} up`}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={busy || index === release.tracks.length - 1}
                          onClick={() => onMove(index, 1)}
                          aria-label={`Move ${item.track.title} down`}
                        >
                          <ArrowDown />
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={busy}
                      onClick={() => onRemove(item.trackId)}
                      aria-label={`Remove ${item.track.title} from release`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {!release.tracks.length && !audioOpen && (
        <div className="rounded-lg border border-dashed border-input p-6 text-center">
          <Music2 className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="font-medium">
            {release.type === "single" ? "Add your song" : "Add your songs"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload audio files or choose songs from your library.
          </p>
        </div>
      )}
      {children}
      {complete && !busy && (
        <p className="flex items-center gap-2 rounded-md bg-primary/5 p-3 text-sm">
          <CheckCircle2 className="size-4 text-primary" />
          {planned === 1
            ? "Your song is added. Continue to song details."
            : "All songs added. Use the arrows to change their order."}
        </p>
      )}
      {!canAdd && !complete && (
        <p role="alert" className="text-sm text-destructive">
          Remove extra songs or update the song count in Release setup.
        </p>
      )}
      {canAdd && !audioOpen && (
        <div className="flex flex-wrap gap-3 border-t border-border pt-5">
          <input
            ref={audioInputRef}
            type="file"
            aria-label="Choose audio files to upload"
            accept="audio/*,.flac,.m4a"
            multiple={remaining === undefined || remaining > 1}
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              if (!files.length) return;
              if (remaining !== undefined && files.length > remaining) {
                setSelectionError(
                  `Choose up to ${remaining} ${remaining === 1 ? "song" : "songs"}.`,
                );
                return;
              }
              setSelectionError("");
              onUpload(files);
            }}
          />
          <Button disabled={busy} onClick={() => audioInputRef.current?.click()}>
            <Plus className="size-4" />
            {release.tracks.length ? "Upload more songs" : "Upload audio"}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            aria-expanded={libraryOpen}
            onClick={() => setLibraryOpen((open) => !open)}
          >
            Choose from library
          </Button>
        </div>
      )}
      {selectionError && <p role="alert" className="text-sm text-destructive">{selectionError}</p>}
      {canAdd && !audioOpen && libraryOpen && (
        <div
          className="space-y-3 rounded-lg border border-border p-4"
          aria-label="Choose songs from library"
        >
          <Input
            aria-label="Search your songs"
            placeholder="Search your songs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="max-h-64 divide-y divide-border overflow-y-auto">
            {library.map((track) => (
              <li
                key={track.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="min-w-0 break-words text-sm">
                  {track.title}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => onAdd(track.id)}
                  aria-label={`Add ${track.title}`}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
          {!library.length && (
            <p className="text-sm text-muted-foreground">
              {available.length
                ? "No matching songs."
                : "No other songs available. Upload audio to add a new song."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
