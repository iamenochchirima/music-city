import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  releaseCreateSchema,
  type ReleaseCreateInput,
} from "@music-city/shared";
import { useAuth } from "@/hooks/use-auth";
import { releasesApi } from "@/features/music/lib/releases-api";
import { ApiClientError } from "@/lib/api/http-client";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
import { Button } from "@/components/ui/button";
import { ActionBar } from "@/components/studio/action-bar";
import { StepNavigation } from "@/components/studio/step-navigation";
import { FormStepHeader } from "@/components/studio/form-step-header";
import { ReleaseBasicsFields } from "./release-basics-fields";
import { releaseSteps } from "../lib/release-steps";
export function ReleaseCreateOverview() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState<ReleaseCreateInput>({
    title: "",
    artistName: session?.displayName ?? "",
    type: "single",
    genre: "",
  });
  useEffect(() => {
    if (session?.displayName)
      setValue((current) => ({
        ...current,
        artistName: current.artistName || session.displayName,
      }));
  }, [session?.displayName]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = async () => {
    if (!session?.token) return;
    const parsed = releaseCreateSchema.safeParse({
      ...value,
      title: value.title.trim(),
      artistName: value.artistName?.trim(),
      genre: value.genre.trim(),
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join("."),
            issue.message,
          ]),
        ),
      );
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setBusy(true);
    setErrors({});
    setError("");
    try {
      const release = await releasesApi.createRelease(
        session.token,
        parsed.data,
      );
      navigate(`/dashboard/releases/${release.id}?step=music`, {
        replace: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create release");
      if (e instanceof ApiClientError) setErrors(e.fieldErrors);
    } finally {
      setBusy(false);
    }
  };
  if (!session) return <p>Connect your account to create a release.</p>;
  if (!["artist", "both"].includes(session.primaryIntent))
    return <ArtistAccessGate action="create a release" />;
  return (
    <div className="max-w-[720px] space-y-6">
      <FormStepHeader
        eyebrow="Create a release"
        title="Release basics"
        description="Start a Single, EP, or Album. Your draft is saved when you continue."
      />
      <StepNavigation
        steps={releaseSteps}
        completed={[]}
        current={0}
        onSelect={(index) => {
          if (index > 0) void create();
        }}
        disabled={busy}
        label="Release progress"
      />
      <form
        className="space-y-6 rounded-lg border border-border bg-card p-4 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <fieldset disabled={busy}>
          <ReleaseBasicsFields
            value={value}
            onChange={(patch) =>
              setValue((current) => ({ ...current, ...patch }))
            }
            errors={errors}
          />
        </fieldset>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}. Your details are still here. Try again.
          </p>
        ) : null}
        <ActionBar>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => navigate("/dashboard/releases")}
          >
            Cancel
          </Button>
          <Button disabled={busy} type="submit">
            {busy ? "Creating draft..." : "Save draft & continue"}
          </Button>
        </ActionBar>
      </form>
    </div>
  );
}
