import type { ReleaseCreateInput } from "@music-city/shared";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { musicGenres } from "@/features/music/data/metadata-options";
export function ReleaseBasicsFields({
  value,
  onChange,
  errors = {},
}: {
  value: ReleaseCreateInput;
  onChange: (patch: Partial<ReleaseCreateInput>) => void;
  errors?: Record<string, string>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField id="release-title" label="Title" error={errors.title}>
        <Input
          autoFocus
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </FormField>
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
      <FormField id="release-type" label="Type" error={errors.type}>
        <Select
          value={value.type}
          onChange={(e) =>
            onChange({ type: e.target.value as ReleaseCreateInput["type"] })
          }
        >
          <option value="single">Single · 1 track</option>
          <option value="ep">EP · 2–6 tracks</option>
          <option value="album">Album · 7+ tracks</option>
        </Select>
      </FormField>
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
