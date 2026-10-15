import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ReleaseCreateInput } from "@music-city/shared";
import { useAuth } from "@/hooks/use-auth";
import { releasesApi } from "@/features/music/lib/releases-api";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
import { Button } from "@/components/ui/button";
import { StepNavigation } from "@/components/studio/step-navigation";
import { FormStepHeader } from "@/components/studio/form-step-header";
import { ReleaseSetupFields, releaseSetupErrors } from "./release-setup-fields";
import { releaseSteps } from "../lib/release-steps";
export function ReleaseCreateOverview() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState<ReleaseCreateInput>({
    title: "",
    type: "single",
    expectedTrackCount: 1,
    genre: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function start() {
    if (!session?.token || busy) return;
    const nextErrors = releaseSetupErrors(value);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    setError("");
    try {
      const release = await releasesApi.createRelease(session.token, {
        ...value,
        title: value.title.trim(),
        artistName: session.displayName,
      });
      navigate(`/dashboard/releases/${release.id}?step=music`, {
        replace: true,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't start your release. Try again.",
      );
      setBusy(false);
    }
  }
  if (!session) return <p>Connect your account to create a release.</p>;
  if (!["artist", "both"].includes(session.primaryIntent))
    return <ArtistAccessGate action="create a release" />;
  return (
    <div className="max-w-[720px] space-y-6">
      <FormStepHeader
        eyebrow="Create a release"
        title="Set up your release"
        description="Give it a name and choose what you’re releasing."
      />
      <StepNavigation
        steps={releaseSteps}
        completed={[]}
        current={0}
        onSelect={() => {}}
        disabled
        label="Release progress"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
        className="space-y-6 rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        <fieldset disabled={busy}>
          <ReleaseSetupFields
            value={value}
            onChange={(patch) =>
              setValue((current) => ({ ...current, ...patch }))
            }
            errors={errors}
          />
        </fieldset>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end border-t border-border pt-5">
          <Button disabled={busy} type="submit">
            {busy ? "Starting your release..." : "Continue to songs"}
          </Button>
        </div>
      </form>
    </div>
  );
}
