import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Progress } from "@/components/ui/progress";
import { FormSection } from "@/components/studio/form-section";
import { ActionBar } from "@/components/studio/action-bar";

export function ReleaseArtworkEditor({
  image,
  preview,
  file,
  progress,
  busy,
  error,
  onSelect,
  onUpload,
}: {
  image?: string;
  preview: string | null;
  file: File | null;
  progress: number;
  busy: boolean;
  error?: string;
  onSelect: (file: File | undefined) => void;
  onUpload: () => void;
}) {
  return (
    <div className="max-w-[720px] space-y-6 rounded-lg border border-border bg-card p-4 sm:p-6">
      <FormSection
        title="Release artwork"
        description="Artwork represents the whole release. Choose a square JPG, PNG, or WebP image up to 10 MB."
      >
        <div className="grid items-start gap-6 sm:grid-cols-[200px_minmax(0,1fr)]">
          {preview || image ? (
            <Image
              src={(preview ?? image)!}
              sizes="200px" maxWidth={768}
              alt={
                preview
                  ? "Selected release artwork preview"
                  : "Saved release artwork"
              }
              className="aspect-square w-full max-w-[200px] rounded-lg object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full max-w-[200px] items-center justify-center rounded-lg border border-dashed border-input text-sm text-muted-foreground">
              No artwork yet
            </div>
          )}
          <div className="min-w-0 space-y-3">
            <FormField id="release-cover" label="Artwork file" error={error}>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(event) => onSelect(event.target.files?.[0])}
              />
            </FormField>
            {file ? (
              <p className="break-words text-sm text-muted-foreground">
                Selected: {file.name}
              </p>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                Your saved artwork stays in place until the upload succeeds.
              </p>
            )}
            {busy && file ? (
              <div role="status" className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground">
                  Uploading artwork · {progress}%
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </FormSection>
      <p role="status" className="text-sm text-muted-foreground">
        {busy && file
          ? "Uploading artwork..."
          : image && !file
            ? "Artwork saved"
            : file
              ? "Preparing artwork..."
              : "Add artwork"}
      </p>
      {error && (
        <ActionBar>
          <p className="text-sm text-muted-foreground">
            {file
              ? "Artwork not yet saved"
              : image
                ? "Artwork saved"
                : "Artwork required to publish"}
          </p>
          <Button disabled={busy || !file} onClick={onUpload}>
            {busy ? "Uploading cover..." : "Retry artwork upload"}
          </Button>
        </ActionBar>
      )}
    </div>
  );
}
