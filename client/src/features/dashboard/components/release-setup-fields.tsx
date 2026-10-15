import type { ReleaseCreateInput } from "@music-city/shared";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ChoiceCard } from "@/components/ui/choice-card";

export function releaseSetupErrors(
  value: Pick<ReleaseCreateInput, "title" | "type" | "expectedTrackCount">,
) {
  const errors: Record<string, string> = {};
  if (!value.title.trim()) errors.title = "Give your release a name.";
  const count = value.type === "single" ? 1 : value.expectedTrackCount;
  if (!count || !Number.isInteger(count))
    errors.expectedTrackCount = "Enter the number of songs.";
  else if (value.type === "ep" && (count < 2 || count > 6))
    errors.expectedTrackCount = "Choose 2–6 songs for an EP.";
  else if (value.type === "album" && count < 7)
    errors.expectedTrackCount = "Choose at least 7 songs for an album.";
  return errors;
}

export function ReleaseSetupFields({
  value,
  onChange,
  errors = {},
}: {
  value: Pick<ReleaseCreateInput, "title" | "type" | "expectedTrackCount">;
  onChange: (patch: Partial<ReleaseCreateInput>) => void;
  errors?: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      <FormField id="release-title" label="Release name" error={errors.title}>
        <Input
          autoFocus
          maxLength={160}
          value={value.title}
          placeholder="Name your release"
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </FormField>
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">
          What are you releasing?
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["single", "ep", "album"] as const).map((type) => (
            <ChoiceCard
              key={type}
              name="release-format"
              value={type}
              label={
                type === "ep" ? "EP" : type === "single" ? "Single" : "Album"
              }
              description={
                type === "single"
                  ? "1 song"
                  : type === "ep"
                    ? "2–6 songs"
                    : "7 or more songs"
              }
              checked={value.type === type}
              onChange={() =>
                onChange({
                  type,
                  expectedTrackCount:
                    type === "single" ? 1 : type === "ep" ? 2 : 7,
                })
              }
            />
          ))}
        </div>
      </fieldset>
      {value.type !== "single" && (
        <FormField
          id="release-song-count"
          label="How many songs?"
          error={errors.expectedTrackCount}
        >
          <Input
            type="number"
            min={value.type === "ep" ? 2 : 7}
            max={value.type === "ep" ? 6 : undefined}
            step={1}
            value={value.expectedTrackCount ?? ""}
            className="max-w-32"
            onChange={(e) =>
              onChange({
                expectedTrackCount:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
          />
        </FormField>
      )}
    </div>
  );
}
