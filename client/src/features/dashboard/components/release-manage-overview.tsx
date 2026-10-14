"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  releaseUpdateSchema,
  type ReleaseDetail,
  type TrackSummary,
  type ArtistSummary,
  trackMetadataUpdateSchema,
} from "@music-city/shared";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { StepNavigation } from "@/components/studio/step-navigation";
import { ActionBar } from "@/components/studio/action-bar";
import { useSearchParams } from "react-router-dom";
import { usersApi } from "@/features/users/lib/users-api";
import { releaseSteps, type ReleaseStep } from "../lib/release-steps";
import { ReleaseAudioUploader } from "./release-audio-uploader";
import { ReleaseTrackInformation } from "./release-track-information";
import { StudioPageHeader } from "@/components/studio/page-header";
import { StatusBadge } from "@/components/studio/status-badge";
import { ApiClientError } from "@/lib/api/http-client";
import { releasesApi } from "@/features/music/lib/releases-api";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { uploadsApi } from "@/features/uploads/lib/uploads-api";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { ReleaseTrackLabels } from "./release-track-labels";
import { ReleaseBasicsFields } from "./release-basics-fields";
import { ReleaseDetailsEditor } from "./release-details-editor";
import { ReleaseArtworkEditor } from "./release-artwork-editor";
import { ReleaseTracklistEditor } from "./release-tracklist-editor";
import { ReleaseReview, type ReadinessIssue } from "./release-review";

type ReleaseSection = ReleaseStep;
const targetSection = (id: string): ReleaseSection =>
  id === "release-cover"
    ? "artwork"
    : id === "release-tracklist"
      ? "music"
      : id === "release-date"
        ? "review"
        : "basics";
const releaseDetails = (release: ReleaseDetail) => ({
  title: release.title.trim(),
  artistName: release.artistName.trim(),
  type: release.type,
  genre: release.genre.trim(),
  recordLabel: release.recordLabel ?? "",
  description: release.description ?? "",
});
const orderItems = (release: ReleaseDetail) =>
  release.tracks.map(({ trackId, trackNumber, discNumber, isFocusTrack }) => ({
    trackId,
    trackNumber,
    discNumber,
    isFocusTrack,
  }));

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

