import { recordingDuration } from "../lib/recording-duration";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type {
  ReleaseDetail,
  ReleaseTrack,
  TrackSummary,
} from "@music-city/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { ActionBar } from "@/components/studio/action-bar";

export function ReleaseTracklistEditor({
  release,
  available,
  selected,
  busy,
  onSelect,
  onAdd,
  onUpload,
  onChange,
  onMove,
  onRemove,
  onSave,
  onEdit,
}: {
  release: ReleaseDetail;
  available: TrackSummary[];
  selected: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onUpload: () => void;
  onChange: (id: string, patch: Partial<ReleaseTrack>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onSave: () => void;
  onEdit: (id: string) => void;
}) {
  return (
    <section
      id="release-tracklist"
      tabIndex={-1}
      aria-label="Release tracklist"
      className="space-y-6 rounded-lg border border-border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
    >
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Tracklist</h3>
        <p className="text-sm text-muted-foreground">
          Order recordings and choose one optional focus track.
        </p>
      </div>
      {release.tracks.length ? (
        <ol className="divide-y divide-border">
          {release.tracks.map((item, index) => (
            <li key={item.trackId} className="space-y-4 py-5 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="break-words font-medium">{item.track.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {recordingDuration(item.track.runtime) ? (
                      <>{recordingDuration(item.track.runtime)} · </>
                    ) : null}
                    {item.track.isExplicit ? "Explicit" : "Not explicit"} ·{" "}
                    {item.track.playbackReady ? "Ready" : "Processing"}
                  </p>
                  <Button variant="link" className="px-0" disabled={busy} onClick={() => onEdit(item.trackId)}>Edit track information</Button>
                </div>
                <div className="flex shrink-0 gap-1">
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
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <FormField
                  id={`track-number-${item.trackId}`}
                  label="Track"
                  className="w-20"
                >
                  <Input
                    type="number"
                    min={1}
                    disabled={busy}
                    value={item.trackNumber}
                    aria-label={`Track number for ${item.track.title}`}
                    onChange={(event) =>
                      onChange(item.trackId, {
                        trackNumber: Number(event.target.value) || 1,
                      })
                    }
                  />
                </FormField>
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
                    aria-label={`Disc number for ${item.track.title}`}
                    onChange={(event) =>
                      onChange(item.trackId, {
                        discNumber: Number(event.target.value) || 1,
                      })
                    }
                  />
                </FormField>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <Checkbox
                    disabled={busy}
                    checked={item.isFocusTrack}
                    aria-label={`Set ${item.track.title} as focus track`}
                    onChange={(event) =>
                      onChange(item.trackId, {
                        isFocusTrack: event.target.checked,
                      })
                    }
                  />
                  Focus
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  className="ml-auto text-destructive"
                  disabled={busy}
                  onClick={() => onRemove(item.trackId)}
                  aria-label={`Remove ${item.track.title} from release`}
                >
                  <Trash2 />
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-6 text-sm text-muted-foreground">
          No tracks assigned yet. Add an uploaded recording or upload a new
          track.
        </p>
      )}
      {release.tracks.length ? (
        <ActionBar>
          <p className="text-sm text-muted-foreground">
            {release.tracks.length} tracks
          </p>
          <Button variant="outline" disabled={busy} onClick={onSave}>
            {busy ? "Saving..." : "Save order"}
          </Button>
        </ActionBar>
      ) : null}
      <div className="space-y-4 border-t border-border pt-6">
        <FormField id="release-add-track" label="Add an uploaded track">
          <Select
            disabled={busy}
            value={selected}
            onChange={(event) => onSelect(event.target.value)}
          >
            <option value="">Select a track</option>
            {available.map((track) => (
              <option key={track.id} value={track.id}>
                {track.title}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={busy || !selected}
            onClick={onAdd}
          >
            Add track to release
          </Button>
          <Button variant="outline" disabled={busy} onClick={onUpload}>
            Upload a new track
          </Button>
        </div>
      </div>
    </section>
  );
}
