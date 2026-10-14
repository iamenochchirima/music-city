import type { ReactNode } from "react";
import type { ReleaseDetail } from "@music-city/shared";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSection } from "@/components/studio/form-section";

export function ReleaseDetailsEditor({
  release,
  onChange,
  busy,
  errors,
  children,
}: {
  release: ReleaseDetail;
  onChange: (patch: Partial<ReleaseDetail>) => void;
  busy: boolean;
  errors: Record<string, string>;
  children?: ReactNode;
}) {
  return (
    <fieldset
      disabled={busy}
      className="max-w-[720px] min-w-0 space-y-6 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <FormSection
        title="Release details"
        description="Add context for listeners."
      >
        <FormField
          id="release-description"
          label="Description"
          hint="Optional. Describe this release in up to 1,000 characters."
          error={errors.description}
        >
          <Textarea
            value={release.description ?? ""}
            onChange={(event) => onChange({ description: event.target.value })}
            className="min-h-28"
          />
        </FormField>
      </FormSection>
    </fieldset>
  );
}
