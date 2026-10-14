import { useState } from "react";
import type { TrackSummary } from "@music-city/shared";
import { releasesApi } from "@/features/music/lib/releases-api";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export function ReleaseTrackLabels({
  releaseId,
  label,
  tracks,
  token,
  onApplied,
}: {
  releaseId: string;
  label: string;
  tracks: TrackSummary[];
  token: string;
  onApplied: (tracks: TrackSummary[]) => void;
}) {
  const [preview, setPreview] = useState<{
    label: string;
    tracks: TrackSummary[];
  } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function openPreview(items: TrackSummary[], nextLabel: string) {
    setPreview({ label: nextLabel, tracks: items });
    setSelected(
      items
        .filter((track) => !track.recordLabel?.trim())
        .map((track) => track.id),
    );
    setOverwrite(false);
    setError("");
  }
  async function apply() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const updated = await releasesApi.applyTrackMetadata(token, releaseId, {
        recordLabel: preview.label,
        trackIds: selected,
        overwrite,
        expectedLabels: Object.fromEntries(
          preview.tracks
            .filter((track) => selected.includes(track.id))
            .map((track) => [track.id, track.recordLabel ?? ""]),
        ),
      });
      onApplied(updated);
      setPreview(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to apply record label",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const latest = await releasesApi.getManageRelease(token, releaseId);
      if (!latest) throw new Error("Release not found");
      const items = latest.tracks.map((item) => item.track);
      onApplied(items);
      openPreview(items, label.trim());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to refresh preview",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 space-y-3">
      <Button
        type="button"
        variant="outline"
        disabled={
          busy || !label.trim() || label.trim().length > 120 || !tracks.length
        }
        onClick={() => openPreview(tracks, label.trim())}
      >
        Apply record label to tracks
      </Button>
      <p className="text-xs text-muted-foreground">
        Copies the label to selected tracks. Future release label edits do not
        change those tracks.
      </p>
      {preview && (
        <Dialog
          title="Apply record label to tracks"
          description={`Copy "${preview.label}" to the selected recordings.`}
          busy={busy}
          onClose={() => setPreview(null)}
        >
          <section aria-label="Record label preview" className="space-y-4">
            <label className="flex min-h-11 items-start gap-3 text-sm text-foreground">
              <Checkbox
                checked={overwrite}
                disabled={busy}
                onChange={(e) => {
                  setOverwrite(e.target.checked);
                  if (!e.target.checked)
                    setSelected(
                      selected.filter(
                        (id) =>
                          !preview.tracks
                            .find((track) => track.id === id)
                            ?.recordLabel?.trim(),
                      ),
                    );
                }}
              />
              Allow replacing existing track labels
            </label>
            <ul className="divide-y divide-border space-y-3">
              {preview.tracks.map((track) => (
                <li key={track.id} className="pt-3 first:pt-0">
                  <label className="flex min-h-11 items-start gap-3 text-sm text-foreground">
                    <Checkbox
                      checked={selected.includes(track.id)}
                      disabled={
                        busy || Boolean(track.recordLabel?.trim() && !overwrite)
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, track.id]
                            : selected.filter((id) => id !== track.id),
                        )
                      }
                    />
                    <span className="min-w-0 break-words">
                      {track.title}
                      <span className="block text-xs text-muted-foreground">
                        Current label: {track.recordLabel || "None"}. Proposed
                        label: {preview.label}.
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy || !selected.length}
                onClick={() => void apply()}
              >
                {busy ? "Applying..." : "Confirm label changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void refresh()}
              >
                Refresh preview
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                Cancel
              </Button>
            </div>
          </section>
        </Dialog>
      )}
    </div>
  );
}
