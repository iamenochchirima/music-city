import { useEffect, useState } from "react";
import type {
  ArtistSummary,
  ReleaseDetail,
  TrackSummary,
} from "@music-city/shared";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TrackMetadataEditor } from "./track-metadata-editor";
export function ReleaseTrackInformation({
  release,
  artists,
  busy,
  errors,
  onChange,
  selectedTrack,
}: {
  selectedTrack: string | null;
  release: ReleaseDetail;
  artists: ArtistSummary[];
  busy: boolean;
  errors: Record<string, Record<string, string>>;
  onChange: (id: string, patch: Partial<TrackSummary>) => void;
}) {
  const [selected, setSelected] = useState<string | null>(selectedTrack);
  useEffect(() => {
    if (selectedTrack) setSelected(selectedTrack);
  }, [selectedTrack]);
  const active =
    release.tracks.find((item) => item.trackId === selected) ??
    release.tracks[0];
  return (
    <section
      id="release-track-information"
      tabIndex={-1}
      className="max-w-[720px] space-y-6 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <div>
        <h3 className="text-lg font-semibold">Song details</h3>
      </div>
      {!active ? (
        <p className="text-sm text-muted-foreground">
          Add music in step 2 before editing track information.
        </p>
      ) : (
        <>
          {release.tracks.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label="Choose a track">
              {release.tracks.map((item, index) => (
                <Button
                  key={item.trackId}
                  variant={
                    active.trackId === item.trackId ? "secondary" : "outline"
                  }
                  disabled={busy}
                  aria-pressed={active.trackId === item.trackId}
                  onClick={() => setSelected(item.trackId)}
                  className="max-w-full h-auto whitespace-normal text-left"
                >
                  {index + 1}. {item.track.title}
                </Button>
              ))}
            </div>
          )}
          <fieldset
            disabled={busy}
            className="min-w-0 space-y-6"
            key={active.trackId}
          >
            <FormField
              id={`release-track-title-${active.trackId}`}
              label="Song title"
              error={errors[active.trackId]?.title}
            >
              <Input
                value={active.track.title}
                onChange={(e) =>
                  onChange(active.trackId, { title: e.target.value })
                }
              />
            </FormField>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <Checkbox
                checked={!!active.track.isExplicit}
                onChange={(e) =>
                  onChange(active.trackId, { isExplicit: e.target.checked })
                }
              />
              Explicit lyrics
            </label>
            <TrackMetadataEditor
              value={{
                credits: active.track.credits ?? [],
                isrc: active.track.isrc ?? "",
                recordLabel: active.track.recordLabel ?? "",
              }}
              onChange={(patch) => onChange(active.trackId, patch)}
              artists={artists}
              disabled={busy}
              errors={errors[active.trackId]}
            />
          </fieldset>
        </>
      )}
    </section>
  );
}
