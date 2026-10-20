import { ReleaseSetupFields, releaseSetupErrors } from "./release-setup-fields";
import { ReleaseSharedDetails } from "./release-shared-details";
("use client");

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  releaseUpdateSchema,
  type ReleaseDetail,
  type TrackSummary,
  type ArtistSummary,
  trackMetadataUpdateSchema,
} from "@music-city/shared";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { ReleaseBasicsFields } from "./release-basics-fields";
import { ReleaseDetailsEditor } from "./release-details-editor";
import { ReleaseArtworkEditor } from "./release-artwork-editor";
import { ReleaseTracklistEditor } from "./release-tracklist-editor";
import { ReleaseReview, type ReadinessIssue } from "./release-review";

type ReleaseSection = ReleaseStep;
const targetSection = (id: string): ReleaseSection =>
  id === "release-track-information"
    ? "information"
    : id === "release-cover"
      ? "artwork"
      : id === "release-tracklist"
        ? "music"
        : id === "release-date"
          ? "review"
          : ["release-title", "release-song-count"].includes(id)
            ? "basics"
            : "artwork";
const releaseDetails = (release: ReleaseDetail) => ({
  title: release.title.trim(),
  artistName: release.artistName.trim(),
  type: release.type,
  genre: release.genre.trim(),
  expectedTrackCount:
    release.type === "single" ? 1 : release.expectedTrackCount,
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
  const [audioBusy, setAudioBusy] = useState(false);
  const [replaceAudioId, setReplaceAudioId] = useState<string | undefined>();
  const [selectedAudioFiles, setSelectedAudioFiles] = useState<File[]>();

  const [params, setParams] = useSearchParams();
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [trackErrors, setTrackErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [informationTrack, setInformationTrack] = useState<string | null>(null);
  const [isAudioOpen, setIsAudioOpen] = useState(false);
  const { session } = useAuth();
  const [release, setRelease] = useState<ReleaseDetail | null>(null);
  const [myTracks, setMyTracks] = useState<TrackSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
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
              : ["title", "type", "expectedTrackCount"].includes(key)
                ? "basics"
                : "artwork";
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
      return {
        ...current,
        type: updated.type,
        tracks: preserved,
        trackCount: tracks.length,
      };
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
    if (["processing", "scheduled"].includes(release.publication?.state ?? ""))
      return true;
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
      setRelease((current) =>
        current ? { ...current, publication: updated.publication } : updated,
      );
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
    if (!exit && section === "basics" && release) {
      const errors = releaseSetupErrors(release);
      setFieldErrors(errors);
      if (Object.keys(errors).length) return;
    }
    if (
      !exit &&
      section === "music" &&
      release &&
      (release.tracks.length === 0 ||
        (release.expectedTrackCount &&
          release.tracks.length !== release.expectedTrackCount))
    ) {
      setActionError(
        release.expectedTrackCount &&
          release.tracks.length > release.expectedTrackCount
          ? "Remove extra songs or update the song count in Release setup"
          : "Add all your songs before continuing, or update the song count in Release setup",
      );
      return;
    }
    if (!(await saveWorkspace())) return;
    if (exit) {
      router.push("/dashboard/releases");
      return;
    }
    const index = releaseSteps.findIndex((step) => step.id === section);
    selectStep(releaseSteps[Math.min(index + 1, releaseSteps.length - 1)].id);
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
  const uploadNewTrack = async (files: File[]) => {
    if (files.length && await saveWorkspace()) {
      setReplaceAudioId(undefined);
      setSelectedAudioFiles(files);
      setIsAudioOpen(true);
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

  const addTrack = async (trackId: string) => {
    const token = session?.token;

    if (!token || !release || !trackId) {
      return;
    }

    try {
      if (!(await saveWorkspace())) return;
      setIsSaving(true);
      setActionError("");
      const updated = await releasesApi.addTrackToRelease(token, release.id, {
        trackId,
        discNumber: 1,
        isFocusTrack: false,
      });
      applyTracks(updated, true);
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
      await releasesApi.updateRelease(session.token, release.id, details);
      const updated =
        status === "draft"
          ? await releasesApi.updateRelease(session.token, release.id, {
              status: "draft",
            })
          : await releasesApi.publish(
              session.token,
              release.id,
              status as "published" | "scheduled",
              status === "scheduled"
                ? toIsoString(releaseDateInput)
                : undefined,
            );
      setRelease(updated);
      setSavedRelease(updated);
      setLaunchMode(updated.publication?.mode ?? toLaunchMode(updated.status));
      setReleaseDateInput(toDateTimeLocalValue(updated.releaseDate));
      if (status === "published") trackEvent("release_published");
      toast.success(
        status === "published"
          ? updated.publication?.state === "processing"
            ? "Publication requested. You can leave this page."
            : "Release published."
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

  const publicationPending = ["processing", "scheduled"].includes(
    release?.publication?.state ?? "",
  );
  const draftSignature = JSON.stringify(
    release
      ? [
          releaseDetails(release),
          orderItems(release),
          release.tracks.map((item) => trackInfo(item.track)),
        ]
      : null,
  );
  const savedSignature = JSON.stringify(
    savedRelease
      ? [
          releaseDetails(savedRelease),
          orderItems(savedRelease),
          savedRelease.tracks.map((item) => trackInfo(item.track)),
        ]
      : null,
  );
  const saveAction = useRef(saveWorkspace);
  saveAction.current = saveWorkspace;
  useEffect(() => {
    if (
      !release ||
      !savedRelease ||
      actionError ||
      isSaving ||
      audioBusy ||
      publicationPending ||
      (!release.hasRevision &&
        ["published", "scheduled"].includes(release.status)) ||
      draftSignature === savedSignature ||
      Object.keys(releaseSetupErrors(release)).length > 0 ||
      release.tracks.some(
        (item) =>
          !trackMetadataUpdateSchema.safeParse(trackInfo(item.track)).success,
      )
    )
      return;
    const timer = setTimeout(() => void saveAction.current(), 1000);
    return () => clearTimeout(timer);
  }, [
    draftSignature,
    savedSignature,
    isSaving,
    audioBusy,
    publicationPending,
    actionError,
  ]);
  useEffect(() => {
    if (
      !session?.token ||
      !release ||
      isSaving ||
      audioBusy ||
      !(
        publicationPending ||
        release.tracks.some(
          (item) => !item.track.playbackReady && item.track.status !== "failed",
        )
      )
    )
      return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      if (document.visibilityState !== "hidden")
        try {
          const updated = await releasesApi.getManageRelease(
            session.token!,
            releaseId,
          );
          if (updated && !cancelled) {
            const merge = (current: ReleaseDetail | null) =>
              current
                ? {
                    ...current,
                    status: updated.status,
                    hasRevision: updated.hasRevision,
                    publication: updated.publication,
                    tracks: current.tracks.map((item) => {
                      const audio = updated.tracks.find(
                        (t) => t.trackId === item.trackId,
                      )?.track;
                      return audio
                        ? {
                            ...item,
                            track: {
                              ...item.track,
                              status: audio.status,
                              playbackReady: audio.playbackReady,
                              runtime: audio.runtime,
                              muxAssetId: audio.muxAssetId,
                              muxPlaybackId: audio.muxPlaybackId,
                              muxAssetStatus: audio.muxAssetStatus,
                            },
                          }
                        : item;
                    }),
                  }
                : current;
            setRelease(merge);
            setSavedRelease(merge);
          }
        } catch {
          /* The server keeps working while this view reconnects. */
        }
      if (!cancelled) timer = setTimeout(check, 5000);
    };
    timer = setTimeout(check, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    session?.token,
    releaseId,
    publicationPending,
    isSaving,
    audioBusy,
    release?.tracks
      .map((t) => `${t.trackId}:${t.track.playbackReady}:${t.track.status}`)
      .join(","),
  ]);
  useEffect(() => {
    if (!coverFile || isSaving || publicationPending) return;
    void uploadCover();
  }, [coverFile]);

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

  const deleteControls = (
    <div className="border-t border-border pt-4">
      <Button
        variant="ghost"
        className="text-destructive hover:text-destructive"
        disabled={isDeleting || isSaving || audioBusy}
        onClick={() => setIsDeleteConfirmOpen(true)}
      >
        Delete release
      </Button>
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
          <p className="text-sm text-muted-foreground">
            Changes stay private until you apply the update.
          </p>
          {actionError ? (
            <p role="alert" className="text-destructive">
              {actionError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
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
                  reportError(error, "Couldn’t open the release for editing");
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {isSaving ? "Opening..." : "Edit release"}
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/releases">Back to releases</Link>
            </Button>
          </div>
        </div>
        {deleteControls}
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

  if (
    release.expectedTrackCount &&
    release.tracks.length > 0 &&
    release.tracks.length !== release.expectedTrackCount
  ) {
    readinessIssues.push({
      label: `Add ${release.expectedTrackCount} songs or update the song count`,
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
    if (
      launchMode !== "draft" &&
      readinessIssues.some((issue) => issue.kind !== "audio")
    ) {
      focusReadinessTarget(readinessIssues[0].targetId);
      return;
    }
    void updateStatus(launchMode);
  };
  const completedSteps = [
    ...(Object.keys(releaseSetupErrors(release)).length === 0
      ? ["basics"]
      : []),
    ...(release.tracks.length &&
    (!release.expectedTrackCount ||
      release.tracks.length === release.expectedTrackCount)
      ? ["music"]
      : []),
    ...(release.tracks.length &&
    release.tracks.every(
      (item) =>
        trackMetadataUpdateSchema.safeParse(trackInfo(item.track)).success,
    )
      ? ["information"]
      : []),
    ...(release.coverStorageKey || release.coverImageUrl ? ["artwork"] : []),
  ];

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
        disabled={isSaving || audioBusy}
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
          <StatusBadge
            status={
              release.publication?.state === "failed"
                ? "Needs attention"
                : publicationPending
                  ? release.publication!.state
                  : (savedRelease?.status ?? release.status)
            }
          />
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
              ? actionError
                ? "Couldn’t save"
                : "Unsaved changes"
              : "All changes saved"}
        </p>
      </StudioPageHeader>
      {release.hasRevision ? (
        <p
          role="status"
          className="rounded-md border border-border bg-card p-4 text-sm"
        >
          Unpublished changes
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
          disabled={isSaving || audioBusy}
        />
      </div>
      {publicationPending && (
        <section
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/50 bg-warning/5 p-4"
        >
          <p>
            {release.publication?.state === "scheduled"
              ? "Release scheduled"
              : "Processing · publishes automatically"}
          </p>
          <Button
            variant="outline"
            disabled={isSaving}
            onClick={async () => {
              try {
                const updated = await releasesApi.cancelPublication(
                  session.token!,
                  release.id,
                );
                setRelease(updated);
                setSavedRelease(updated);
              } catch (e) {
                reportError(e, "Couldn't cancel publication");
              }
            }}
          >
            Cancel publication & edit
          </Button>
        </section>
      )}
      {release.publication?.state === "failed" && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/50 p-4 text-destructive"
        >
          {release.publication.error}
        </p>
      )}
      {section === "basics" ? (
        <fieldset
          disabled={isSaving || publicationPending}
          className="max-w-[720px] space-y-5 rounded-lg border border-border bg-card p-4 sm:p-6"
        >
          <h2 className="text-lg font-semibold">Set up your release</h2>
          <ReleaseSetupFields
            value={release}
            errors={fieldErrors}
            onChange={(patch) =>
              setRelease((current) =>
                current ? { ...current, ...patch } : current,
              )
            }
          />
        </fieldset>
      ) : null}
      {section === "artwork" ? (
        <div className="max-w-[720px] space-y-6">
          <fieldset
            disabled={isSaving || publicationPending}
            className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6"
          >
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
          <ReleaseDetailsEditor
            release={release}
            onChange={(patch) =>
              setRelease((current) =>
                current ? { ...current, ...patch } : current,
              )
            }
            busy={isSaving || publicationPending}
            errors={fieldErrors}
          ></ReleaseDetailsEditor>

          <ReleaseArtworkEditor
            image={release.coverImageUrl}
            preview={coverPreviewUrl}
            file={coverFile}
            progress={coverUploadProgress}
            busy={isSaving || publicationPending}
            error={artworkError}
            onSelect={handleCoverFileChange}
            onUpload={() => void uploadCover()}
          />
        </div>
      ) : null}
      {section === "music" ? (
        <div className="space-y-6">
          <ReleaseTracklistEditor
            release={release}
            available={availableTracks}
            busy={isSaving || publicationPending || audioBusy}
            audioOpen={isAudioOpen}
            onSetup={() => selectStep("basics")}
            onAdd={(id) => void addTrack(id)}
            onUpload={(files) => void uploadNewTrack(files)}
            onChange={updateTrackOrder}
            onMove={moveTrack}
            onRemove={(id) => void removeTrack(id)}
            onReplace={(id) => {
              setReplaceAudioId(id);
              setIsAudioOpen(true);
            }}
          >
            {isAudioOpen ? (
              <ReleaseAudioUploader
                release={release}
                token={session.token}
                initialFiles={replaceAudioId ? undefined : selectedAudioFiles}
                onSaved={(track) =>
                  setMyTracks((current) => [
                    ...current.filter((item) => item.id !== track.id),
                    track,
                  ])
                }
                onBusy={setAudioBusy}
                maxFiles={
                  release.type === "single"
                    ? Math.max(0, 1 - release.tracks.length)
                    : release.expectedTrackCount
                      ? Math.max(
                          0,
                          release.expectedTrackCount - release.tracks.length,
                        )
                      : undefined
                }
                replaceId={replaceAudioId}
                onClose={() => {
                  setIsAudioOpen(false);
                  setReplaceAudioId(undefined);
                  setSelectedAudioFiles(undefined);
                }}
                onAdded={(updated, track) => {
                  applyTracks(updated, true);
                  setMyTracks((current) => [
                    ...current.filter((item) => item.id !== track.id),
                    track,
                  ]);
                }}
              />
            ) : null}
          </ReleaseTracklistEditor>
        </div>
      ) : null}
      {section === "information" ? (
        <div className="space-y-6">
          <ReleaseSharedDetails
            release={release}
            artists={artists}
            busy={isSaving || publicationPending}
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
          <ReleaseTrackInformation
            selectedTrack={informationTrack}
            release={release}
            artists={artists}
            busy={isSaving || publicationPending}
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
        </div>
      ) : null}
      {section === "review" ? (
        <>
          <ReleaseReview
            token={session.token}
            onAudioUpdated={(updated) => {
              const merge = (current: ReleaseDetail | null) =>
                current
                  ? {
                      ...current,
                      tracks: current.tracks.map((item) => {
                        const audio = updated.find(
                          (track) => track.id === item.trackId,
                        );
                        if (!audio) return item;
                        const fields = [
                          "status",
                          "runtime",
                          "playbackReady",
                          "muxAssetStatus",
                          "muxAssetId",
                          "muxPlaybackId",
                          "playbackUrl",
                          "streamMediaUrl",
                          "streamManifestUrl",
                          "masterStorageKey",
                          "streamManifestKey",
                          "archiveStatus",
                        ] as const;
                        return {
                          ...item,
                          track: {
                            ...item.track,
                            ...Object.fromEntries(
                              fields
                                .filter((key) => key in audio)
                                .map((key) => [key, audio[key]]),
                            ),
                          },
                        };
                      }),
                    }
                  : current;
              setRelease(merge);
              setSavedRelease(merge);
            }}
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
          disabled={isSaving || audioBusy || section === "basics"}
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
            disabled={isSaving || audioBusy}
            onClick={() => void continueStep(true)}
          >
            Save & exit
          </Button>
          {section !== "review" ? (
            <Button
              disabled={isSaving || audioBusy}
              onClick={() => void continueStep()}
            >
              {isSaving ? "Saving..." : "Continue"}
            </Button>
          ) : null}
        </div>
      </ActionBar>
      {deleteControls}
    </div>
  );
};
