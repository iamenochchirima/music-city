"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { toast } from "sonner";

import type { ArtistSummary, PaymentIntentRecord } from "@music-city/shared";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { StepNavigation } from "@/components/studio/step-navigation";
import { ActionBar } from "@/components/studio/action-bar";
import { Progress } from "@/components/ui/progress";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { musicGenres } from "@/features/music/data/metadata-options";
import { ArtistPaymentReviewDialog } from "@/features/onboarding/components/artist-payment-review-dialog";
import { useArtistOnboardingPayment } from "@/features/onboarding/hooks/use-artist-onboarding-payment";
import { uploadsApi } from "@/features/uploads/lib/uploads-api";
import { usersApi } from "@/features/users/lib/users-api";
import { useAuth } from "@/hooks/use-auth";
import { ApiClientError } from "@/lib/api/http-client";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { trackEvent } from "@/lib/analytics";

import {
  TrackMetadataEditor,
  emptyTrackMetadata,
  validateTrackMetadata,
  creditRoleLabels,
} from "./track-metadata-editor";
import {
  restoreTrackUploadDraft,
  type StoredTrackDraft,
} from "../lib/track-upload-draft";

import { TrackUploadResult } from "./track-upload-result";

interface TrackCreateFormProps {
  onCreated: () => void;
  onClose?: () => void;
}

const steps = [
  {
    id: "basics",
    label: "Track details",
    description: "Name the recording and identify the artists.",
  },
  { id: "media", label: "Audio", description: "Upload the master audio file." },
  {
    id: "credits",
    label: "Credits & identifiers",
    description:
      "Add optional credits, recording identifier, and record label.",
  },
  {
    id: "review",
    label: "Review and save",
    description: "Review the recording before saving it as a draft.",
  },
] as const;

