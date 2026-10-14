import { useState } from "react";
import type {
  ArtistSummary,
  ReleaseDetail,
  TrackSummary,
} from "@music-city/shared";
import { Button } from "@/components/ui/button";
import {
  TrackMetadataEditor,
  emptyTrackMetadata,
} from "./track-metadata-editor";
export function ReleaseSharedDetails({
  release,
  artists,
  busy,
  onChange,
}: {
  release: ReleaseDetail;
  artists: ArtistSummary[];
  busy: boolean;
  onChange: (id: string, patch: Partial<TrackSummary>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(emptyTrackMetadata);
  const [ids, setIds] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  if (release.tracks.length < 2) return null;
  return (
    <section className="max-w-[720px] space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
      <Button
        variant="outline"
        disabled={busy}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) setIds(release.tracks.map((t) => t.trackId));
        }}
      >
        Apply shared credits & label
      </Button>
      {open && (
        <div className="space-y-4">
          <TrackMetadataEditor
            hideIsrc
            value={value}
            onChange={setValue}
            artists={artists}
            disabled={busy}
          />
          <fieldset disabled={busy} className="space-y-3">
            <legend className="mb-3 text-sm font-medium">Apply to songs</legend>
            {release.tracks.map((item) => (
              <label
                key={item.trackId}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={ids.includes(item.trackId)}
                  onChange={(e) =>
                    setIds((current) =>
                      e.target.checked
                        ? [...current, item.trackId]
                        : current.filter((id) => id !== item.trackId),
                    )
                  }
                />
                {item.track.title}
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              Replace existing credits and labels
            </label>
          </fieldset>
          <Button
            disabled={
              busy ||
              !ids.length ||
              (!value.credits.length && !value.recordLabel.trim())
            }
            onClick={() => {
              release.tracks
                .filter((t) => ids.includes(t.trackId))
                .forEach(({ trackId, track }) =>
                  onChange(trackId, {
                    ...(value.credits.length &&
                    (!track.credits?.length || overwrite)
                      ? { credits: value.credits.map((c) => ({ ...c })) }
                      : {}),
                    ...(value.recordLabel.trim() &&
                    (!track.recordLabel?.trim() || overwrite)
                      ? { recordLabel: value.recordLabel.trim() }
                      : {}),
                  }),
                );
              setOpen(false);
            }}
          >
            Apply to selected songs
          </Button>
        </div>
      )}
    </section>
  );
}