export const ReleaseManageOverview = ({ releaseId }: { releaseId: string }) => {
  const router = useRouter();
  const [params, setParams] = useSearchParams();
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [trackErrors, setTrackErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [informationTrack, setInformationTrack] = useState<string | null>(null);
  const [isAudioOpen, setIsAudioOpen] = useState(false);
  const [typePrompt, setTypePrompt] = useState<"add" | "upload" | null>(null);
  const [nextType, setNextType] = useState<"ep" | "album">("ep");
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
  const [launchMode, setLaunchMode] = useState<
    "draft" | "published" | "scheduled"
  >("draft");
  const [releaseDateInput, setReleaseDateInput] = useState("");
  const [section, setSection] = useState<ReleaseSection>(() => {
    const step =
      params.get("step") ??
      window.localStorage.getItem(`music-city:release-step:${releaseId}`);
    return releaseSteps.some((item) => item.id === step)
      ? (step as ReleaseSection)
      : "basics";
  });
  const [savedRelease, setSavedRelease] = useState<ReleaseDetail | null>(null);
  const [actionError, setActionError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [artworkError, setArtworkError] = useState("");
  const [loadError, setLoadError] = useState("");

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
    let cancelled = false;

    const load = async () => {
      const token = session?.token;

      if (!token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError("");
      try {
        const [nextRelease, nextTracks] = await Promise.all([
          releasesApi.getManageRelease(token, releaseId),
          tracksApi.listMyTracks(token),
        ]);

        if (!cancelled) {
          setRelease(nextRelease);
          setSavedRelease(nextRelease);
          setMyTracks(nextTracks);
          void usersApi
            .listArtists()
            .then(setArtists)
            .catch(() => setArtists([]));
          setLaunchMode(toLaunchMode(nextRelease?.status));
          setReleaseDateInput(toDateTimeLocalValue(nextRelease?.releaseDate));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Unable to load release",
          );
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
    const assignedIds = new Set(
      release?.tracks.map((item) => item.trackId) ?? [],
    );
    return myTracks.filter(
      (track) =>
        !assignedIds.has(track.id) &&
        (!track.releaseId || track.releaseId === release?.id),
    );
  }, [myTracks, release?.tracks]);

  const reportError = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    setActionError(message);
    if (
      error instanceof ApiClientError &&
      Object.keys(error.fieldErrors).length
    ) {
      setFieldErrors(error.fieldErrors);
      const key = Object.keys(error.fieldErrors)[0];
      const destination =
        key === "releaseDate" || key === "status"
          ? "review"
          : key.startsWith("cover")
            ? "artwork"
            : key.startsWith("tracks")
              ? "music"
              : "basics";
      if (destination === "artwork") setArtworkError(error.fieldErrors[key]);
      setSection(destination);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    }
    toast.error(message);
  };
  const validatedDetails = () => {
    if (!release) return null;
    const parsed = releaseUpdateSchema.safeParse(releaseDetails(release));
    if (parsed.success) {
      setFieldErrors({});
      return parsed.data;
    }
    setFieldErrors(
      Object.fromEntries(
        parsed.error.issues.map((issue) => [
          issue.path.join("."),
          issue.message,
        ]),
      ),
    );
    setSection(
      parsed.error.issues.some((issue) =>
        ["description", "recordLabel"].includes(String(issue.path[0])),
      )
        ? "artwork"
        : "basics",
    );
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
    return null;
  };
  const applyTracks = (updated: ReleaseDetail, preserveOrder = false) => {
    setSavedRelease(updated);
    setRelease((current) => {
      if (!current) return updated;
      const tracks = preserveOrder
        ? [
            ...current.tracks
              .filter((item) =>
                updated.tracks.some((next) => next.trackId === item.trackId),
              )
              .map((item) => ({
                ...updated.tracks.find(
                  (next) => next.trackId === item.trackId,
                )!,
                trackNumber: item.trackNumber,
                discNumber: item.discNumber,
                isFocusTrack: item.isFocusTrack,
              })),
            ...updated.tracks.filter(
              (item) =>
                !current.tracks.some(
                  (previous) => previous.trackId === item.trackId,
                ),
            ),
          ]
        : updated.tracks;
      const preserved = tracks.map((item) => {
        const draft = current.tracks.find(
          (row) => row.trackId === item.trackId,
        );
        const saved = savedRelease?.tracks.find(
          (row) => row.trackId === item.trackId,
        );
        return draft &&
          saved &&
          JSON.stringify(trackInfo(draft.track)) !==
            JSON.stringify(trackInfo(saved.track))
          ? { ...item, track: { ...item.track, ...trackInfo(draft.track) } }
          : item;
      });
      return { ...current, tracks: preserved, trackCount: tracks.length };
    });
  };
  const trackInfo = (track: TrackSummary) => ({
    title: track.title,
    credits: track.credits ?? [],
    isrc: track.isrc ?? "",
    recordLabel: track.recordLabel ?? "",
    isExplicit: !!track.isExplicit,
  });
  const saveTrackInformation = async () => {
    if (!session?.token || !release) return;
    for (const item of release.tracks) {
      const previous = savedRelease?.tracks.find(
        (saved) => saved.trackId === item.trackId,
      );
      if (
        JSON.stringify(trackInfo(item.track)) ===
        JSON.stringify(previous ? trackInfo(previous.track) : null)
      )
        continue;
      const parsed = trackMetadataUpdateSchema.safeParse(trackInfo(item.track));
      if (!parsed.success) {
        setInformationTrack(item.trackId);
        setTrackErrors({
          [item.trackId]: Object.fromEntries(
            parsed.error.issues.map((issue) => [
              issue.path.join("."),
              issue.message,
            ]),
          ),
        });
        setSection("information");
        requestAnimationFrame(() =>
          document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        );
        throw new Error(
          `Check track information for ${item.track.title || "this recording"}`,
        );
      }
      let track: TrackSummary;
      try {
        track = await tracksApi.updateTrackMetadata(
          session.token,
          item.trackId,
          parsed.data,
        );
      } catch (error) {
        setInformationTrack(item.trackId);
        setSection("information");
        if (error instanceof ApiClientError)
          setTrackErrors({ [item.trackId]: error.fieldErrors });
        throw new Error(
          error instanceof Error
            ? error.message
            : "Unable to save track information",
        );
      }
      const update = (current: ReleaseDetail | null) =>
        current
          ? {
              ...current,
              tracks: current.tracks.map((row) =>
                row.trackId === track.id ? { ...row, track } : row,
              ),
            }
          : current;
      setRelease(update);
      setSavedRelease(update);
    }
    setTrackErrors({});
  };
  const saveWorkspace = async () => {
    if (!session?.token || !release) return false;
    const details = validatedDetails();
    if (!details) return false;
    setIsSaving(true);
    setActionError("");
    try {
      await saveTrackInformation();
      await saveOrderBeforeNavigation();
      const updated = await releasesApi.updateRelease(
        session.token,
        release.id,
        details,
      );
      setSavedRelease(updated);
      setRelease(updated);
      return true;
    } catch (error) {
      reportError(error, "Unable to save draft");
      return false;
    } finally {
      setIsSaving(false);
    }
  };
  const selectStep = (value: ReleaseSection) => {
    window.localStorage.setItem(`music-city:release-step:${releaseId}`, value);
    setSection(value);
    setParams({ step: value }, { replace: true });
  };
  const continueStep = async (exit = false) => {
    if (!(await saveWorkspace())) return;
    if (exit) {
      router.push("/dashboard/releases");
      return;
    }
    const index = releaseSteps.findIndex((step) => step.id === section);
    selectStep(releaseSteps[Math.min(index + 1, 4)].id);
    requestAnimationFrame(() =>
      document
        .getElementById("release-progress")
        ?.scrollIntoView({ block: "start" }),
    );
  };
  const saveOrderBeforeNavigation = async () => {
    if (!session?.token || !release || !release.tracks.length) return;
    if (
      JSON.stringify(orderItems(release)) !==
      JSON.stringify(savedRelease ? orderItems(savedRelease) : [])
    ) {
      const updated = await releasesApi.reorderReleaseTracks(
        session.token,
        release.id,
        { items: orderItems(release) },
      );
      applyTracks(updated);
    }
  };
  const needsLargerType = () =>
    !!release &&
    ((release.type === "single" && release.tracks.length >= 1) ||
      (release.type === "ep" && release.tracks.length >= 6));
  const uploadNewTrack = async () => {
    if (needsLargerType()) {
      setNextType(release?.type === "ep" ? "album" : "ep");
      setTypePrompt("upload");
      return;
    }
    if (await saveWorkspace()) setIsAudioOpen(true);
  };

  const uploadCover = async () => {
    const token = session?.token;

    if (!token || !release || !coverFile) {
      return;
    }

    let uploadSessionId: string | null = null;

    try {
      setIsSaving(true);
      setArtworkError("");
      setActionError("");
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
      const completed = await uploadsApi.completeSession(
        token,
        uploadSession.id,
        {
          uploadSessionId: uploadSession.id,
          eTag,
        },
      );

      const updated =
        completed.release ??
        (await releasesApi.getManageRelease(token, release.id));
      if (!updated) throw new Error("Release not found after artwork upload");
      setSavedRelease(updated);
      setRelease((current) =>
        current
          ? {
              ...current,
              coverImageUrl: updated.coverImageUrl,
              coverStorageKey: updated.coverStorageKey,
            }
          : updated,
      );

      setCoverFile(null);
      setCoverUploadProgress(0);
      toast.success("Release cover updated.");
    } catch (error) {
      if (uploadSessionId) {
        await uploadsApi
          .cancelSession(token, uploadSessionId)
          .catch(() => undefined);
      }

      setArtworkError(
        error instanceof Error ? error.message : "Unable to upload cover",
      );
      reportError(error, "Unable to upload cover");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoverFileChange = (file: File | undefined) => {
    if (!file) {
      setCoverFile(null);
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setArtworkError(
        "Choose a JPG, PNG, or WebP image for the release artwork.",
      );
      return;
    }

    if (file.size > MAX_COVER_SIZE_BYTES) {
      setArtworkError("Release artwork must be 10 MB or smaller.");
      return;
    }

    setArtworkError("");
    setCoverFile(file);
  };

  const addTrack = async (confirmed = false) => {
    if (!confirmed && needsLargerType()) {
      setNextType(release?.type === "ep" ? "album" : "ep");
      setTypePrompt("add");
      return;
    }
    const token = session?.token;

    if (!token || !release || !selectedTrackId) {
      return;
    }

    try {
      if (!(await saveWorkspace())) return;
      setIsSaving(true);
      setActionError("");
      const updated = await releasesApi.addTrackToRelease(token, release.id, {
        trackId: selectedTrackId,
        discNumber: 1,
        isFocusTrack: false,
      });
      applyTracks(updated, true);
      setSelectedTrackId("");
      toast.success("Track added to release.");
    } catch (error) {
      reportError(error, "Unable to add track");
    } finally {
      setIsSaving(false);
    }
  };

  const updateTrackOrder = async (
    trackId: string,
    patch: Partial<{
      trackNumber: number;
      discNumber: number;
      isFocusTrack: boolean;
    }>,
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
      setActionError("");
      const updated = await releasesApi.reorderReleaseTracks(
        token,
        release.id,
        {
          items: release.tracks.map((item, index) => ({
            trackId: item.trackId,
            trackNumber: item.trackNumber || index + 1,
            discNumber: item.discNumber || 1,
            isFocusTrack: item.isFocusTrack,
          })),
        },
      );
      applyTracks(updated);
      toast.success("Track order saved.");
    } catch (error) {
      reportError(error, "Unable to save order");
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
      setActionError("");
      await releasesApi.removeTrackFromRelease(token, release.id, trackId);
      const refreshed = await releasesApi.getManageRelease(token, release.id);
      if (!refreshed) throw new Error("Release not found");
      applyTracks(refreshed, true);
      toast.success("Track removed from release.");
    } catch (error) {
      reportError(error, "Unable to remove track");
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
    if (!session?.token || !release) return;
    const details = validatedDetails();
    if (!details) return;
    setIsSaving(true);
    setActionError("");
    try {
      await saveTrackInformation();
      await saveOrderBeforeNavigation();
      const updated = await releasesApi.updateRelease(
        session.token,
        release.id,
        {
          ...details,
          status,
          releaseDate:
            status === "scheduled" ? toIsoString(releaseDateInput) : undefined,
        },
      );
      setRelease(updated);
      setSavedRelease(updated);
      setLaunchMode(toLaunchMode(updated.status));
      setReleaseDateInput(toDateTimeLocalValue(updated.releaseDate));
      if (status === "published") trackEvent("release_published");
      toast.success(
        status === "published"
          ? "Release published."
          : status === "scheduled"
            ? "Release scheduled."
            : "Release moved to draft.",
      );
    } catch (error) {
      reportError(error, "Unable to update publication");
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
      reportError(error, "Unable to delete release");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!session?.token) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 text-muted-foreground">
        Connect your account before managing a release.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 text-muted-foreground">
        Loading release details...
      </div>
    );
  }

  if (!release) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 text-muted-foreground">
        {loadError || "Release not found."}
        {loadError ? (
          <Button
            variant="outline"
            className="ml-3"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  if (
    ["published", "scheduled"].includes(release.status) &&
    !release.hasRevision
  )
    return (
      <div className="max-w-[720px] space-y-6">
        <StudioPageHeader
          title={release.title}
          description={`${release.type.toUpperCase()} · ${release.tracks.length} ${release.tracks.length === 1 ? "track" : "tracks"}`}
          actions={<StatusBadge status={release.status} />}
        />
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Edit this release</h2>
          <p className="text-sm text-muted-foreground">
            Start a saved revision to add, remove, or reorder songs and update
            release details. Listeners keep the current version until you review
            and apply your changes.
          </p>
          {actionError ? (
            <p role="alert" className="text-destructive">
              {actionError}
            </p>
          ) : null}
          <Button
            disabled={isSaving}
            onClick={async () => {
              setIsSaving(true);
              try {
                const next = await releasesApi.beginRevision(
                  session.token!,
                  release.id,
                );
                setRelease(next);
                setSavedRelease(next);
                setLaunchMode(
                  next.status === "scheduled" ? "scheduled" : "published",
                );
              } catch (error) {
                reportError(error, "Unable to start revision");
              } finally {
                setIsSaving(false);
              }
            }}
          >
            {isSaving ? "Starting revision..." : "Start revision"}
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/releases">Back to releases</Link>
          </Button>
        </div>
      </div>
    );

  const readinessIssues: ReadinessIssue[] = [];

  if (!release.title.trim()) {
    readinessIssues.push({
      label: "Add a release title",
      targetId: "release-title",
    });
  }

  if (!release.artistName.trim()) {
    readinessIssues.push({
      label: "Add an artist name",
      targetId: "release-artist-name",
    });
  }

  if (!release.genre.trim()) {
    readinessIssues.push({
      label: "Add a primary genre",
      targetId: "release-genre",
    });
  }

  if (!release.coverImageUrl && !release.coverStorageKey) {
    readinessIssues.push({
      label: "Upload release artwork",
      targetId: "release-cover",
    });
  }

  if (release.tracks.length === 0) {
    readinessIssues.push({
      label: "Add at least one track",
      targetId: "release-tracklist",
    });
  } else if (release.type === "single" && release.tracks.length !== 1) {
    readinessIssues.push({
      label: "A Single must contain exactly one track",
      targetId: "release-tracklist",
    });
  } else if (
    release.type === "ep" &&
    (release.tracks.length < 2 || release.tracks.length > 6)
  ) {
    readinessIssues.push({
      label: "An EP must contain between 2 and 6 tracks",
      targetId: "release-tracklist",
    });
  } else if (release.type === "album" && release.tracks.length < 7) {
    readinessIssues.push({
      label: "An album must contain at least 7 tracks",
      targetId: "release-tracklist",
    });
  }

  if (release.tracks.some((item) => !item.track.playbackReady)) {
    readinessIssues.push({
      label: "Wait for every track to finish audio processing",
      targetId: "release-tracklist",
    });
  }

  if (release.tracks.filter((item) => item.isFocusTrack).length > 1) {
    readinessIssues.push({
      label: "Choose only one focus track",
      targetId: "release-tracklist",
    });
  }

  if (
    launchMode === "scheduled" &&
    (!toIsoString(releaseDateInput) ||
      new Date(releaseDateInput).getTime() <= Date.now())
  ) {
    readinessIssues.push({
      label: "Choose a future release date",
      targetId: "release-date",
    });
  }

  const focusReadinessTarget = (targetId: string) => {
    selectStep(targetSection(targetId));
    requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus();
    });
  };
  const publish = () => {
    if (release.hasRevision && launchMode === "draft") {
      void saveWorkspace();
      return;
    }
    if (launchMode !== "draft" && readinessIssues.length) {
      focusReadinessTarget(readinessIssues[0].targetId);
      return;
    }
    void updateStatus(launchMode);
  };
  const completedSteps = [
    ...(release.title.trim() &&
    release.artistName.trim() &&
    release.genre.trim()
      ? ["basics"]
      : []),
    ...(release.tracks.length ? ["music"] : []),
    ...(release.tracks.length &&
    release.tracks.every(
      (item) =>
        trackMetadataUpdateSchema.safeParse(trackInfo(item.track)).success,
    )
      ? ["information"]
      : []),
    ...(release.coverStorageKey || release.coverImageUrl ? ["artwork"] : []),
  ];
  const refreshAudio = async () => {
    if (!(await saveWorkspace()) || !session?.token) return;
    setIsSaving(true);
    try {
      await Promise.all(
        release.tracks
          .filter((item) => !item.track.playbackReady)
          .map((item) =>
            tracksApi.syncTrackMedia(session.token!, item.trackId),
          ),
      );
      const updated = await releasesApi.getManageRelease(
        session.token,
        release.id,
      );
      if (!updated) throw new Error("Release not found");
      setRelease(updated);
      setSavedRelease(updated);
    } catch (error) {
      reportError(error, "Unable to refresh recordings");
    } finally {
      setIsSaving(false);
    }
  };
  const detailsDirty =
    JSON.stringify(releaseDetails(release)) !==
    JSON.stringify(savedRelease ? releaseDetails(savedRelease) : null);
  const reviewDirty =
    launchMode !== savedRelease?.status ||
    releaseDateInput !== toDateTimeLocalValue(savedRelease?.releaseDate);
  const orderDirty =
    JSON.stringify(orderItems(release)) !==
    JSON.stringify(savedRelease ? orderItems(savedRelease) : []);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        className="px-0"
        disabled={isSaving}
        onClick={() => void continueStep(true)}
      >
        <ArrowLeft />
        Save & return to releases
      </Button>
      <StudioPageHeader
        title={release.title || "Untitled release"}
        eyebrow="Release"
        description={`${release.artistName} · ${release.type.toUpperCase()} · ${release.tracks.length} ${release.tracks.length === 1 ? "track" : "tracks"}`}
        actions={
          <StatusBadge status={savedRelease?.status ?? release.status} />
        }
      >
        <p role="status" className="text-sm text-muted-foreground">
          {isSaving
            ? "Saving changes…"
            : detailsDirty ||
                orderDirty ||
                reviewDirty ||
                release.tracks.some(
                  (item) =>
                    JSON.stringify(trackInfo(item.track)) !==
                    JSON.stringify(
                      savedRelease?.tracks.find(
                        (row) => row.trackId === item.trackId,
                      )?.track
                        ? trackInfo(
                            savedRelease.tracks.find(
                              (row) => row.trackId === item.trackId,
                            )!.track,
                          )
                        : null,
                    ),
                )
              ? "Unsaved changes"
              : "All changes saved"}
        </p>
      </StudioPageHeader>
      {release.hasRevision ? (
        <p
          role="status"
          className="rounded-md border border-border bg-card p-4 text-sm"
        >
          Editing a saved revision. The current release stays available until
          you apply the update in Review & publish.
        </p>
      ) : null}
      {actionError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive p-3 text-sm text-destructive"
        >
          {actionError}. Your unsaved changes are still here.
        </p>
      ) : null}
      <div id="release-progress">
        <StepNavigation
          label="Release progress"
          steps={releaseSteps}
          completed={completedSteps}
          current={Math.max(
            0,
            releaseSteps.findIndex((step) => step.id === section),
          )}
          onSelect={(index) => selectStep(releaseSteps[index].id)}
          disabled={isSaving}
        />
      </div>
      {section === "basics" ? (
        <form
          className="max-w-[720px] rounded-lg border border-border bg-card p-4 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void continueStep();
          }}
        >
          <fieldset disabled={isSaving}>
            <ReleaseBasicsFields
              value={release}
              onChange={(patch) =>
                setRelease((current) =>
                  current ? { ...current, ...patch } : current,
                )
              }
              errors={fieldErrors}
            />
          </fieldset>
        </form>
      ) : null}
      {section === "artwork" ? (
        <div className="space-y-6">
          <ReleaseDetailsEditor
            release={release}
            onChange={(patch) =>
              setRelease((current) =>
                current ? { ...current, ...patch } : current,
              )
            }
            busy={isSaving}
            errors={fieldErrors}
          >
            <ReleaseTrackLabels
              releaseId={release.id}
              label={release.recordLabel ?? ""}
              tracks={release.tracks.map((item) => item.track)}
              token={session.token}
              onApplied={(updated) => {
                setRelease((current) =>
                  current
                    ? {
                        ...current,
                        tracks: current.tracks.map((item) => ({
                          ...item,
                          track:
                            updated.find(
                              (track) => track.id === item.trackId,
                            ) ?? item.track,
                        })),
                      }
                    : current,
                );
                setMyTracks((current) =>
                  current.map(
                    (track) =>
                      updated.find((item) => item.id === track.id) ?? track,
                  ),
                );
              }}
            />
          </ReleaseDetailsEditor>

          <ReleaseArtworkEditor
            image={release.coverImageUrl}
            preview={coverPreviewUrl}
            file={coverFile}
            progress={coverUploadProgress}
            busy={isSaving}
            error={artworkError}
            onSelect={handleCoverFileChange}
            onUpload={() => void uploadCover()}
          />
        </div>
      ) : null}
      {section === "music" ? (
        <div className="space-y-6">
          {release.tracks.some((item) => !item.track.playbackReady) ? (
            <Button
              variant="outline"
              disabled={isSaving}
              onClick={() => void refreshAudio()}
            >
              Refresh audio status
            </Button>
          ) : null}
          <ReleaseTracklistEditor
            release={release}
            available={availableTracks}
            selected={selectedTrackId}
            busy={isSaving}
            onSelect={setSelectedTrackId}
            onAdd={() => void addTrack()}
            onUpload={() => void uploadNewTrack()}
            onChange={updateTrackOrder}
            onMove={moveTrack}
            onRemove={(id) => void removeTrack(id)}
            onSave={() => void saveTrackOrder()}
            onEdit={(id) => {
              setInformationTrack(id);
              selectStep("information");
            }}
          />
          {isAudioOpen ? (
            <ReleaseAudioUploader
              release={release}
              token={session.token}
              onSaved={(track) =>
                setMyTracks((current) => [
                  ...current.filter((item) => item.id !== track.id),
                  track,
                ])
              }
              onBusy={setIsSaving}
              onClose={() => setIsAudioOpen(false)}
              onAdded={(updated, track) => {
                applyTracks(updated, true);
                setMyTracks((current) => [
                  ...current.filter((item) => item.id !== track.id),
                  track,
                ]);
              }}
            />
          ) : null}
        </div>
      ) : null}
      {section === "information" ? (
        <ReleaseTrackInformation
          selectedTrack={informationTrack}
          release={release}
          artists={artists}
          busy={isSaving}
          errors={trackErrors}
          onChange={(id, patch) =>
            setRelease((current) =>
              current
                ? {
                    ...current,
                    tracks: current.tracks.map((item) =>
                      item.trackId === id
                        ? { ...item, track: { ...item.track, ...patch } }
                        : item,
                    ),
                  }
                : current,
            )
          }
        />
      ) : null}
      {section === "review" ? (
        <>
          {release.tracks.some((item) => !item.track.playbackReady) ? (
            <Button
              variant="outline"
              disabled={isSaving}
              onClick={() => void refreshAudio()}
            >
              Refresh audio status
            </Button>
          ) : null}
          <ReleaseReview
            release={release}
            issues={readinessIssues}
            mode={launchMode}
            date={releaseDateInput}
            busy={isSaving}
            onMode={setLaunchMode}
            onDate={setReleaseDateInput}
            onResolve={focusReadinessTarget}
            onPublish={publish}
            error={
              fieldErrors.releaseDate ??
              readinessIssues.find((issue) => issue.targetId === "release-date")
                ?.label
            }
          />
        </>
      ) : null}
      <ActionBar>
        <Button
          variant="outline"
          disabled={isSaving || section === "basics"}
          onClick={() =>
            selectStep(
              releaseSteps[
                Math.max(
                  0,
                  releaseSteps.findIndex((step) => step.id === section) - 1,
                )
              ].id,
            )
          }
        >
          Back
        </Button>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="ghost"
            disabled={isSaving}
            onClick={() => void continueStep(true)}
          >
            Save & exit
          </Button>
          {section !== "review" ? (
            <Button disabled={isSaving} onClick={() => void continueStep()}>
              {isSaving ? "Saving..." : "Save & continue"}
            </Button>
          ) : null}
        </div>
      </ActionBar>
      {typePrompt ? (
        <Dialog
          title="Change release type"
          description="A Single holds one song and an EP holds up to six. Choose a larger release before adding another recording."
          busy={isSaving}
          onClose={() => setTypePrompt(null)}
        >
          <div className="space-y-4">
            <Select
              aria-label="New release type"
              value={nextType}
              onChange={(e) => setNextType(e.target.value as "ep" | "album")}
              className="h-11 rounded-md border border-input bg-background px-3"
            >
              <option value="ep" disabled={release.tracks.length >= 6}>
                EP · 2–6 tracks
              </option>
              <option value="album">Album · 7+ tracks</option>
            </Select>
            <Button
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                try {
                  await saveTrackInformation();
                  await saveOrderBeforeNavigation();
                  const updated = await releasesApi.updateRelease(
                    session.token!,
                    release.id,
                    { ...releaseDetails(release), type: nextType },
                  );
                  setRelease(updated);
                  setSavedRelease(updated);
                  setTypePrompt(null);
                  if (typePrompt === "upload") setIsAudioOpen(true);
                  else {
                    const added = await releasesApi.addTrackToRelease(
                      session.token!,
                      release.id,
                      {
                        trackId: selectedTrackId,
                        discNumber: 1,
                        isFocusTrack: false,
                      },
                    );
                    applyTracks(added, true);
                    setSelectedTrackId("");
                  }
                } catch (error) {
                  reportError(error, "Unable to change release type");
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              Change type &{" "}
              {typePrompt === "upload" ? "upload" : "add recording"}
            </Button>
          </div>
        </Dialog>
      ) : null}
      <div className="border-t border-border pt-4">
        <Button
          variant="ghost"
          className="text-destructive"
          disabled={isSaving || isDeleting}
          onClick={() => setIsDeleteConfirmOpen(true)}
        >
          <Trash2 />
          Delete release
        </Button>
      </div>
      {isDeleteConfirmOpen ? (
        <Dialog
          title={`Delete "${release.title}"?`}
          description="This removes the release page and detaches its tracks. Your tracks and audio stay in your library."
          busy={isDeleting}
          onClose={() => setIsDeleteConfirmOpen(false)}
        >
          <div className="flex justify-end gap-3">
            <Button
              autoFocus
              variant="outline"
              disabled={isDeleting}
              onClick={() => setIsDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void deleteRelease()}
            >
              {isDeleting ? "Deleting..." : "Delete release"}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
};
