import type { ReleaseCreateInput } from "@music-city/shared";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ChoiceCard } from "@/components/ui/choice-card";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { musicGenres } from "@/features/music/data/metadata-options";
export function ReleaseBasicsFields({
  value,
  onChange,
  errors = {},
  hideTitle = false,
}: {
  value: ReleaseCreateInput;
  onChange: (patch: Partial<ReleaseCreateInput>) => void;
  errors?: Record<string, string>;
  hideTitle?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {!hideTitle && (
        <FormField id="release-title" label="Title" error={errors.title}>
          <Input
            autoFocus
            value={value.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </FormField>
      )}
      <FormField
        id="release-artist-name"
        label="Artist name"
        error={errors.artistName}
      >
        <Input
          value={value.artistName ?? ""}
          onChange={(e) => onChange({ artistName: e.target.value })}
        />
      </FormField>
      <fieldset className="space-y-3 sm:col-span-2">
        <legend className="mb-3 text-sm font-medium">Release format</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["single", "ep", "album"] as const).map((type) => (
            <ChoiceCard
              key={type}
              name="release-format"
              value={type}
              label={
                type === "ep" ? "EP" : type === "single" ? "Single" : "Album"
              }
              checked={value.type === type}
              onChange={() => onChange({ type })}
            />
          ))}
        </div>
        {errors.type && (
          <p role="alert" className="text-destructive">
            {errors.type}
          </p>
        )}
      </fieldset>
      <FormField id="release-genre" label="Genre" error={errors.genre}>
        <SearchablePicker
          id="release-genre"
          value={value.genre}
          onValueChange={(genre) => onChange({ genre })}
          options={musicGenres}
          placeholder="Select a genre"
          searchPlaceholder="Search genres"
          required
        />
      </FormField>
    </div>
  );
}
