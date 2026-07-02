"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { toast } from "sonner";

import type { ArtistSummary, ReleaseSummary, TrackAccess } from "@music-city/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { releasesApi } from "@/features/music/lib/releases-api";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { uploadsApi } from "@/features/uploads/lib/uploads-api";
import { usersApi } from "@/features/users/lib/users-api";
import { useAuth } from "@/hooks/use-auth";

type EditableTrackAccess = Extract<
  TrackAccess,
  "private" | "purchase_required" | "public"
>;

type ReleasePlacement = "standalone" | "existing" | "new";

interface TrackCreateFormProps {
  onCreated: () => void;
  onClose?: () => void;
}

const steps = [
  {
    id: "basics",
    label: "Basics",
    description: "Title, artist identity, and release framing.",
  },
  {
    id: "credits",
    label: "Credits",
    description: "Collaborators, label, publishing, and rights data.",
  },
  {
    id: "media",
    label: "Media",
    description: "Cover art and audio upload.",
  },
] as const;

const isEmailLike = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

export const TrackCreateForm = ({
  onCreated,
  onClose,
}: TrackCreateFormProps) => {
  const router = useRouter();
  const { session } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [artistOptions, setArtistOptions] = useState<ArtistSummary[]>([]);
  const [releaseOptions, setReleaseOptions] = useState<ReleaseSummary[]>([]);
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState(session?.displayName ?? "");
  const [genre, setGenre] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [access, setAccess] = useState<EditableTrackAccess>("private");
  const [purchasePrice, setPurchasePrice] = useState("5");
  const [composer, setComposer] = useState("");
  const [producer, setProducer] = useState("");
  const [isrc, setIsrc] = useState("");
  const [recordLabel, setRecordLabel] = useState("");
  const [publisher, setPublisher] = useState("");
  const [featuredSearch, setFeaturedSearch] = useState("");
  const [featuredArtists, setFeaturedArtists] = useState<string[]>([]);
  const [releasePlacement, setReleasePlacement] =
    useState<ReleasePlacement>("standalone");
  const [selectedReleaseId, setSelectedReleaseId] = useState("");
  const [newReleaseTitle, setNewReleaseTitle] = useState("");
  const [newReleaseType, setNewReleaseType] =
    useState<ReleaseSummary["type"]>("single");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<string | null>(null);

  const deferredFeaturedSearch = useDeferredValue(featuredSearch.trim().toLowerCase());
  const progressValue = ((stepIndex + 1) / steps.length) * 100;

  useEffect(() => {
    if (session?.displayName) {
      setArtistName((current) => current || session.displayName);
    }
  }, [session?.displayName]);

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

    const loadReleases = async () => {
      if (!session?.token) {
        return;
      }

      try {
        const items = await releasesApi.listMyReleases(session.token);

        if (!cancelled) {
          setReleaseOptions(items);
        }
      } catch {
        if (!cancelled) {
          setReleaseOptions([]);
        }
      }
    };

    void loadReleases();

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  const artistSuggestions = deferredFeaturedSearch
    ? artistOptions.filter((artist) => {
        const query = deferredFeaturedSearch;
        const alreadySelected = featuredArtists.some(
          (entry) => entry.toLowerCase() === artist.name.toLowerCase(),
        );

        if (alreadySelected) {
          return false;
        }

        return (
          artist.name.toLowerCase().includes(query) ||
          artist.walletAddress.toLowerCase().includes(query)
        );
      })
    : [];

  const addFeaturedArtist = (value: string) => {
    const nextValue = value.trim();

    if (!nextValue) {
      return;
    }

    const exists = featuredArtists.some(
      (entry) => entry.toLowerCase() === nextValue.toLowerCase(),
    );

    if (exists) {
      setFeaturedSearch("");
      return;
    }

    setFeaturedArtists((current) => [...current, nextValue]);
    setFeaturedSearch("");
  };

  const removeFeaturedArtist = (value: string) => {
    setFeaturedArtists((current) => current.filter((entry) => entry !== value));
  };

  const canLeaveBasicsStep = () => {
    if (stepIndex === 0) {
      if (!title.trim() || !artistName.trim() || !genre.trim()) {
        toast.error("Add the track title, artist name, and genre first.");
        return false;
      }

      if (access === "purchase_required" && !purchasePrice.trim()) {
        toast.error("Add a purchase price before continuing.");
        return false;
      }

      if (releasePlacement === "existing" && !selectedReleaseId) {
        toast.error("Choose the existing release for this track.");
        return false;
      }

      if (releasePlacement === "new" && !newReleaseTitle.trim()) {
        toast.error("Add a title for the new release first.");
        return false;
      }
    }

    return true;
  };

  const goToStep = (nextStepIndex: number) => {
    if (nextStepIndex < 0 || nextStepIndex > steps.length - 1) {
      return;
    }

    if (nextStepIndex > stepIndex && !canLeaveBasicsStep()) {
      return;
    }

    setStepIndex(nextStepIndex);
  };

  const goNext = () => {
    if (stepIndex < steps.length - 1) {
      goToStep(stepIndex + 1);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setStepIndex((current) => current - 1);
    }
  };

  const resetForm = () => {
    setStepIndex(0);
    setTitle("");
    setArtistName(session?.displayName ?? "");
    setGenre("");
    setCountry("");
    setDescription("");
    setAccess("private");
    setPurchasePrice("5");
    setComposer("");
    setProducer("");
    setIsrc("");
    setRecordLabel("");
    setPublisher("");
    setFeaturedSearch("");
    setFeaturedArtists([]);
    setReleasePlacement("standalone");
    setSelectedReleaseId("");
    setNewReleaseTitle("");
    setNewReleaseType("single");
    setAudioFile(null);
    setCoverFile(null);
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

    toast.error("Enter a valid collaborator email or choose an artist.");
  };

  const createTrack = async () => {
    if (!session?.token) {
      toast.error("Connect your wallet first");
      router.push("/auth");
      return;
    }

    if (stepIndex < steps.length - 1) {
      goNext();
      return;
    }

    if (!audioFile) {
      toast.error("Choose an audio file before creating the track.");
      return;
    }

    setIsSaving(true);
    setUploadProgress(0);
    setUploadStage("Creating track...");

    try {
      const track = await tracksApi.createTrack(session.token, {
        title,
        artistName,
        featuredArtists,
        composer,
        producer,
        isrc,
        recordLabel,
        publisher,
        country,
        genre,
        description,
        priceLabel: access === "purchase_required" ? purchasePrice : "Private",
        access,
        purchaseEnabled: access === "purchase_required",
        purchasePrice: access === "purchase_required" ? purchasePrice : undefined,
      });

      let releaseId = selectedReleaseId;

      if (releasePlacement === "new") {
        setUploadStage("Creating release...");
        const release = await releasesApi.createRelease(session.token, {
          title: newReleaseTitle,
          type: newReleaseType,
          genre,
          description,
          artistName,
        });
        releaseId = release.id;
      }

      if (releasePlacement !== "standalone" && releaseId) {
        setUploadStage("Adding track to release...");
        await releasesApi.addTrackToRelease(session.token, releaseId, {
          trackId: track.id,
          discNumber: 1,
          isFocusTrack: false,
        });
      }

      if (coverFile) {
        setUploadStage("Uploading cover...");
        const coverUploadSession = await uploadsApi.createSession(session.token, {
          trackId: track.id,
          purpose: "cover",
          fileName: coverFile.name,
          contentType: coverFile.type || "application/octet-stream",
          sizeBytes: coverFile.size,
        });
        const coverETag = await uploadsApi.uploadFile(
          session.token,
          coverUploadSession,
          coverFile,
          setUploadProgress,
        );
        await uploadsApi.completeSession(session.token, coverUploadSession.id, {
          uploadSessionId: coverUploadSession.id,
          eTag: coverETag,
        });
      }

      if (audioFile) {
        setUploadStage("Preparing upload...");
        const uploadSession = await uploadsApi.createSession(session.token, {
          trackId: track.id,
          purpose: "audio",
          fileName: audioFile.name,
          contentType: audioFile.type || "application/octet-stream",
          sizeBytes: audioFile.size,
        });
        setUploadStage("Uploading audio...");
        const eTag = await uploadsApi.uploadFile(
          session.token,
          uploadSession,
          audioFile,
          setUploadProgress,
        );
        setUploadStage("Finalizing upload...");
        await uploadsApi.completeSession(session.token, uploadSession.id, {
          uploadSessionId: uploadSession.id,
          eTag,
        });
        setUploadProgress(100);
        setUploadStage("Upload complete");
      }

      resetForm();
      onCreated();
      onClose?.();
      toast.success(audioFile ? "Track uploaded" : "Track draft created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Track upload failed");
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStage(null);
      }, 1200);
    }
  };

  return (
    <div
      className="space-y-8 rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-7"
      onKeyDown={(event) => {
        if (
          event.key !== "Enter" ||
          stepIndex >= steps.length - 1 ||
          event.shiftKey ||
          event.currentTarget !== event.target &&
            (event.target as HTMLElement).tagName === "TEXTAREA"
        ) {
          return;
        }

        const target = event.target as HTMLElement;

        if (target.id === "featuredArtists") {
          return;
        }

        event.preventDefault();
        goNext();
      }}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.28em] text-emerald-400">
              Upload wizard
            </p>
            <h4 className="text-2xl font-semibold text-white">
              {steps[stepIndex].label}
            </h4>
            <p className="text-sm text-slate-400">{steps[stepIndex].description}</p>
          </div>
          <div className="text-sm text-slate-400">
            Step {stepIndex + 1} of {steps.length}
          </div>
        </div>
        <Progress
          value={progressValue}
          className="h-2 bg-white/10 [&>div]:bg-emerald-400"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              className={`rounded-2xl border px-4 py-3 text-sm ${
                index === stepIndex
                  ? "border-emerald-400/40 bg-emerald-400/10 text-white"
                  : index < stepIndex
                    ? "border-white/10 bg-white/[0.03] text-slate-300"
                    : "border-white/10 bg-transparent text-slate-500"
              }`}
              onClick={() => goToStep(index)}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    index <= stepIndex
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-white/10 text-slate-400"
                  }`}
                >
                  {index < stepIndex ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span>{step.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {stepIndex === 0 ? (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="trackTitle">Track title</Label>
            <Input
              id="trackTitle"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              className="border-white/10 bg-slate-950/70 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trackArtistName">Artist name</Label>
            <Input
              id="trackArtistName"
              value={artistName}
              onChange={(event) => setArtistName(event.target.value)}
              required
              className="border-white/10 bg-slate-950/70 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trackGenre">Genre</Label>
            <Input
              id="trackGenre"
              value={genre}
              onChange={(event) => setGenre(event.target.value)}
              required
              className="border-white/10 bg-slate-950/70 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trackCountry">Country</Label>
            <Input
              id="trackCountry"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              placeholder="South Africa"
              className="border-white/10 bg-slate-950/70 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trackAccess">Release access</Label>
            <select
              id="trackAccess"
              value={access}
              onChange={(event) => setAccess(event.target.value as EditableTrackAccess)}
              className="h-10 rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm text-white"
            >
              <option value="private">Private</option>
              <option value="purchase_required">One-time purchase</option>
              <option value="public">Public</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="releasePlacement">Release placement</Label>
            <select
              id="releasePlacement"
              value={releasePlacement}
              onChange={(event) =>
                setReleasePlacement(event.target.value as ReleasePlacement)
              }
              className="h-10 rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm text-white"
            >
              <option value="standalone">Standalone track</option>
              <option value="existing">Add to existing release</option>
              <option value="new">Create new release</option>
            </select>
          </div>
          {access === "purchase_required" ? (
            <div className="space-y-2">
              <Label htmlFor="trackPurchasePrice">Purchase price (XLM)</Label>
              <Input
                id="trackPurchasePrice"
                value={purchasePrice}
                onChange={(event) => setPurchasePrice(event.target.value)}
                className="border-white/10 bg-slate-950/70 text-white"
              />
            </div>
          ) : null}
          {releasePlacement === "existing" ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="selectedReleaseId">Choose release</Label>
              <select
                id="selectedReleaseId"
                value={selectedReleaseId}
                onChange={(event) => setSelectedReleaseId(event.target.value)}
                className="h-10 rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm text-white"
              >
                <option value="">Select a release</option>
                {releaseOptions.map((release) => (
                  <option key={release.id} value={release.id}>
                    {release.title} ({release.type})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {releasePlacement === "new" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="newReleaseTitle">New release title</Label>
                <Input
                  id="newReleaseTitle"
                  value={newReleaseTitle}
                  onChange={(event) => setNewReleaseTitle(event.target.value)}
                  className="border-white/10 bg-slate-950/70 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newReleaseType">New release type</Label>
                <select
                  id="newReleaseType"
                  value={newReleaseType}
                  onChange={(event) =>
                    setNewReleaseType(event.target.value as ReleaseSummary["type"])
                  }
                  className="h-10 rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm text-white"
                >
                  <option value="single">Single</option>
                  <option value="ep">EP</option>
                  <option value="album">Album</option>
                </select>
              </div>
            </>
          ) : null}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="trackDescription">Description</Label>
            <Textarea
              id="trackDescription"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-28 border-white/10 bg-slate-950/70 text-white"
            />
          </div>
        </div>
      ) : null}

      {stepIndex === 1 ? (
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trackComposer">Composer</Label>
              <Input
                id="trackComposer"
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                className="border-white/10 bg-slate-950/70 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackProducer">Producer</Label>
              <Input
                id="trackProducer"
                value={producer}
                onChange={(event) => setProducer(event.target.value)}
                className="border-white/10 bg-slate-950/70 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackIsrc">ISRC</Label>
              <Input
                id="trackIsrc"
                value={isrc}
                onChange={(event) => setIsrc(event.target.value)}
                className="border-white/10 bg-slate-950/70 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackRecordLabel">Record label</Label>
              <Input
                id="trackRecordLabel"
                value={recordLabel}
                onChange={(event) => setRecordLabel(event.target.value)}
                className="border-white/10 bg-slate-950/70 text-white"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="trackPublisher">Publisher</Label>
              <Input
                id="trackPublisher"
                value={publisher}
                onChange={(event) => setPublisher(event.target.value)}
                className="border-white/10 bg-slate-950/70 text-white"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="featuredArtists">Featured artists</Label>
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex flex-wrap gap-2">
                {featuredArtists.map((entry) => (
                  <div
                    key={entry}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white"
                  >
                    <span>{entry}</span>
                    <button
                      type="button"
                      className="text-slate-400 transition hover:text-white"
                      onClick={() => removeFeaturedArtist(entry)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="featuredArtists"
                    value={featuredSearch}
                    onChange={(event) => setFeaturedSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") {
                        return;
                      }

                      event.preventDefault();
                      submitFeaturedSearch();
                    }}
                    placeholder="Search artists or enter collaborator email"
                    className="border-white/10 bg-[#0b1020] pl-10 text-white"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={submitFeaturedSearch}
                >
                  Add email
                </Button>
              </div>

              {featuredSearch ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b1020]">
                  {artistSuggestions.length > 0 ? (
                    artistSuggestions.slice(0, 5).map((artist) => (
                      <button
                        key={artist.id}
                        type="button"
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/[0.04]"
                        onClick={() => addFeaturedArtist(artist.name)}
                      >
                        <span>{artist.name}</span>
                        <span className="text-xs text-slate-500">
                          {artist.walletAddress.slice(0, 6)}...
                          {artist.walletAddress.slice(-4)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-500">
                      {isLoadingArtists
                        ? "Loading artists..."
                        : "No matching artist found. Use an email instead."}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {stepIndex === 2 ? (
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trackCover">Song banner / cover</Label>
              <Input
                id="trackCover"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
                className="border-white/10 bg-slate-950/70 text-white file:text-white"
              />
              <p className="text-sm text-slate-500">
                Upload the artwork shown across shelves and the player.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackFile">Audio file</Label>
              <Input
                id="trackFile"
                type="file"
                accept="audio/*"
                onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
                className="border-white/10 bg-slate-950/70 text-white file:text-white"
              />
              <p className="text-sm text-slate-500">
                High quality master audio. Mux will process playback versions after upload.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isSaving && (audioFile || coverFile) ? (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>{uploadStage ?? "Uploading..."}</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress
            value={uploadProgress}
            className="h-2 bg-white/10 [&>div]:bg-emerald-400"
          />
          <p className="text-xs text-slate-400">
            {audioFile?.name ?? coverFile?.name}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={goBack}
            disabled={stepIndex === 0 || isSaving}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {onClose ? (
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"
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
            className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              goNext();
            }}
            disabled={isSaving}
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            disabled={isSaving}
            onClick={() => void createTrack()}
          >
            {isSaving ? "Uploading..." : "Create track"}
          </Button>
        )}
      </div>

    </div>
  );
};
