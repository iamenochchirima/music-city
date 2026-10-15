import { useId, useRef, useState } from "react";
import {
  trackCreditsAndIdentifiersSchema,
  type ArtistSummary,
  type TrackCreditRole,
} from "@music-city/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldHelp } from "@/components/ui/field-help";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { FormSection } from "@/components/studio/form-section";
import type { TrackCredit } from "@music-city/shared";

export type TrackMetadataDraft = {
  credits: TrackCredit[];
  isrc: string;
  recordLabel: string;
};
export const emptyTrackMetadata = (): TrackMetadataDraft => ({
  credits: [],
  isrc: "",
  recordLabel: "",
});
export const creditRoleLabels: Record<TrackCreditRole, string> = {
  composer: "Composer",
  lyricist: "Author",
  producer: "Producer",
  engineer: "Engineer",
  publisher: "Publisher",
  songwriter: "Songwriter",
  remixer: "Remixer",
};
export const validateTrackMetadata = (value: TrackMetadataDraft) => {
  const result = trackCreditsAndIdentifiersSchema.safeParse(value);
  const errors: Record<string, string> = {};
  if (!result.success)
    for (const issue of result.error.issues)
      errors[issue.path.join(".")] ??= issue.message;
  return { result, errors };
};

export function TrackMetadataEditor({
  value,
  onChange,
  artists,
  errors = {},
  disabled = false,
  hideIsrc = false,
}: {
  value: TrackMetadataDraft;
  onChange: (value: TrackMetadataDraft) => void;
  artists: ArtistSummary[];
  errors?: Record<string, string>;
  disabled?: boolean;
  hideIsrc?: boolean;
}) {
  const id = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  const updateCredit = (index: number, fields: Partial<TrackCredit>) =>
    onChange({
      ...value,
      credits: value.credits.map((credit, i) =>
        i === index ? { ...credit, ...fields } : credit,
      ),
    });
  const [expandedProfiles, setExpandedProfiles] = useState<Set<number>>(
    () => new Set(),
  );
  const removeCredit = (index: number) => {
    onChange({
      ...value,
      credits: value.credits.filter((_, i) => i !== index),
    });
    setExpandedProfiles(
      (current) =>
        new Set(
          [...current]
            .filter((i) => i !== index)
            .map((i) => (i > index ? i - 1 : i)),
        ),
    );
    queueMicrotask(() => addButton.current?.focus());
  };
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="sr-only">Track credits and identifiers</legend>
      <div className="space-y-8">
        <FormSection
          title="Contributors"
          help={
            <FieldHelp label="About contributor credits">
              Credits are optional and do not set royalty shares. Author means
              lyric writer. Publishers can be people or organizations.
            </FieldHelp>
          }
        >
          {value.credits.length > 0 && (
            <div className="divide-y divide-border">
              {value.credits.map((credit, index) => {
                const expanded =
                  expandedProfiles.has(index) ||
                  Boolean(errors[`credits.${index}.artistId`]);
                return (
                  <div key={index} className="space-y-3 py-4 first:pt-0">
                    <div className="grid min-w-0 grid-cols-[128px_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[144px_minmax(0,1fr)]">
                      <FormField
                        id={`${id}-role-${index}`}
                        label={`Role ${index + 1}`}
                        error={errors[`credits.${index}.role`]}
                      >
                        <Select
                          value={credit.role}
                          onChange={(e) =>
                            updateCredit(index, {
                              role: e.target.value as TrackCreditRole,
                            })
                          }
                        >
                          {Object.entries(creditRoleLabels).map(
                            ([role, label]) => (
                              <option key={role} value={role}>
                                {label}
                              </option>
                            ),
                          )}
                        </Select>
                      </FormField>
                      <FormField
                        id={`${id}-name-${index}`}
                        label={`Contributor name ${index + 1}`}
                        error={errors[`credits.${index}.name`]}
                      >
                        <Input
                          value={credit.name}
                          placeholder="Person or organization"
                          onChange={(e) =>
                            updateCredit(index, { name: e.target.value })
                          }
                        />
                      </FormField>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto min-h-11 whitespace-normal px-0 text-left"
                        aria-label={`${expanded ? "Hide" : "Show"} linked profile ${index + 1}`}
                        aria-expanded={expanded}
                        aria-controls={`${id}-profile-panel-${index}`}
                        onClick={() =>
                          setExpandedProfiles((current) => {
                            const next = new Set(current);
                            if (next.has(index)) next.delete(index);
                            else next.add(index);
                            return next;
                          })
                        }
                      >
                        {expanded
                          ? "Hide profile link"
                          : credit.artistId
                            ? `Linked profile: ${artists.find((artist) => artist.id === credit.artistId)?.name ?? "Existing artist"}`
                            : "Link a Music City profile"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`Remove contributor ${index + 1}`}
                        onClick={() => removeCredit(index)}
                      >
                        Remove
                      </Button>
                    </div>
                    {expanded ? (
                      <div id={`${id}-profile-panel-${index}`}>
                        <FormField
                          id={`${id}-profile-${index}`}
                          label={`Linked profile ${index + 1}`}
                          hint="Optional. A name is enough if the contributor has no account."
                          error={errors[`credits.${index}.artistId`]}
                        >
                          <SearchablePicker
                            id={`${id}-profile-${index}`}
                            value={credit.artistId ?? ""}
                            onValueChange={(artistId) =>
                              updateCredit(index, {
                                artistId: artistId || undefined,
                              })
                            }
                            placeholder="No linked profile"
                            searchPlaceholder="Search artist profiles"
                            options={[
                              { value: "", label: "No linked profile" },
                              ...(credit.artistId &&
                              !artists.some(
                                (artist) => artist.id === credit.artistId,
                              )
                                ? [
                                    {
                                      value: credit.artistId,
                                      label: "Existing linked profile",
                                    },
                                  ]
                                : []),
                              ...artists.map((artist) => ({
                                value: artist.id,
                                label: `${artist.name} · ${artist.walletAddress.slice(0, 6)}…${artist.walletAddress.slice(-4)}`,
                              })),
                            ]}
                          />
                        </FormField>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {errors.credits ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.credits}
            </p>
          ) : null}
          <Button
            ref={addButton}
            type="button"
            variant="outline"
            disabled={value.credits.length >= 32}
            onClick={() =>
              onChange({
                ...value,
                credits: [...value.credits, { role: "composer", name: "" }],
              })
            }
          >
            Add contributor
          </Button>
        </FormSection>
        <div className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
          {!hideIsrc && (
            <FormField
              id={`${id}-isrc`}
              label="Existing ISRC"
              help={
                <FieldHelp label="About ISRC">
                  Already have an ISRC for this recording? Enter it here.
                  Otherwise, leave it blank. Music City does not issue ISRCs.
                </FieldHelp>
              }
              error={errors.isrc}
            >
              <Input
                value={value.isrc}
                onChange={(e) => onChange({ ...value, isrc: e.target.value })}
                placeholder="USRC17607839"
              />
            </FormField>
          )}
          <FormField
            id={`${id}-label`}
            label="Record label"
            error={errors.recordLabel}
          >
            <Input
              value={value.recordLabel}
              onChange={(e) =>
                onChange({ ...value, recordLabel: e.target.value })
              }
              placeholder="Optional"
            />
          </FormField>
        </div>
      </div>
    </fieldset>
  );
}