const isEmailLike = (value: string) => /\S+@\S+\.\S+/.test(value.trim());
const MAX_AUDIO_SIZE_BYTES = 500 * 1024 * 1024;
export const TrackCreateForm = ({
  onCreated,
  onClose,
}: TrackCreateFormProps) => {
  const router = useRouter();
  const { session } = useAuth();
  const {
    complete: completeArtistFeePayment,
    isPaying: isPayingArtistFee,
    prepare: prepareArtistFeePayment,
  } = useArtistOnboardingPayment();

  const [stepIndex, setStepIndex] = useState(0);
  const [metadata, setMetadata] = useState(emptyTrackMetadata);
  const [basicErrors, setBasicErrors] = useState<Record<string, string>>({});
  const [audioError, setAudioError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>(
    {},
  );
  const [artistOptions, setArtistOptions] = useState<ArtistSummary[]>([]);
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState(session?.displayName ?? "");
  const [genre, setGenre] = useState("");
  const [isExplicit, setIsExplicit] = useState(false);
  const [featuredSearch, setFeaturedSearch] = useState("");
  const [featuredArtists, setFeaturedArtists] = useState<string[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [createdTrackId, setCreatedTrackId] = useState<string | null>(null);
  const [createdPlaybackReady, setCreatedPlaybackReady] = useState(false);
  const [createdTrackTitle, setCreatedTrackTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [artistFeeIntent, setArtistFeeIntent] =
    useState<PaymentIntentRecord | null>(null);
  const draftStorageKey = useMemo(
    () =>
      session?.walletAddress
        ? `music-city-track-draft:${session.walletAddress}`
        : null,
    [session?.walletAddress],
  );
  const [draftHydrated, setDraftHydrated] = useState(false);

  const deferredFeaturedSearch = useDeferredValue(
    featuredSearch.trim().toLowerCase(),
  );

  useEffect(() => {
    if (session?.displayName) {
      setArtistName((current) => current || session.displayName);
    }
  }, [session?.displayName]);

  useEffect(() => {
    if (!draftStorageKey || typeof window === "undefined") {
      return;
    }

    try {
      const rawDraft = window.localStorage.getItem(draftStorageKey);

      if (!rawDraft) {
        setDraftHydrated(true);
        return;
      }

      const draft = restoreTrackUploadDraft(JSON.parse(rawDraft));
      if (!draft) {
        window.localStorage.removeItem(draftStorageKey);
        return;
      }
      setStepIndex(steps.findIndex((step) => step.id === draft.stepId));
      setMetadata({
        credits: draft.credits,
        isrc: draft.isrc,
        recordLabel: draft.recordLabel,
      });
      // Persist the converted format immediately; retain the original expiration timestamp.
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      setTitle(typeof draft.title === "string" ? draft.title : "");
      setArtistName(
        typeof draft.artistName === "string"
          ? draft.artistName
          : (session?.displayName ?? ""),
      );
      setGenre(typeof draft.genre === "string" ? draft.genre : "");
      setIsExplicit(draft.isExplicit === true);
      setFeaturedArtists(
        Array.isArray(draft.featuredArtists)
          ? draft.featuredArtists.filter(
              (entry): entry is string => typeof entry === "string",
            )
          : [],
      );
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    } finally {
      setDraftHydrated(true);
    }
  }, [draftStorageKey, session?.displayName]);

  useEffect(() => {
    if (
      !draftStorageKey ||
      !draftHydrated ||
      typeof window === "undefined" ||
      createdTrackId
    ) {
      return;
    }

    const draft: StoredTrackDraft = {
      version: 2,
      savedAt: Date.now(),
      stepId: steps[stepIndex].id,
      ...metadata,
      title,
      artistName,
      genre,
      isExplicit,
      featuredArtists,
    };

    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }, [
    artistName,
    createdTrackId,
    draftHydrated,
    draftStorageKey,
    featuredArtists,
    genre,
    isExplicit,
    metadata,
    stepIndex,
    title,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadArtists = async () => {
      setIsLoadingArtists(true);

      try {
        const items = await usersApi.listArtists();

        if (!cancelled) {
          setArtistOptions(items);
        }
      } catch {
        if (!cancelled) {
          setArtistOptions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingArtists(false);
        }
      }
    };

    void loadArtists();

    return () => {
      cancelled = true;
    };
  }, []);

  const artistSuggestions = deferredFeaturedSearch
    ? artistOptions.filter((artist) => {
        const alreadySelected = featuredArtists.some(
          (entry) => entry.toLowerCase() === artist.name.toLowerCase(),
        );

        if (alreadySelected) {
          return false;
        }

        return (
          artist.name.toLowerCase().includes(deferredFeaturedSearch) ||
          artist.walletAddress.toLowerCase().includes(deferredFeaturedSearch)
        );
      })
    : [];

  const addFeaturedArtist = (value: string) => {
    const nextValue = value.trim();

    if (!nextValue) {
      return;
    }

    if (
      featuredArtists.some(
        (entry) => entry.toLowerCase() === nextValue.toLowerCase(),
      )
    ) {
      setFeaturedSearch("");
      return;
    }

    setFeaturedArtists((current) => [...current, nextValue]);
    setFeaturedSearch("");
  };

  const removeFeaturedArtist = (value: string) => {
    setFeaturedArtists((current) => current.filter((entry) => entry !== value));
  };

  const submitFeaturedSearch = () => {
    const nextValue = featuredSearch.trim();

    if (!nextValue) {
      return;
    }

    const exactArtistMatch = artistOptions.find(
      (artist) => artist.name.toLowerCase() === nextValue.toLowerCase(),
    );

    if (exactArtistMatch) {
      addFeaturedArtist(exactArtistMatch.name);
      return;
    }

    if (isEmailLike(nextValue)) {
      addFeaturedArtist(nextValue);
      return;
    }

    if (artistSuggestions.length > 0) {
      addFeaturedArtist(artistSuggestions[0].name);
      return;
    }

    toast.error("Choose an artist or enter a collaborator email.");
  };

  const focusInvalidField = () =>
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
  const canLeaveBasicsStep = () => {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = "Enter a track title.";
    if (!artistName.trim()) errors.artistName = "Enter an artist name.";
    if (!genre.trim()) errors.genre = "Choose a primary genre.";
    setBasicErrors(errors);
    if (Object.keys(errors).length) {
      setStepIndex(0);
      focusInvalidField();
      return false;
    }
    return true;
  };

  const goToStep = (nextStepIndex: number) => {
    if (nextStepIndex < 0 || nextStepIndex >= steps.length) {
      return;
    }

    if (nextStepIndex > stepIndex && !canLeaveBasicsStep()) {
      return;
    }

    if (nextStepIndex > 2) {
      const { result, errors } = validateTrackMetadata(metadata);
      setMetadataErrors(errors);
      if (!result.success) {
        setStepIndex(2);
        focusInvalidField();
        return;
      }
    }
    if (nextStepIndex > 1 && !audioFile) {
      setAudioError("Select your audio file before continuing.");
      setStepIndex(1);
      focusInvalidField();
      return;
    }
    setStepIndex(nextStepIndex);
  };

  const resetForm = () => {
    if (draftStorageKey && typeof window !== "undefined") {
      window.localStorage.removeItem(draftStorageKey);
    }

    setStepIndex(0);
    setMetadata(emptyTrackMetadata());
    setMetadataErrors({});
    setBasicErrors({});
    setAudioError("");
    setUploadError("");
    setTitle("");
    setArtistName(session?.displayName ?? "");
    setGenre("");
    setIsExplicit(false);
    setFeaturedSearch("");
    setFeaturedArtists([]);
    setAudioFile(null);
    setCreatedTrackId(null);
    setCreatedTrackTitle("");
    setUploadProgress(0);
    setUploadStage(null);
  };

  const handleAudioFileChange = (file: File | undefined) => {
    if (!file) {
      setAudioFile(null);
      return;
    }

    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      setAudioError("Audio files must be 500 MB or smaller.");
      setAudioFile(null);
      return;
    }

    if (file.type && !file.type.startsWith("audio/")) {
      setAudioError("Choose an audio file such as MP3, WAV, M4A, or FLAC.");
      setAudioFile(null);
      return;
    }

    setAudioError("");
    setAudioFile(file);
  };

  const audioContentType = (file: File) => {
    if (file.type.startsWith("audio/")) return file.type;
    switch (file.name.split(".").pop()?.toLowerCase()) {
      case "mp3":
        return "audio/mpeg";
      case "wav":
        return "audio/wav";
      case "m4a":
        return "audio/mp4";
      case "flac":
        return "audio/flac";
      default:
        return file.type || "application/octet-stream";
    }
  };

  const createTrack = async () => {
    if (!session?.token) {
      toast.error("Connect your wallet first");
      router.push("/auth");
      return;
    }

    if (stepIndex < steps.length - 1) {
      goToStep(stepIndex + 1);
      return;
    }

    if (!audioFile) {
      setAudioError("Choose an audio file before saving the track.");
      setStepIndex(1);
      focusInvalidField();
      return;
    }

    const { result: metadataResult, errors } = validateTrackMetadata(metadata);
    setMetadataErrors(errors);
    if (!metadataResult.success) {
      setStepIndex(2);
      return;
    }

    let createdTrackIdDuringUpload: string | null = null;
    let uploadSessionId: string | null = null;
    setIsSaving(true);
    setUploadError("");
    setUploadProgress(0);
    setUploadStage("Saving track draft...");

    try {
      const track = await tracksApi.createTrack(session.token, {
        title: title.trim(),
        artistName: artistName.trim(),
        featuredArtists,
        ...metadataResult.data,
        genre,
        isExplicit,
      });
      createdTrackIdDuringUpload = track.id;

      setUploadStage("Preparing audio upload...");
      const uploadSession = await uploadsApi.createSession(session.token, {
        trackId: track.id,
        purpose: "audio",
        fileName: audioFile.name,
        contentType: audioContentType(audioFile),
        sizeBytes: audioFile.size,
      });
      uploadSessionId = uploadSession.id;
      setUploadStage("Uploading audio...");
      const eTag = await uploadsApi.uploadFile(
        session.token,
        uploadSession,
        audioFile,
        setUploadProgress,
      );
      setUploadStage("Finalizing audio...");
      const completed = await uploadsApi.completeSession(
        session.token,
        uploadSession.id,
        {
          uploadSessionId: uploadSession.id,
          eTag,
        },
      );

      if (!completed.track)
        throw new Error("Audio completion did not return the saved recording.");
      setCreatedPlaybackReady(completed.track.playbackReady === true);
      setUploadProgress(100);
      setUploadStage("Track saved");
      setCreatedTrackId(track.id);
      setCreatedTrackTitle(track.title);
      if (draftStorageKey) {
        window.localStorage.removeItem(draftStorageKey);
      }
      onCreated();
      trackEvent("upload_completed");
      toast.success("Track saved as a draft");
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        Object.keys(error.fieldErrors).length
      ) {
        const basic = Object.keys(error.fieldErrors).some((key) =>
          ["title", "artistName", "genre", "featuredArtists"].includes(key),
        );
        if (basic) {
          setBasicErrors(error.fieldErrors);
          setStepIndex(0);
        } else {
          setMetadataErrors(error.fieldErrors);
          setStepIndex(2);
        }
        focusInvalidField();
      }
      if (uploadSessionId) {
        await uploadsApi
          .cancelSession(session.token, uploadSessionId)
          .catch(() => undefined);
      }

      if (createdTrackIdDuringUpload) {
        await tracksApi
          .deleteTrack(session.token, createdTrackIdDuringUpload)
          .catch(() => undefined);
      }

      if (error instanceof ApiClientError && error.status === 402) {
        try {
          setArtistFeeIntent(await prepareArtistFeePayment());
        } catch (paymentError) {
          setUploadError(
            paymentError instanceof Error
              ? paymentError.message
              : "Unable to prepare activation payment.",
          );
          toast.error(
            paymentError instanceof Error
              ? paymentError.message
              : "Unable to prepare the artist upload payment.",
          );
        }
      } else {
        setUploadError(
          error instanceof Error ? error.message : "Track upload failed",
        );
        toast.error(
          error instanceof Error ? error.message : "Track upload failed",
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const confirmArtistFeePayment = async () => {
    if (!artistFeeIntent) {
      return;
    }

    try {
      await completeArtistFeePayment(artistFeeIntent);
      setArtistFeeIntent(null);
      toast.success("Payment complete. You can now save your track.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Artist payment failed.",
      );
    }
  };

  if (createdTrackId) {
    return (
      <>
        <TrackUploadResult
          title={createdTrackTitle}
          trackId={createdTrackId}
          playbackReady={createdPlaybackReady}
          onReset={resetForm}
        />
        <ArtistPaymentReviewDialog
          intent={artistFeeIntent}
          isPaying={isPayingArtistFee}
          onCancel={() => setArtistFeeIntent(null)}
          onConfirm={() => void confirmArtistFeePayment()}
        />
      </>
    );
  }

  return (
    <>
      <div
        className="w-full max-w-[720px] space-y-8 rounded-lg border border-border bg-card p-4 sm:p-6"
        onKeyDown={(event) => {
          if (
            event.key !== "Enter" ||
            stepIndex >= steps.length - 1 ||
            event.shiftKey
          ) {
            return;
          }

          if (
            ["TEXTAREA", "BUTTON", "SELECT"].includes(
              (event.target as HTMLElement).tagName,
            )
          ) {
            return;
          }

          event.preventDefault();
          goToStep(stepIndex + 1);
        }}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Upload a track
            </p>
            <h2 className="text-[28px] font-semibold leading-8 text-foreground">
              {steps[stepIndex].label}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {steps[stepIndex].description}
            </p>
          </div>
          <StepNavigation
            steps={steps}
            current={stepIndex}
            onSelect={goToStep}
            disabled={isSaving}
          />
        </div>

        {stepIndex === 0 ? (
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                id="trackTitle"
                error={basicErrors.title}
                label="Track title"
              >
                <Input
                  id="trackTitle"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Your song title"
                  required
                />
              </FormField>
              <FormField
                id="trackArtistName"
                error={basicErrors.artistName}
                label="Artist name"
              >
                <Input
                  id="trackArtistName"
                  value={artistName}
                  onChange={(event) => setArtistName(event.target.value)}
                  placeholder="Your artist name"
                  required
                />
              </FormField>
              <FormField
                id="trackGenre"
                error={basicErrors.genre}
                label="Primary genre"
              >
                <SearchablePicker
                  id="trackGenre"
                  value={genre}
                  onValueChange={setGenre}
                  options={musicGenres}
                  placeholder="Select a genre"
                  searchPlaceholder="Search genres"
                  required
                />
              </FormField>
              <label className="flex min-h-11 items-start gap-3 pt-1 text-sm text-muted-foreground md:pt-7">
                <Checkbox
                  checked={isExplicit}
                  onChange={(event) => setIsExplicit(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium text-foreground">
                    Explicit content
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Mark this recording if it contains explicit lyrics or
                    themes.
                  </span>
                </span>
              </label>
            </div>

            <div className="space-y-2">
              <div>
                <Label htmlFor="featuredArtists">Featured artists</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional. Add collaborators who should appear on the track.
                </p>
              </div>
              <div className="space-y-3">
                {featuredArtists.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {featuredArtists.map((entry) => (
                      <span
                        key={entry}
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-white/[0.05] px-2.5 py-1.5 text-sm text-foreground"
                      >
                        {entry}
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => removeFeaturedArtist(entry)}
                          aria-label={`Remove ${entry}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="featuredArtists"
                      value={featuredSearch}
                      onChange={(event) =>
                        setFeaturedSearch(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          submitFeaturedSearch();
                        }
                      }}
                      placeholder="Search an artist or enter collaborator email"
                      className="pl-10"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={submitFeaturedSearch}
                  >
                    Add
                  </Button>
                </div>
                {featuredSearch ? (
                  <div className="mt-2 rounded-lg border border-border bg-popover">
                    {artistSuggestions.length > 0 ? (
                      artistSuggestions.slice(0, 5).map((artist) => (
                        <button
                          key={artist.id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                          onClick={() => addFeaturedArtist(artist.name)}
                        >
                          <span>{artist.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {artist.walletAddress.slice(0, 6)}...
                            {artist.walletAddress.slice(-4)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        {isLoadingArtists
                          ? "Loading artists..."
                          : "No match. You can add an email instead."}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {stepIndex === 1 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed border-input p-5">
              <p className="mt-1 text-sm text-muted-foreground">
                Upload the recording you want to place on a release.
              </p>
              <FormField
                id="trackFile"
                label="Master audio file"
                error={audioError}
                className="mt-4"
              >
                <Input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.flac"
                  onChange={(event) =>
                    handleAudioFileChange(event.target.files?.[0])
                  }
                />
              </FormField>
              <p className="mt-2 text-xs text-muted-foreground">
                MP3, WAV, M4A, or FLAC · up to 500 MB. Playback will be
                available after processing.
              </p>
              {audioFile ? (
                <p className="mt-3 break-words text-sm text-primary">
                  Selected: {audioFile.name}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  After a reload, select your audio file again. Your text
                  details are saved.
                </p>
              )}
            </div>
          </div>
        ) : null}

        {stepIndex === 2 ? (
          <TrackMetadataEditor
            value={metadata}
            onChange={setMetadata}
            artists={artistOptions}
            errors={metadataErrors}
            disabled={isSaving}
          />
        ) : null}

        {stepIndex === 3 ? (
          <div className="space-y-4">
            <div className="border-b border-border pb-6">
              <p className="text-lg font-semibold text-foreground">
                Draft recording
              </p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 [&>div]:min-w-0 [&_p]:break-words">
                <div>
                  <p className="text-muted-foreground">Title</p>
                  <p className="mt-1 text-foreground">{title || "Not set"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Artist</p>
                  <p className="mt-1 text-foreground">
                    {artistName || "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Genre</p>
                  <p className="mt-1 text-foreground">{genre || "Not set"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Audio</p>
                  <p className="mt-1 text-foreground">
                    {audioFile?.name || "Not selected"}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm text-foreground">
              <p>ISRC: {metadata.isrc.trim() || "Not provided"}</p>
              <p>
                Record label: {metadata.recordLabel.trim() || "Not provided"}
              </p>
              {metadata.credits.length ? (
                <ul className="mt-2 space-y-1 break-words">
                  {metadata.credits.map((credit, index) => (
                    <li key={index}>
                      {creditRoleLabels[credit.role]}: {credit.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Credits: Not provided</p>
              )}
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={() => goToStep(2)}
              >
                Edit credits & identifiers
              </Button>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Saving creates a draft recording only. Add it to a Single, EP, or
              album from the release workspace.
            </p>
          </div>
        ) : null}

        {isSaving ? (
          <div
            role="status"
            className="space-y-2 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{uploadStage ?? "Saving..."}</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
            <p className="break-words text-xs text-muted-foreground">
              {audioFile?.name}
            </p>
          </div>
        ) : null}

        {uploadError ? (
          <p role="alert" className="text-sm text-destructive">
            {uploadError}. Your details are still here. Try saving again.
          </p>
        ) : null}
        <ActionBar>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setStepIndex((current) => Math.max(0, current - 1))
              }
              disabled={stepIndex === 0 || isSaving}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {onClose ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
            ) : null}
          </div>
          {stepIndex < steps.length - 1 ? (
            <Button
              type="button"
              onClick={() => goToStep(stepIndex + 1)}
              disabled={isSaving}
            >
              {stepIndex === 2 ? "Continue" : "Next"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => void createTrack()}
            >
              {isSaving ? "Saving..." : "Save track draft"}
            </Button>
          )}
        </ActionBar>
      </div>

      <ArtistPaymentReviewDialog
        intent={artistFeeIntent}
        isPaying={isPayingArtistFee}
        onCancel={() => setArtistFeeIntent(null)}
        onConfirm={() => void confirmArtistFeePayment()}
      />
    </>
  );
};
