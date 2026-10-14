import { CircleCheck, CircleAlert, LoaderCircle } from "lucide-react";
import type { ReleaseDetail } from "@music-city/shared";
import { Button } from "@/components/ui/button";
import { ChoiceCard } from "@/components/ui/choice-card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { ReleaseAudioStatus, audioFailed } from "./release-audio-status";
import type { TrackSummary } from "@music-city/shared";
import { ActionBar } from "@/components/studio/action-bar";

export type ReadinessIssue = {
  label: string;
  targetId: string;
  kind?: "audio";
};
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
  token,
  onAudioUpdated,
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
  token: string;
  onAudioUpdated: (tracks: TrackSummary[]) => void;
}) {
  const pendingAudio = release.tracks.some((item) => !item.track.playbackReady);
  const failedAudio = release.tracks.some((item) => audioFailed(item.track));
  const otherIssues = issues.filter((issue) => issue.kind !== "audio");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <section className="max-w-[720px] space-y-6 rounded-lg border border-border bg-card p-4 sm:p-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">
          {pendingAudio
            ? failedAudio
              ? "Audio needs attention"
              : "Waiting for audio"
            : issues.length
              ? "Finish these items before publishing"
              : "Ready to publish"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {release.title} · {release.tracks.length}{" "}
          {release.tracks.length === 1 ? "track" : "tracks"} ·{" "}
          {release.type.toUpperCase()}
        </p>
      </div>
      {pendingAudio ? (
        <ReleaseAudioStatus
          tracks={release.tracks.map((item) => item.track)}
          token={token}
          busy={busy}
          onUpdated={onAudioUpdated}
          onFix={() => onResolve("release-tracklist")}
        />
      ) : null}
      {otherIssues.length ? (
        <ul className="space-y-2">
          {otherIssues.map((issue) => (
            <li key={issue.label}>
              <button
                type="button"
                onClick={() => onResolve(issue.targetId)}
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CircleAlert
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-warning"
                />
                {issue.label}
              </button>
            </li>
          ))}
        </ul>
      ) : !pendingAudio ? (
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {["Artwork uploaded", "Tracklist is valid", "Audio is ready"].map(
            (label) => (
              <li key={label} className="flex items-center gap-2 text-sm">
                <CircleCheck
                  aria-hidden="true"
                  className="h-4 w-4 text-primary"
                />
                {label}
              </li>
            ),
          )}
        </ul>
      ) : null}
      <fieldset disabled={busy} className="space-y-3">
        <legend className="mb-3 text-base font-semibold">Release plan</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              {
                value: "draft",
                label: "Keep as draft",
                description: release.hasRevision
                  ? "Save this revision for later."
                  : "Save and finish later.",
              },
              {
                value: "published",
                label: "Publish now",
                description: release.hasRevision
                  ? "Apply your changes now."
                  : "Make your music available.",
              },
              {
                value: "scheduled",
                label: "Schedule release",
                description: "Choose a date and time.",
              },
            ] as const
          ).map((option) => (
            <ChoiceCard
              key={option.value}
              name="release-plan"
              aria-label={option.label}
              label={option.label}
              description={option.description}
              value={option.value}
              checked={mode === option.value}
              onChange={() => onMode(option.value)}
            />
          ))}
        </div>
      </fieldset>
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
            ? release.hasRevision
              ? "The current release stays live."
              : "Your release stays private."
            : mode === "scheduled"
              ? "Goes live at your selected time."
              : release.hasRevision
                ? "Updates the live release."
                : "Available to listeners immediately."}
        </p>
        <Button
          className={
            mode !== "draft" && pendingAudio
              ? "w-full border border-warning/50 bg-muted text-foreground disabled:opacity-100 sm:w-auto"
              : "w-full sm:w-auto"
          }
          disabled={busy || (mode !== "draft" && pendingAudio)}
          onClick={onPublish}
        >
          {busy || (mode !== "draft" && pendingAudio && !failedAudio) ? (
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {mode !== "draft" && pendingAudio
            ? failedAudio
              ? "Fix audio before publishing"
              : "Waiting for audio..."
            : busy
              ? "Saving..."
              : release.hasRevision && mode !== "draft"
                ? "Apply release update"
                : release.hasRevision
                  ? "Save revision"
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
