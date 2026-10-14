import { CircleCheck, CircleAlert } from "lucide-react";
import type { ReleaseDetail } from "@music-city/shared";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { ActionBar } from "@/components/studio/action-bar";

export type ReadinessIssue = { label: string; targetId: string };
export function ReleaseReview({
  release,
  issues,
  mode,
  date,
  busy,
  onMode,
  onDate,
  onResolve,
  onPublish,
  error,
}: {
  release: ReleaseDetail;
  issues: ReadinessIssue[];
  mode: Exclude<ReleaseDetail["status"], "archived">;
  date: string;
  busy: boolean;
  onMode: (mode: Exclude<ReleaseDetail["status"], "archived">) => void;
  onDate: (date: string) => void;
  onResolve: (targetId: string) => void;
  onPublish: () => void;
  error?: string;
}) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <section className="max-w-[720px] space-y-6 rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">
          {issues.length
            ? "Finish these items before publishing"
            : "Ready to publish"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {release.title} · {release.tracks.length} tracks ·{" "}
          {release.type.toUpperCase()}
        </p>
      </div>
      <ul className="space-y-2">
        {issues.length
          ? issues.map((issue) => (
              <li key={issue.label}>
                <button
                  type="button"
                  onClick={() => onResolve(issue.targetId)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CircleAlert className="h-4 w-4 shrink-0 text-warning" />
                  {issue.label}
                </button>
              </li>
            ))
          : ["Artwork uploaded", "Tracklist is valid", "Audio is ready"].map(
              (label) => (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <CircleCheck className="h-4 w-4 text-primary" />
                  {label}
                </li>
              ),
            )}
      </ul>
      <FormField
        id="release-plan"
        label="Release plan"
        hint="Changing this selection does not update the published release until you save."
      >
        <Select
          value={mode}
          disabled={busy}
          onChange={(event) =>
            onMode(
              event.target.value as Exclude<
                ReleaseDetail["status"],
                "archived"
              >,
            )
          }
        >
          <option value="draft">Keep as draft</option>
          <option value="published">Publish now</option>
          <option value="scheduled">Schedule release</option>
        </Select>
      </FormField>
      {mode === "scheduled" ? (
        <FormField
          id="release-date"
          label="Scheduled release time"
          hint={`Time zone: ${timezone}. Choose a future date and time.`}
          error={error}
        >
          <Input
            type="datetime-local"
            disabled={busy}
            value={date}
            onChange={(event) => onDate(event.target.value)}
          />
        </FormField>
      ) : null}
      <ActionBar>
        <p className="text-sm text-muted-foreground">
          {mode === "draft"
            ? release.hasRevision ? "Saves your revision while listeners keep the current release." : "Tracks stay in your library."
            : "Saves details and track order before publication."}
        </p>
        <Button disabled={busy} onClick={onPublish}>
          {busy
            ? "Saving..."
            : release.hasRevision && mode !== "draft" ? "Apply release update"
            : release.hasRevision ? "Save revision"
            : mode === "scheduled"
              ? "Schedule release"
              : mode === "published"
                ? "Release now"
                : release.status === "draft"
                  ? "Save as draft"
                  : "Move to draft"}
        </Button>
      </ActionBar>
    </section>
  );
}
