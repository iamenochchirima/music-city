"use client";

import { recordingDuration } from "../lib/recording-duration";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ArtistSummary, TrackSummary } from "@music-city/shared";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudioPageHeader } from "@/components/studio/page-header";
import { FormField } from "@/components/ui/form-field";
import { FormSection } from "@/components/studio/form-section";
import { ActionBar } from "@/components/studio/action-bar";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { usersApi } from "@/features/users/lib/users-api";

import {
  TrackMetadataEditor,
  emptyTrackMetadata,
  validateTrackMetadata,
} from "./track-metadata-editor";
import { ApiClientError } from "@/lib/api/http-client";
import { TrackSalesSettings } from "./track-sales-settings";

export const TrackManageOverview = ({ trackId }: { trackId: string }) => {
  const router = useRouter();
  const { session } = useAuth();
  const [track, setTrack] = useState<TrackSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMetadataSaving, setIsMetadataSaving] = useState(false);
  const [metadata, setMetadata] = useState(emptyTrackMetadata);
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>(
    {},
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isExplicit, setIsExplicit] = useState(false);
  const [featuredArtists, setFeaturedArtists] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const [artistOptions, setArtistOptions] = useState<ArtistSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadTrack = async () => {
      if (!session?.token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        const nextTrack = await tracksApi.getManageTrack(
          session.token,
          trackId,
        );

        if (!cancelled) {
          if (!nextTrack) {
            setTrack(null);
            return;
          }

          setTrack(nextTrack);
          setTitle(nextTrack.title);
          setMetadata({
            isrc: nextTrack.isrc ?? "",
            credits: nextTrack.credits ?? [],
            recordLabel: nextTrack.recordLabel ?? "",
          });
          setDescription(nextTrack.description ?? "");
          setIsExplicit(nextTrack.isExplicit ?? false);
          setFeaturedArtists(nextTrack.featuredArtists?.join(", ") ?? "");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load track details",
          );
          toast.error(
            error instanceof Error
              ? error.message
              : "Unable to load track details",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTrack();

    return () => {
      cancelled = true;
    };
  }, [session?.token, trackId]);

  useEffect(() => {
    let cancelled = false;

    void usersApi
      .listArtists()
      .then((artists) => {
        if (!cancelled) {
          setArtistOptions(artists);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const deleteTrack = async () => {
    if (!session?.token || !track) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${track.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      await tracksApi.deleteTrack(session.token, track.id);
      toast.success("Track deleted.");
      router.push("/dashboard/tracks");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete track",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const saveMetadata = async () => {
    if (!session?.token || !track) {
      return;
    }

    const { result, errors } = validateTrackMetadata(metadata);
    if (!title.trim()) errors.title = "Enter a track title.";
    setMetadataErrors(errors);
    if (!result.success || errors.title) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setSaveError(null);

    try {
      setIsMetadataSaving(true);
      const updated = await tracksApi.updateTrackMetadata(
        session.token,
        track.id,
        {
          title: title.trim(),
          ...result.data,
          description: description.trim(),
          isExplicit,
          featuredArtists: featuredArtists
            .split(",")
            .map((artist) => artist.trim())
            .filter(Boolean),
        },
      );
      setTrack((current) => (current ? { ...current, ...updated } : updated));
      setMetadata({
        isrc: updated.isrc ?? "",
        credits: updated.credits ?? [],
        recordLabel: updated.recordLabel ?? "",
      });
      setTitle(updated.title);
      setDescription(updated.description ?? "");
      setFeaturedArtists(updated.featuredArtists?.join(", ") ?? "");
      setHasSaved(true);
      toast.success("Track metadata saved.");
    } catch (error) {
      if (error instanceof ApiClientError) setMetadataErrors(error.fieldErrors);
      setSaveError(
        error instanceof Error
          ? error.message
          : "Unable to save track metadata",
      );
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save track metadata",
      );
    } finally {
      setIsMetadataSaving(false);
    }
  };

  if (!session) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 text-muted-foreground">
        Connect your account before managing a track.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 text-muted-foreground">
        Loading track details...
      </div>
    );
  }

  if (!track) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 text-muted-foreground">
        {loadError ?? "Track not found."}
        {loadError ? (
          <Button
            className="ml-3"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  const dirty =
    title !== track.title ||
    description !== (track.description ?? "") ||
    isExplicit !== (track.isExplicit ?? false) ||
    featuredArtists !== (track.featuredArtists?.join(", ") ?? "") ||
    metadata.isrc !== (track.isrc ?? "") ||
    metadata.recordLabel !== (track.recordLabel ?? "") ||
    JSON.stringify(metadata.credits) !== JSON.stringify(track.credits ?? []);
  const backToRelease = track.releaseId;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="px-0">
        <Link
          href={
            backToRelease
              ? `/dashboard/releases/${track.releaseId}`
              : "/dashboard/tracks"
          }
        >
          <ArrowLeft />
          {backToRelease ? "Back to release" : "Back to tracks"}
        </Link>
      </Button>
      <StudioPageHeader
        actions={<Button asChild variant="outline"><Link href={`/account/agreements/new?track=${track.id}`}>Royalty agreement</Link></Button>}
        title={track.title}
        eyebrow="Track"
        description={[
          track.artistName,
          track.genre,
          recordingDuration(track.runtime),
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        <dl className="flex flex-wrap gap-x-8 gap-y-3 pt-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Recording status</dt>
            <dd className="mt-1 capitalize text-foreground">{track.status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Playback</dt>
            <dd className="mt-1 text-foreground">
              {track.playbackReady ? "Ready" : "Processing"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Release</dt>
            <dd className="mt-1 text-foreground">
              {track.releaseTitle ?? "Not assigned"}
            </dd>
          </div>
        </dl>
      </StudioPageHeader>
      <form
        className="max-w-[720px] space-y-8 rounded-lg border border-border bg-card p-4 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void saveMetadata();
        }}
      >
        <fieldset disabled={isMetadataSaving} className="min-w-0 space-y-8">
          <FormSection title="Track details">
            <FormField
              id="track-title"
              label="Track title"
              error={metadataErrors.title}
            >
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </FormField>
            <FormField
              id="track-featured-artists"
              label="Featured artists"
              hint="Optional. Separate names with commas."
            >
              <Input
                value={featuredArtists}
                onChange={(event) => setFeaturedArtists(event.target.value)}
              />
            </FormField>
            <FormField
              id="track-note"
              label="Track note"
              hint="Optional. A short note that listeners can see."
            >
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24"
              />
            </FormField>
            <label className="flex min-h-11 items-center gap-3 text-sm text-foreground">
              <Checkbox
                checked={isExplicit}
                onChange={(event) => setIsExplicit(event.target.checked)}
              />
              Explicit content
            </label>
          </FormSection>
          <div id="track-metadata" className="border-t border-border pt-6">
            <TrackMetadataEditor
              value={metadata}
              onChange={setMetadata}
              artists={artistOptions}
              errors={metadataErrors}
              disabled={isMetadataSaving}
            />
          </div>
        </fieldset>
        {saveError ? (
          <p role="alert" className="text-sm text-destructive">
            {saveError}. Your changes are still here. Try saving again.
          </p>
        ) : null}
        <ActionBar>
          <p role="status" className="text-sm text-muted-foreground">
            {isMetadataSaving
              ? "Saving changes…"
              : dirty
                ? "Unsaved changes"
                : hasSaved
                  ? "All changes saved"
                  : "No unsaved changes"}
          </p>
          <Button type="submit" disabled={isMetadataSaving || !dirty}>
            {isMetadataSaving ? "Saving..." : "Save metadata"}
          </Button>
        </ActionBar>
      </form>
      {session?.token && <TrackSalesSettings key={track.id} track={track} token={session.token} onSaved={(updated) => setTrack((current) => current ? { ...current, ...updated } : updated)} />}
      <section className="max-w-[720px] space-y-3 border-t border-border pt-6">
        <h3 className="text-lg font-semibold text-foreground">
          Release publication
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">
          {track.releaseTitle
            ? `This recording is included in ${track.releaseTitle}.`
            : "Add this recording to a Single, EP, or album to publish it."}
        </p>
        <Button asChild variant="outline">
          <Link
            href={
              track.releaseId
                ? `/dashboard/releases/${track.releaseId}`
                : "/dashboard/releases"
            }
          >
            {track.releaseId ? "Open release workspace" : "Add to a release"}
          </Link>
        </Button>
      </section>
      <div className="max-w-[720px] border-t border-border pt-4">
        <Button
          variant="ghost"
          className="text-destructive"
          disabled={isDeleting}
          onClick={() => void deleteTrack()}
        >
          <Trash2 />
          {isDeleting ? "Deleting..." : "Delete track"}
        </Button>
      </div>
    </div>
  );
};
