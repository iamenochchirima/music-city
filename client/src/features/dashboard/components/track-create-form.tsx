"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { toast } from "sonner";

import type { ArtistSummary, PaymentIntentRecord } from "@music-city/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface TrackCreateFormProps {
  onCreated: () => void;
  onClose?: () => void;
}

const steps = [
  { id: "basics", label: "Track details", description: "Name the recording and identify the artists." },
  { id: "media", label: "Audio", description: "Upload the master audio file." },
  { id: "review", label: "Save", description: "Review the recording before saving it as a draft." },
] as const;

const isEmailLike = (value: string) => /\S+@\S+\.\S+/.test(value.trim());
const MAX_AUDIO_SIZE_BYTES = 500 * 1024 * 1024;
const TRACK_DRAFT_STORAGE_VERSION = 1;

type StoredTrackDraft = {
  version: number;
  savedAt: number;
  stepIndex: number;
  title: string;
  artistName: string;
  genre: string;
  isExplicit: boolean;
  featuredArtists: string[];
};

export const TrackCreateForm = ({ onCreated, onClose }: TrackCreateFormProps) => {
  const router = useRouter();
  const { session } = useAuth();
  const {
    complete: completeArtistFeePayment,
    isPaying: isPayingArtistFee,
    prepare: prepareArtistFeePayment,
  } = useArtistOnboardingPayment();

  const [stepIndex, setStepIndex] = useState(0);
  const [artistOptions, setArtistOptions] = useState<ArtistSummary[]>([]);
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState(session?.displayName ?? "");
  const [genre, setGenre] = useState("");
  const [isExplicit, setIsExplicit] = useState(false);
  const [featuredSearch, setFeaturedSearch] = useState("");
  const [featuredArtists, setFeaturedArtists] = useState<string[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [createdTrackId, setCreatedTrackId] = useState<string | null>(null);
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

  const deferredFeaturedSearch = useDeferredValue(featuredSearch.trim().toLowerCase());
  const progressValue = ((stepIndex + 1) / steps.length) * 100;

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

      const draft = JSON.parse(rawDraft) as Partial<StoredTrackDraft>;
      const isCurrent =
        draft.version === TRACK_DRAFT_STORAGE_VERSION &&
        typeof draft.savedAt === "number" &&
        Date.now() - draft.savedAt < 7 * 24 * 60 * 60 * 1000;

      if (!isCurrent) {
        window.localStorage.removeItem(draftStorageKey);
        setDraftHydrated(true);
        return;
      }

      setStepIndex(Math.min(Math.max(draft.stepIndex ?? 0, 0), steps.length - 1));
      setTitle(typeof draft.title === "string" ? draft.title : "");
      setArtistName(
        typeof draft.artistName === "string"
          ? draft.artistName
          : session?.displayName ?? "",
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
    if (!draftStorageKey || !draftHydrated || typeof window === "undefined" || createdTrackId) {
      return;
    }

    const draft: StoredTrackDraft = {
      version: TRACK_DRAFT_STORAGE_VERSION,
      savedAt: Date.now(),
      stepIndex,
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

  const canLeaveBasicsStep = () => {
    if (stepIndex !== 0) {
      return true;
    }

    if (!title.trim() || !artistName.trim() || !genre.trim()) {
      toast.error("Add the track title, artist name, and genre first.");
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

    setStepIndex(nextStepIndex);
  };

  const resetForm = () => {
    if (draftStorageKey && typeof window !== "undefined") {
      window.localStorage.removeItem(draftStorageKey);
    }

    setStepIndex(0);
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
      toast.error("Audio files must be 500 MB or smaller.");
      return;
    }

    if (file.type && !file.type.startsWith("audio/")) {
      toast.error("Choose an audio file such as MP3, WAV, M4A, or FLAC.");
      return;
    }

    setAudioFile(file);
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
      toast.error("Choose an audio file before saving the track.");
      return;
    }

    let createdTrackIdDuringUpload: string | null = null;
    let uploadSessionId: string | null = null;
    setIsSaving(true);
    setUploadProgress(0);
    setUploadStage("Saving track draft...");

    try {
      const track = await tracksApi.createTrack(session.token, {
        title: title.trim(),
        artistName: artistName.trim(),
        featuredArtists,
        genre,
        isExplicit,
      });
      createdTrackIdDuringUpload = track.id;

      setUploadStage("Preparing audio upload...");
      const uploadSession = await uploadsApi.createSession(session.token, {
        trackId: track.id,
        purpose: "audio",
        fileName: audioFile.name,
        contentType: audioFile.type || "application/octet-stream",
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
      await uploadsApi.completeSession(session.token, uploadSession.id, {
        uploadSessionId: uploadSession.id,
        eTag,
      });

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
      if (uploadSessionId) {
        await uploadsApi.cancelSession(session.token, uploadSessionId).catch(() => undefined);
      }

      if (createdTrackIdDuringUpload) {
        await tracksApi.deleteTrack(session.token, createdTrackIdDuringUpload).catch(() => undefined);
      }

      if (error instanceof ApiClientError && error.status === 402) {
        try {
          setArtistFeeIntent(await prepareArtistFeePayment());
        } catch (paymentError) {
          toast.error(
            paymentError instanceof Error
              ? paymentError.message
              : "Unable to prepare the artist upload payment.",
          );
        }
      } else {
        toast.error(error instanceof Error ? error.message : "Track upload failed");
      }
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        if (!createdTrackId) {
          setUploadProgress(0);
          setUploadStage(null);
        }
      }, 1200);
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
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
            Track saved
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            {createdTrackTitle} is ready for a release.
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            The recording is saved as a draft. A release is what listeners will see,
            so add this track to a Single, EP, or album when you are ready.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="bg-emerald-400 text-slate-950 hover:bg-emerald-300">
              <Link href="/dashboard/releases">Add to a release</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
              <Link href={`/dashboard/tracks/${createdTrackId}`}>Keep as draft</Link>
            </Button>
            <Button type="button" variant="ghost" className="text-slate-300 hover:bg-white/5 hover:text-white" onClick={resetForm}>
              Upload another
            </Button>
          </div>
        </div>
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
        className="space-y-6 rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"
        onKeyDown={(event) => {
          if (event.key !== "Enter" || stepIndex >= steps.length - 1 || event.shiftKey) {
            return;
          }

          if ((event.target as HTMLElement).tagName === "TEXTAREA") {
            return;
          }

          event.preventDefault();
          goToStep(stepIndex + 1);
        }}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">
                Upload a track
              </p>
              <h4 className="mt-1 text-xl font-semibold text-white">
                {steps[stepIndex].label}
              </h4>
              <p className="mt-1 text-sm text-slate-400">{steps[stepIndex].description}</p>
            </div>
            <p className="text-xs text-slate-500">
              Step {stepIndex + 1} of {steps.length}
            </p>
          </div>

          <Progress value={progressValue} className="h-2 bg-white/10 [&>div]:bg-emerald-400" />

          <div className="grid gap-2 md:grid-cols-3">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  index === stepIndex
                    ? "border-emerald-400/40 bg-emerald-400/10 text-white"
                    : index < stepIndex
                      ? "border-white/10 bg-white/[0.03] text-slate-300"
                      : "border-white/10 bg-transparent text-slate-500"
                }`}
                onClick={() => goToStep(index)}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      index <= stepIndex
                        ? "bg-emerald-400 text-slate-950"
                        : "bg-white/10 text-slate-400"
                    }`}
                  >
                    {index < stepIndex ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  {step.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {stepIndex === 0 ? (
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trackTitle">Track title</Label>
                <Input id="trackTitle" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Your song title" required className="border-white/10 bg-slate-950/70 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trackArtistName">Artist name</Label>
                <Input id="trackArtistName" value={artistName} onChange={(event) => setArtistName(event.target.value)} placeholder="Your artist name" required className="border-white/10 bg-slate-950/70 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trackGenre">Primary genre</Label>
                <SearchablePicker id="trackGenre" value={genre} onValueChange={setGenre} options={musicGenres} placeholder="Select a genre" searchPlaceholder="Search genres" required />
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
                <input type="checkbox" checked={isExplicit} onChange={(event) => setIsExplicit(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-400" />
                <span>
                  <span className="block font-medium text-white">Explicit content</span>
                  <span className="mt-1 block text-xs text-slate-500">Mark this recording if it contains explicit lyrics or themes.</span>
                </span>
              </label>
            </div>

            <div className="space-y-2">
              <div>
                <Label htmlFor="featuredArtists">Featured artists</Label>
                <p className="mt-1 text-xs text-slate-500">Optional. Add collaborators who should appear on the track.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                {featuredArtists.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {featuredArtists.map((entry) => (
                      <span key={entry} className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-sm text-white">
                        {entry}
                        <button type="button" className="text-slate-400 hover:text-white" onClick={() => removeFeaturedArtist(entry)} aria-label={`Remove ${entry}`}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input id="featuredArtists" value={featuredSearch} onChange={(event) => setFeaturedSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitFeaturedSearch(); } }} placeholder="Search an artist or enter collaborator email" className="border-white/10 bg-[#0b1020] pl-10 text-white" />
                  </div>
                  <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={submitFeaturedSearch}>Add</Button>
                </div>
                {featuredSearch ? (
                  <div className="mt-2 rounded-lg border border-white/10 bg-[#0b1020]">
                    {artistSuggestions.length > 0 ? artistSuggestions.slice(0, 5).map((artist) => (
                      <button key={artist.id} type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/[0.04]" onClick={() => addFeaturedArtist(artist.name)}>
                        <span>{artist.name}</span>
                        <span className="text-xs text-slate-500">{artist.walletAddress.slice(0, 6)}...{artist.walletAddress.slice(-4)}</span>
                      </button>
                    )) : <p className="px-3 py-2 text-xs text-slate-500">{isLoadingArtists ? "Loading artists..." : "No match. You can add an email instead."}</p>}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {stepIndex === 1 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/45 p-5">
              <Label htmlFor="trackFile">Master audio file</Label>
              <p className="mt-1 text-sm text-slate-400">Upload the recording you want to place on a release.</p>
              <Input id="trackFile" type="file" accept="audio/*,.mp3,.wav,.m4a,.flac" onChange={(event) => handleAudioFileChange(event.target.files?.[0])} className="mt-4 border-white/10 bg-slate-950/70 text-white file:text-white" />
              <p className="mt-2 text-xs text-slate-500">MP3, WAV, M4A, or FLAC · up to 500 MB. Playback will be available after processing.</p>
              {audioFile ? <p className="mt-3 text-sm text-emerald-200">Selected: {audioFile.name}</p> : null}
            </div>
          </div>
        ) : null}

        {stepIndex === 2 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Draft recording</p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-slate-500">Title</p><p className="mt-1 text-white">{title || "Not set"}</p></div>
                <div><p className="text-slate-500">Artist</p><p className="mt-1 text-white">{artistName || "Not set"}</p></div>
                <div><p className="text-slate-500">Genre</p><p className="mt-1 text-white">{genre || "Not set"}</p></div>
                <div><p className="text-slate-500">Audio</p><p className="mt-1 text-white">{audioFile?.name || "Not selected"}</p></div>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-400">Saving creates a draft recording only. Add it to a Single, EP, or album from the release workspace.</p>
          </div>
        ) : null}

        {isSaving ? (
          <div className="space-y-2 rounded-xl border border-white/10 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between text-sm text-slate-300"><span>{uploadStage ?? "Saving..."}</span><span>{uploadProgress}%</span></div>
            <Progress value={uploadProgress} className="h-2 bg-white/10 [&>div]:bg-emerald-400" />
            <p className="text-xs text-slate-400">{audioFile?.name}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => setStepIndex((current) => Math.max(0, current - 1))} disabled={stepIndex === 0 || isSaving}><ChevronLeft className="mr-2 h-4 w-4" />Back</Button>
            {onClose ? <Button type="button" variant="ghost" className="text-slate-300 hover:bg-white/5 hover:text-white" onClick={onClose} disabled={isSaving}>Cancel</Button> : null}
          </div>
          {stepIndex < steps.length - 1 ? (
            <Button type="button" className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={() => goToStep(stepIndex + 1)} disabled={isSaving}>Next<ChevronRight className="ml-2 h-4 w-4" /></Button>
          ) : (
            <Button type="button" className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" disabled={isSaving} onClick={() => void createTrack()}>{isSaving ? "Saving..." : "Save track draft"}</Button>
          )}
        </div>
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
