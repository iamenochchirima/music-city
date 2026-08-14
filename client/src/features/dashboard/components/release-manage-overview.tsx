"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { ReleaseDetail, TrackSummary } from "@music-city/shared";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CircleAlert,
  CircleCheck,
  GripVertical,
  TimerReset,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { musicGenres } from "@/features/music/data/metadata-options";
import { releasesApi } from "@/features/music/lib/releases-api";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { uploadsApi } from "@/features/uploads/lib/uploads-api";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";

const toDateTimeLocalValue = (value?: string) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const offsetMs = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16);
};

const toIsoString = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const toLaunchMode = (status?: ReleaseDetail["status"]) =>
  status === "published" || status === "scheduled" ? status : "draft";
const MAX_COVER_SIZE_BYTES = 10 * 1024 * 1024;

type ReadinessIssue = {
  label: string;
  targetId: string;
};

export const ReleaseManageOverview = ({ releaseId }: { releaseId: string }) => {
  const router = useRouter();
  const { session } = useAuth();
  const [release, setRelease] = useState<ReleaseDetail | null>(null);
  const [myTracks, setMyTracks] = useState<TrackSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [launchMode, setLaunchMode] = useState<"draft" | "published" | "scheduled">("draft");
  const [releaseDateInput, setReleaseDateInput] = useState("");
  const [isPublishGuidanceOpen, setIsPublishGuidanceOpen] = useState(false);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [coverFile]);

  useEffect(() => {
    if (!isDeleteConfirmOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) {
        setIsDeleteConfirmOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDeleteConfirmOpen, isDeleting]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = session?.token;

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const [nextRelease, nextTracks] = await Promise.all([
          releasesApi.getManageRelease(token, releaseId),
          tracksApi.listMyTracks(token),
        ]);

        if (!cancelled) {
          setRelease(nextRelease);
          setMyTracks(nextTracks);
          setLaunchMode(toLaunchMode(nextRelease?.status));
          setReleaseDateInput(toDateTimeLocalValue(nextRelease?.releaseDate));
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Unable to load release",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [releaseId, session?.token]);

  const availableTracks = useMemo(() => {
    const assignedIds = new Set(release?.tracks.map((item) => item.trackId) ?? []);
    return myTracks.filter((track) => !assignedIds.has(track.id));
  }, [myTracks, release?.tracks]);

  const saveRelease = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const token = session?.token;

    if (!token || !release) {
      return;
    }

    try {
      setIsSaving(true);
      const updated = await releasesApi.updateRelease(token, release.id, {
        title: release.title,
        artistName: release.artistName,
        type: release.type,
        genre: release.genre,
        recordLabel: release.recordLabel,
        description: release.description,
        releaseDate:
          launchMode === "scheduled"
            ? toIsoString(releaseDateInput)
            : release.releaseDate,
        status: launchMode,
      });
      setRelease(updated);
      setLaunchMode(toLaunchMode(updated.status));
      setReleaseDateInput(toDateTimeLocalValue(updated.releaseDate));
      toast.success("Release updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save release");
    } finally {
      setIsSaving(false);
    }
  };

  const uploadCover = async () => {
    const token = session?.token;

    if (!token || !release || !coverFile) {
      return;
    }

    let uploadSessionId: string | null = null;

    try {
      setIsSaving(true);
      const uploadSession = await uploadsApi.createSession(token, {
        releaseId: release.id,
        purpose: "cover",
        fileName: coverFile.name,
        contentType: coverFile.type || "application/octet-stream",
        sizeBytes: coverFile.size,
      });
      uploadSessionId = uploadSession.id;
      const eTag = await uploadsApi.uploadFile(
        token,
        uploadSession,
        coverFile,
        setCoverUploadProgress,
      );
      const completed = await uploadsApi.completeSession(token, uploadSession.id, {
        uploadSessionId: uploadSession.id,
        eTag,
      });

      if (completed.release) {
        setRelease(completed.release);
      } else {
        const refreshed = await releasesApi.getManageRelease(token, release.id);
        setRelease(refreshed);
      }

      setCoverFile(null);
      setCoverUploadProgress(0);
      toast.success("Release cover updated.");
    } catch (error) {
      if (uploadSessionId) {
        await uploadsApi.cancelSession(token, uploadSessionId).catch(() => undefined);
      }

      toast.error(error instanceof Error ? error.message : "Unable to upload cover");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoverFileChange = (file: File | undefined) => {
    if (!file) {
      setCoverFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Choose a JPG, PNG, or WebP image for the release artwork.");
      return;
    }

    if (file.size > MAX_COVER_SIZE_BYTES) {
      toast.error("Release artwork must be 10 MB or smaller.");
      return;
    }

    setCoverFile(file);
  };

  const addTrack = async () => {
    const token = session?.token;

    if (!token || !release || !selectedTrackId) {
      return;
    }

    try {
      setIsSaving(true);
      const updated = await releasesApi.addTrackToRelease(token, release.id, {
        trackId: selectedTrackId,
        discNumber: 1,
        isFocusTrack: false,
      });
      setRelease(updated);
      setSelectedTrackId("");
      toast.success("Track added to release.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add track");
    } finally {
      setIsSaving(false);
    }
  };

  const updateTrackOrder = async (
    trackId: string,
    patch: Partial<{ trackNumber: number; discNumber: number; isFocusTrack: boolean }>,
  ) => {
    if (!release) {
      return;
    }

    setRelease({
      ...release,
      tracks: release.tracks.map((item) =>
        item.trackId === trackId ? { ...item, ...patch } : item,
      ),
    });
  };

  const saveTrackOrder = async () => {
    const token = session?.token;

    if (!token || !release) {
      return;
    }

    try {
      setIsSaving(true);
      const updated = await releasesApi.reorderReleaseTracks(token, release.id, {
        items: release.tracks.map((item, index) => ({
          trackId: item.trackId,
          trackNumber: item.trackNumber || index + 1,
          discNumber: item.discNumber || 1,
          isFocusTrack: item.isFocusTrack,
        })),
      });
      setRelease(updated);
      toast.success("Track order saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save order");
    } finally {
      setIsSaving(false);
    }
  };

  const removeTrack = async (trackId: string) => {
    const token = session?.token;

    if (!token || !release) {
      return;
    }

    try {
      setIsSaving(true);
      await releasesApi.removeTrackFromRelease(token, release.id, trackId);
      const refreshed = await releasesApi.getManageRelease(token, release.id);
      setRelease(refreshed);
      toast.success("Track removed from release.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove track");
    } finally {
      setIsSaving(false);
    }
  };

  const moveTrack = (index: number, direction: -1 | 1) => {
    setRelease((current) => {
      if (!current) {
        return current;
      }

      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= current.tracks.length) {
        return current;
      }

      const nextTracks = [...current.tracks];
      [nextTracks[index], nextTracks[nextIndex]] = [
        nextTracks[nextIndex],
        nextTracks[index],
      ];

      return {
        ...current,
        tracks: nextTracks.map((item, trackIndex) => ({
          ...item,
          trackNumber: trackIndex + 1,
        })),
      };
    });
  };

  const updateStatus = async (status: ReleaseDetail["status"]) => {
    const token = session?.token;

    if (!token || !release) {
      return;
    }

    try {
      setIsSaving(true);
      const updated = await releasesApi.updateRelease(token, release.id, {
        status,
        releaseDate: status === "scheduled" ? toIsoString(releaseDateInput) : undefined,
      });
      setRelease(updated);
      setLaunchMode(toLaunchMode(updated.status));
      setReleaseDateInput(toDateTimeLocalValue(updated.releaseDate));
      if (status === "published") {
        trackEvent("release_published");
      }
      toast.success(
        status === "published"
          ? "Release published."
          : status === "scheduled"
            ? "Release scheduled."
            : "Release moved to draft.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update status");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRelease = async () => {
    const token = session?.token;

    if (!token || !release) {
      return;
    }

    try {
      setIsDeleting(true);
      await releasesApi.deleteRelease(token, release.id);
      setIsDeleteConfirmOpen(false);
      toast.success("Release deleted.");
      router.push("/dashboard/releases");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete release");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!session) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-slate-300">
        Connect your account before managing a release.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-slate-300">
        Loading release details...
      </div>
    );
  }

  if (!release) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-slate-300">
        Release not found.
      </div>
    );
  }

  const readinessIssues: ReadinessIssue[] = [];

  if (!release.title.trim()) {
    readinessIssues.push({ label: "Add a release title", targetId: "release-title" });
  }

  if (!release.artistName.trim()) {
    readinessIssues.push({ label: "Add an artist name", targetId: "release-artist-name" });
  }

  if (!release.genre.trim()) {
    readinessIssues.push({ label: "Add a primary genre", targetId: "release-genre" });
  }

  if (!release.coverImageUrl && !release.coverStorageKey) {
    readinessIssues.push({ label: "Upload release artwork", targetId: "release-cover" });
  }

  if (release.tracks.length === 0) {
    readinessIssues.push({ label: "Add at least one track", targetId: "release-tracklist" });
  } else if (release.type === "single" && release.tracks.length !== 1) {
    readinessIssues.push({ label: "A Single must contain exactly one track", targetId: "release-tracklist" });
  } else if (release.type === "ep" && (release.tracks.length < 2 || release.tracks.length > 6)) {
    readinessIssues.push({ label: "An EP must contain between 2 and 6 tracks", targetId: "release-tracklist" });
  } else if (release.type === "album" && release.tracks.length < 7) {
    readinessIssues.push({ label: "An album must contain at least 7 tracks", targetId: "release-tracklist" });
  }

  if (release.tracks.some((item) => !item.track.playbackReady)) {
    readinessIssues.push({ label: "Wait for every track to finish audio processing", targetId: "release-tracklist" });
  }

  if (release.tracks.filter((item) => item.isFocusTrack).length > 1) {
    readinessIssues.push({ label: "Choose only one focus track", targetId: "release-tracklist" });
  }

  if (launchMode === "scheduled" && !releaseDateInput.trim()) {
    readinessIssues.push({ label: "Choose a future release date", targetId: "release-date" });
  }

  const canPublish = readinessIssues.length === 0;
  const focusReadinessTarget = (targetId: string) => {
    const target = document.getElementById(targetId);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      target.focus();
    }
  };

  const guideToNextPublishStep = () => {
    const nextIssue = readinessIssues[0];

    if (!nextIssue) {
      void updateStatus("published");
      return;
    }

    setIsPublishGuidanceOpen(true);
    window.requestAnimationFrame(() => focusReadinessTarget(nextIssue.targetId));
  };

  const guideToScheduling = () => {
    const publishingIssues = readinessIssues.filter(
      (issue) => issue.targetId !== "release-date",
    );

    if (publishingIssues.length > 0) {
      setIsPublishGuidanceOpen(true);
      window.requestAnimationFrame(() =>
        focusReadinessTarget(publishingIssues[0]!.targetId),
      );
      return;
    }

    if (!releaseDateInput.trim()) {
      setLaunchMode("scheduled");
      window.requestAnimationFrame(() => focusReadinessTarget("release-date"));
      return;
    }

    void updateStatus("scheduled");
  };

  return (
    <div className="space-y-5">
      <Button
        asChild
        variant="outline"
        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
      >
        <Link href="/dashboard/releases">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to releases
        </Link>
      </Button>

      {isPublishGuidanceOpen && !canPublish ? (
        <section
          id="publish-guidance"
          aria-live="polite"
          className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.07] p-5 sm:p-6"
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
            Release checklist
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Complete {readinessIssues.length} more {readinessIssues.length === 1 ? "step" : "steps"} to release
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Start with the highlighted item. We will keep this checklist up to date as you complete each step.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {readinessIssues.map((issue, index) => (
              <button
                key={issue.label}
                type="button"
                onClick={() => focusReadinessTarget(issue.targetId)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm transition ${
                  index === 0
                    ? "border-emerald-300/50 bg-emerald-300/10 text-white"
                    : "border-white/10 bg-slate-950/30 text-slate-300 hover:border-white/20 hover:text-white"
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
                  {index + 1}
                </span>
                {issue.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <form
        className="space-y-5 rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"
        onSubmit={saveRelease}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
              Release
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{release.title}</h2>
            <p className="mt-1 text-sm capitalize text-slate-400">{release.status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              disabled={isSaving}
              onClick={() => void updateStatus("draft")}
            >
              {release.status === "draft" ? "Save as draft" : "Unpublish release"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              disabled={isSaving}
              onClick={guideToScheduling}
            >
              <TimerReset className="mr-2 h-4 w-4" />
              Schedule release
            </Button>
            <Button
              type="button"
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              disabled={isSaving}
              onClick={guideToNextPublishStep}
              aria-describedby={!canPublish ? "publish-guidance" : undefined}
            >
              {isSaving
                ? "Publishing..."
                : canPublish
                  ? "Release now"
                  : isPublishGuidanceOpen
                    ? `Continue setup (${readinessIssues.length})`
                    : "Release now"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Title</label>
            <Input
              id="release-title"
              value={release.title}
              onChange={(event) =>
                setRelease({ ...release, title: event.target.value })
              }
              className="border-white/10 bg-slate-950 text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Artist name</label>
            <Input
              id="release-artist-name"
              value={release.artistName}
              onChange={(event) =>
                setRelease({ ...release, artistName: event.target.value })
              }
              className="border-white/10 bg-slate-950 text-white"
            />
          </div>
        </div>

        <details className="group rounded-xl border border-white/10 bg-slate-950/30">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-white [&::-webkit-details-marker]:hidden">
            Release metadata
            <span className="ml-2 text-xs font-normal text-slate-500 group-open:text-emerald-300">Optional</span>
          </summary>
          <div className="border-t border-white/10 p-4">
            <label className="text-sm text-slate-300">Record label</label>
            <Input
              value={release.recordLabel ?? ""}
              onChange={(event) => setRelease({ ...release, recordLabel: event.target.value })}
              placeholder="Independent or label name"
              className="mt-2 border-white/10 bg-slate-950 text-white"
            />
            <p className="mt-2 text-xs text-slate-500">UPC/EAN identifiers and territory availability will be added here later.</p>
          </div>
        </details>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Genre</label>
            <SearchablePicker
              id="release-genre"
              value={release.genre}
              onValueChange={(genre) => setRelease({ ...release, genre })}
              options={musicGenres}
              placeholder="Select a genre"
              searchPlaceholder="Search genres"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Type</label>
            <select
              value={release.type}
              onChange={(event) =>
                setRelease({
                  ...release,
                  type: event.target.value as ReleaseDetail["type"],
                })
              }
              className="flex h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-white"
            >
              <option value="single">Single</option>
              <option value="ep">EP</option>
              <option value="album">Album</option>
            </select>
          </div>
        </div>
        <div className="space-y-3">
          <label className="text-sm text-slate-300">Release plan</label>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                {
                  value: "draft",
                  label: "Draft",
                  description: "Keep the project private while you finish the setup.",
                },
                {
                  value: "published",
                  label: "Release now",
                  description: "Make the release available immediately.",
                },
                {
                  value: "scheduled",
                  label: "Scheduled release",
                  description: "Publish later; leave time for audio processing before the date.",
                },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                className={`rounded-xl border p-3 text-left transition ${
                  launchMode === option.value
                    ? "border-emerald-400/40 bg-emerald-400/10"
                    : "border-white/10 bg-slate-950/40 hover:border-white/20 hover:bg-white/[0.05]"
                }`}
                onClick={() => setLaunchMode(option.value)}
              >
                <p className="text-sm font-semibold text-white">{option.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </div>
        {launchMode === "scheduled" ? (
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Scheduled release time</label>
            <Input
              id="release-date"
              type="datetime-local"
              value={releaseDateInput}
              onChange={(event) => setReleaseDateInput(event.target.value)}
              className="border-white/10 bg-slate-950 text-white"
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm text-slate-300">Description</label>
          <Textarea
            value={release.description ?? ""}
            onChange={(event) =>
              setRelease({
                ...release,
                description: event.target.value || undefined,
              })
            }
            className="min-h-28 border-white/10 bg-slate-950 text-white"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Cover art</p>
            {release.coverImageUrl ? (
              <div
                className="aspect-square rounded-xl border border-white/10 bg-cover bg-center"
                style={{ backgroundImage: `url(${release.coverImageUrl})` }}
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-950/40 text-sm text-slate-400">
                No cover uploaded
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Input
              id="release-cover"
              type="file"
              accept="image/*"
              onChange={(event) => handleCoverFileChange(event.target.files?.[0])}
              className="border-white/10 bg-slate-950 text-white file:text-white"
            />
            <p className="text-xs text-slate-500">Square JPG, PNG, or WebP · up to 10 MB. Artwork applies to the whole release.</p>
            {coverPreviewUrl ? (
              <img src={coverPreviewUrl} alt="Selected release artwork preview" className="h-24 w-24 rounded-lg object-cover" />
            ) : null}
            {coverFile ? (
              <p className="text-xs text-slate-400">
                {coverFile.name}
                {coverUploadProgress > 0 ? ` · ${coverUploadProgress}%` : ""}
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Upload square artwork to represent the full release.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              disabled={isSaving || !coverFile}
              onClick={() => void uploadCover()}
            >
              {isSaving && coverFile ? "Uploading cover..." : "Upload cover"}
            </Button>
          </div>
        </div>

        <Button
          type="submit"
          className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save release details"}
        </Button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section id="release-tracklist" className="rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Tracklist</h3>
              <p className="text-xs text-slate-500">Order the tracks on this release.</p>
            </div>
            <Button
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              disabled={isSaving || release.tracks.length === 0}
              onClick={() => void saveTrackOrder()}
            >
              Save order
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/10 bg-slate-950/30">
            <table className="w-full min-w-[620px] text-left text-sm">
              <caption className="sr-only">Tracks in this release</caption>
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th scope="col" className="w-20 px-4 py-3 font-medium">Track</th>
                  <th scope="col" className="px-4 py-3 font-medium">Title</th>
                  <th scope="col" className="w-24 px-4 py-3 font-medium">Disc</th>
                  <th scope="col" className="w-24 px-4 py-3 font-medium">Focus</th>
                  <th scope="col" className="w-28 px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {release.tracks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                      No tracks assigned yet. Add an uploaded track to start building this release.
                    </td>
                  </tr>
                ) : (
                  release.tracks.map((item, index) => (
                    <tr key={item.trackId} className="align-middle hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min={1}
                          value={String(item.trackNumber)}
                          aria-label={`Track number for ${item.track.title}`}
                          onChange={(event) =>
                            updateTrackOrder(item.trackId, {
                              trackNumber: Number(event.target.value) || 1,
                            })
                          }
                          className="h-9 w-16 border-white/10 bg-slate-950 text-white"
                        />
                      </td>
                      <td className="max-w-0 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <GripVertical className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">{item.track.title}</p>
                            <p className="truncate text-xs text-slate-500">
                              {item.track.runtime} · {item.track.isExplicit ? "Explicit" : "Not explicit"} · {item.track.playbackReady ? "Ready" : "Processing"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min={1}
                          value={String(item.discNumber)}
                          aria-label={`Disc number for ${item.track.title}`}
                          onChange={(event) =>
                            updateTrackOrder(item.trackId, {
                              discNumber: Number(event.target.value) || 1,
                            })
                          }
                          className="h-9 w-16 border-white/10 bg-slate-950 text-white"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={item.isFocusTrack}
                            aria-label={`Set ${item.track.title} as focus track`}
                            onChange={(event) =>
                              updateTrackOrder(item.trackId, {
                                isFocusTrack: event.target.checked,
                              })
                            }
                          />
                          <span>Focus</span>
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:bg-white/10 hover:text-white"
                            disabled={index === 0 || isSaving}
                            onClick={() => moveTrack(index, -1)}
                            aria-label={`Move ${item.track.title} up`}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:bg-white/10 hover:text-white"
                            disabled={index === release.tracks.length - 1 || isSaving}
                            onClick={() => moveTrack(index, 1)}
                            aria-label={`Move ${item.track.title} down`}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                            disabled={isSaving}
                            onClick={() => void removeTrack(item.trackId)}
                            aria-label={`Remove ${item.track.title} from release`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <h3 className="text-xl font-semibold text-white">Add track</h3>
          <p className="mt-1 text-sm text-slate-400">Attach an uploaded track.</p>

          <div className="mt-5 space-y-4">
            <select
              value={selectedTrackId}
              onChange={(event) => setSelectedTrackId(event.target.value)}
              className="flex h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-white"
            >
              <option value="">Select a track</option>
              {availableTracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.title}
                </option>
              ))}
            </select>

            <Button
              type="button"
              className="w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              disabled={isSaving || !selectedTrackId}
              onClick={() => void addTrack()}
            >
              Add track to release
            </Button>
            <Button asChild type="button" variant="outline" className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10">
              <Link href="/dashboard/create">Upload a new track</Link>
            </Button>
          </div>
        </aside>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Publish review
            </p>
            <h3 className="mt-1 text-xl font-semibold text-white">
              {canPublish ? "Ready to publish" : "Finish these items first"}
            </h3>
          </div>
          {canPublish ? (
            <CircleCheck className="h-5 w-5 text-emerald-300" />
          ) : (
            <CircleAlert className="h-5 w-5 text-amber-300" />
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {canPublish ? (
            ["Artwork uploaded", "Tracklist is valid", "Audio is ready"].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">
                <CircleCheck className="h-4 w-4 text-emerald-300" />
                {item}
              </div>
            ))
          ) : (
            readinessIssues.map((issue) => (
              <button key={issue.label} type="button" className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-left text-sm text-slate-300 hover:border-amber-300/40 hover:text-white" onClick={() => focusReadinessTarget(issue.targetId)}>
                <CircleAlert className="h-4 w-4 shrink-0 text-amber-300" />
                {issue.label}
              </button>
            ))
          )}
        </div>
      </section>

      <div className="flex justify-end border-t border-white/10 pt-5">
        <Button
          type="button"
          variant="ghost"
          className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
          disabled={isDeleting || isSaving}
          onClick={() => setIsDeleteConfirmOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete release
        </Button>
      </div>

      {isDeleteConfirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !isDeleting) {
              setIsDeleteConfirmOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-rose-400/25 bg-[#171a2a] p-5 shadow-2xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-release-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-rose-300">
              Delete release
            </p>
            <h3 id="delete-release-title" className="mt-2 text-xl font-semibold text-white">
              Delete “{release.title}”?
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              This removes the release page and detaches its tracks. Your tracks and audio will stay in your library.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                disabled={isDeleting}
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-rose-500 text-white hover:bg-rose-400"
                disabled={isDeleting}
                onClick={() => void deleteRelease()}
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete release"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
