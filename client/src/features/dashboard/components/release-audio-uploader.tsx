import { useState } from "react";
import type { ReleaseDetail, TrackSummary } from "@music-city/shared";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { releasesApi } from "@/features/music/lib/releases-api";
import { uploadsApi } from "@/features/uploads/lib/uploads-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Progress } from "@/components/ui/progress";
export function ReleaseAudioUploader({
  release,
  token,
  onAdded,
  onSaved,
  onBusy,
  onClose,
}: {
  release: ReleaseDetail;
  token: string;
  onSaved: (track: TrackSummary) => void;
  onAdded: (release: ReleaseDetail, track: TrackSummary) => void;
  onBusy: (busy: boolean) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  // Keep completed audio on an attachment failure so retry never uploads it twice.
  const [savedTrack, setSavedTrack] = useState<TrackSummary | null>(null);
  const upload = async () => {
    if (!savedTrack && (!title.trim() || !file)) {
      setError("Enter a track title and choose an audio file.");
      return;
    }
    let sessionId: string | undefined;
    let createdId: string | undefined;
    let completedTrack = savedTrack;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      if (!completedTrack && file) {
        setStage("Preparing audio...");
        const track = await tracksApi.createTrack(token, {
          title: title.trim(),
          artistName: release.artistName,
          genre: release.genre,
          isExplicit: false,
          featuredArtists: [],
          credits: [],
        });
        createdId = track.id;
        const session = await uploadsApi.createSession(token, {
          trackId: track.id,
          purpose: "audio",
          fileName: file.name,
          contentType: file.type || "audio/wav",
          sizeBytes: file.size,
        });
        sessionId = session.id;
        setStage("Uploading audio...");
        const eTag = await uploadsApi.uploadFile(
          token,
          session,
          file,
          setProgress,
        );
        setStage("Finalizing recording...");
        const result = await uploadsApi.completeSession(token, session.id, {
          uploadSessionId: session.id,
          eTag,
        });
        if (!result.track)
          throw new Error("The upload did not return a recording.");
        completedTrack = result.track;
        setSavedTrack(completedTrack);
        onSaved(completedTrack);
      }
      if (!completedTrack) throw new Error("Recording not found");
      setStage("Adding recording to release...");
      const updated = await releasesApi.addTrackToRelease(token, release.id, {
        trackId: completedTrack.id,
        discNumber: 1,
        isFocusTrack: false,
      });
      onAdded(updated, completedTrack);
      onClose();
    } catch (e) {
      if (!completedTrack) {
        if (sessionId)
          await uploadsApi
            .cancelSession(token, sessionId)
            .catch(() => undefined);
        if (createdId)
          await tracksApi.deleteTrack(token, createdId).catch(() => undefined);
      }
      setError(e instanceof Error ? e.message : "Unable to upload recording");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  return (
    <div className="space-y-4 border-t border-border pt-5">
      <h3 className="text-lg font-semibold">Upload a recording</h3>
      <p className="text-sm text-muted-foreground">
        The recording is added to this release automatically. Add its credits in
        Track information.
      </p>
      <fieldset disabled={busy || !!savedTrack} className="space-y-4">
        <FormField id="release-audio-title" label="Track title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField
          id="release-audio-file"
          label="Audio file"
          hint="MP3, WAV, FLAC, AAC, OGG, or M4A. Maximum 500 MB."
        >
          <Input
            type="file"
            accept="audio/*,.flac,.m4a"
            className="h-auto py-2"
            onChange={(e) => {
              const next = e.target.files?.[0];
              if (
                next &&
                (next.size > 500 * 1024 * 1024 ||
                  !/\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(next.name))
              ) {
                setError("Choose a supported audio file up to 500 MB.");
                setFile(null);
                return;
              }
              setError("");
              setFile(next ?? null);
              if (!title && next) setTitle(next.name.replace(/\.[^.]+$/, ""));
            }}
          />
        </FormField>
      </fieldset>
      {busy ? (
        <div role="status">
          <p className="text-sm">{stage}</p>
          <Progress value={progress} aria-label="Audio upload progress" />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}.{" "}
          {savedTrack
            ? "Audio is saved in your library. Retry adding it to this release."
            : "Your inputs are retained. Try again."}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => void upload()}>
          {busy
            ? "Uploading..."
            : savedTrack
              ? "Retry adding recording"
              : "Upload & add recording"}
        </Button>
        <Button disabled={busy} variant="outline" onClick={onClose}>
          Cancel upload
        </Button>
      </div>
    </div>
  );
}
