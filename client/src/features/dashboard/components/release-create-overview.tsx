import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { releasesApi } from "@/features/music/lib/releases-api";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StepNavigation } from "@/components/studio/step-navigation";
import { FormStepHeader } from "@/components/studio/form-step-header";
import { releaseSteps } from "../lib/release-steps";
export function ReleaseCreateOverview() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start(files: File[] = []) {
    if (!session?.token || busy) return;
    setBusy(true);
    setError("");
    try {
      const release = await releasesApi.createRelease(session.token, {
        title: "",
        genre: "",
        type: "single",
        artistName: session.displayName,
      });
      navigate(`/dashboard/releases/${release.id}?step=music`, {
        replace: true,
        state: { files },
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
        title="Add your music"
        description="Start with your songs. You can add the details while audio processes."
      />
      <StepNavigation
        steps={releaseSteps}
        completed={[]}
        current={0}
        onSelect={() => {}}
        disabled
        label="Release progress"
      />
      <section className="space-y-5 rounded-lg border border-border bg-card p-6">
        <label className="block space-y-3 rounded-lg border border-dashed border-input p-6 text-center">
          <span className="block text-lg font-semibold">
            Choose audio files
          </span>
          <span className="block text-sm text-muted-foreground">
            MP3, WAV, FLAC, AAC, OGG, or M4A · up to 500 MB each
          </span>
          <Input
            aria-label="Audio files"
            type="file"
            multiple
            accept="audio/*,.flac,.m4a"
            disabled={busy}
            className="h-auto py-2"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) void start(files);
            }}
          />
        </label>
        <Button variant="outline" disabled={busy} onClick={() => void start()}>
          Choose from library
        </Button>
        {busy && <p role="status">Starting your release...</p>}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
