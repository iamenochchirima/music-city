import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormStepHeader } from "@/components/studio/form-step-header";

export function TrackUploadResult({
  title,
  trackId,
  playbackReady,
  onReset,
}: {
  title: string;
  trackId: string;
  playbackReady: boolean;
  onReset: () => void;
}) {
  return (
    <section className="max-w-[720px] space-y-5 rounded-lg border border-border bg-card p-4 sm:p-6">
      <FormStepHeader
        eyebrow="Track saved"
        title={
          playbackReady
            ? `${title} is ready for a release.`
            : `${title} was uploaded. Audio is processing.`
        }
        description={
          playbackReady
            ? "The recording is saved as a draft. Add it to a Single, EP, or album when you are ready."
            : "Your recording is saved. You can add it to a draft release now. Publishing becomes available after audio processing finishes."
        }
      />
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard/releases">Add to a release
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/dashboard/tracks/${trackId}`}>
            {playbackReady ? "Keep as draft" : "Check recording status"}
          </Link>
        </Button>
        <Button type="button" variant="ghost" onClick={onReset}>
          Upload another
        </Button>
      </div>
    </section>
  );
}
