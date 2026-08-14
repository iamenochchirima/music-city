"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import type { ReleaseCreateInput, ReleaseDetail, ReleaseSummary } from "@music-city/shared";
import { CalendarClock, Eye, Plus, Radio, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { Textarea } from "@/components/ui/textarea";
import { musicGenres } from "@/features/music/data/metadata-options";
import { ReleaseGrid } from "@/features/music/components/release-grid";
import { releasesApi } from "@/features/music/lib/releases-api";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
import { uploadsApi } from "@/features/uploads/lib/uploads-api";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";

const initialForm: ReleaseCreateInput = {
  title: "",
  artistName: "",
  type: "single",
  genre: "",
  recordLabel: "",
  description: "",
};
const MAX_COVER_SIZE_BYTES = 10 * 1024 * 1024;

const getReleaseBuckets = (releases: ReleaseSummary[]) => ({
  drafts: releases.filter((release) => release.status === "draft").length,
  scheduled: releases.filter((release) => release.status === "scheduled").length,
  live: releases.filter((release) => release.status === "published").length,
});

export const DashboardReleasesOverview = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [form, setForm] = useState<ReleaseCreateInput>(initialForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

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
    if (!session?.displayName) {
      return;
    }

    setForm((current) => ({
      ...current,
      artistName: current.artistName || session.displayName,
    }));
  }, [session?.displayName]);

  const loadReleases = async () => {
    const token = session?.token;

    if (!token) {
      setReleases([]);
      return;
    }

    if (
      session?.primaryIntent !== "artist" &&
      session?.primaryIntent !== "both"
    ) {
      setReleases([]);
      return;
    }

    setIsLoading(true);

    try {
      setReleases(await releasesApi.listMyReleases(token));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReleases();
  }, [session?.token]);

  const handleCreated = (release: ReleaseDetail) => {
    setReleases((current) => [release, ...current.filter((item) => item.id !== release.id)]);
    setIsCreateOpen(false);
    setForm({
      ...initialForm,
      artistName: session?.displayName ?? "",
    });
    setCoverFile(null);
    setCoverPreviewUrl(null);
    setCoverUploadProgress(0);
    navigate(`/dashboard/releases/${release.id}`);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const token = session?.token;

    if (!token) {
      return;
    }

    let uploadSessionId: string | null = null;

    try {
      setIsCreating(true);
      let release = await releasesApi.createRelease(token, {
        ...form,
        artistName: form.artistName?.trim() || undefined,
      });

      if (coverFile) {
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
          release = completed.release;
        }
      }

      handleCreated(release);
      toast.success("Release draft created.");
    } catch (error) {
      if (uploadSessionId) {
        await uploadsApi.cancelSession(token, uploadSessionId).catch(() => undefined);
      }

      toast.error(error instanceof Error ? error.message : "Unable to create release");
    } finally {
      setIsCreating(false);
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

  if (!session) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
        Connect your wallet before managing releases.
      </div>
    );
  }

  if (session.primaryIntent !== "artist" && session.primaryIntent !== "both") {
    return <ArtistAccessGate action="create or manage releases" />;
  }

  const releaseBuckets = getReleaseBuckets(releases);
  const featuredScheduled = releases.find((release) => release.status === "scheduled");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Release management</h2>
          <p className="mt-1 text-sm text-slate-400">Build and publish your discography.</p>
        </div>
        <Button
          className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New release
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-3 text-amber-200">
            <WandSparkles className="h-5 w-5" />
            <p className="text-xs font-medium uppercase tracking-[0.18em]">Drafts</p>
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{releaseBuckets.drafts}</p>
        </div>
        <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-4">
          <div className="flex items-center gap-3 text-sky-200">
            <CalendarClock className="h-5 w-5" />
            <p className="text-xs font-medium uppercase tracking-[0.18em]">Scheduled</p>
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{releaseBuckets.scheduled}</p>
        </div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
          <div className="flex items-center gap-3 text-emerald-200">
            <Radio className="h-5 w-5" />
            <p className="text-xs font-medium uppercase tracking-[0.18em]">Live</p>
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{releaseBuckets.live}</p>
        </div>
      </div>

      {featuredScheduled ? (
        <div className="rounded-xl border border-sky-400/20 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(15,23,42,0.7))] p-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-200">Upcoming</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold text-white">{featuredScheduled.title}</h3>
              <p className="mt-1 text-sm text-sky-100/80">Countdown page is live.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href={`/releases/${featuredScheduled.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview fan page
                </Link>
              </Button>
              <Button
                asChild
                className="bg-sky-300 text-slate-950 hover:bg-sky-200"
              >
                <Link href={`/dashboard/releases/${featuredScheduled.id}`}>Manage release</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isCreateOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#171a2a] p-5 shadow-2xl sm:p-6">
            <div className="mb-5 space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">
                New release
              </p>
              <h3 className="text-2xl font-semibold tracking-tight text-white">Create a release</h3>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Title</label>
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="border-white/10 bg-slate-950 text-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Artist name</label>
                <Input
                  value={form.artistName ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      artistName: event.target.value,
                    }))
                  }
                  className="border-white/10 bg-slate-950 text-white"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-slate-300">Type</label>
                  <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Release type">
                    {(
                      [
                        ["single", "Single", "1 track"],
                        ["ep", "EP", "2–6 tracks"],
                        ["album", "Album", "7+ tracks"],
                      ] as const
                    ).map(([value, label, detail]) => (
                      <button
                        key={value}
                        type="button"
                        className={`rounded-lg border px-3 py-2 text-left transition ${
                          form.type === value
                            ? "border-emerald-400/50 bg-emerald-400/10 text-white"
                            : "border-white/10 bg-slate-950/60 text-slate-400 hover:border-white/20"
                        }`}
                        onClick={() => setForm((current) => ({ ...current, type: value }))}
                        aria-pressed={form.type === value}
                      >
                        <span className="block text-sm font-medium">{label}</span>
                        <span className="mt-1 block text-xs text-slate-500">{detail}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-300">Genre</label>
                  <SearchablePicker
                    id="new-release-genre"
                    value={form.genre}
                    onValueChange={(genre) =>
                      setForm((current) => ({ ...current, genre }))
                    }
                    options={musicGenres}
                    placeholder="Select a genre"
                    searchPlaceholder="Search genres"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Record label <span className="text-slate-500">(optional)</span></label>
                <Input
                  value={form.recordLabel ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, recordLabel: event.target.value }))
                  }
                  placeholder="Independent or label name"
                  className="border-white/10 bg-slate-950 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Description</label>
                <Textarea
                  value={form.description ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-28 border-white/10 bg-slate-950 text-white"
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm text-slate-300">Cover art</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleCoverFileChange(event.target.files?.[0])}
                  className="border-white/10 bg-slate-950 text-white file:text-white"
                />
                <p className="text-xs text-slate-500">Square JPG, PNG, or WebP · up to 10 MB. This artwork represents the release.</p>
                {coverPreviewUrl ? (
                  <img src={coverPreviewUrl} alt="Selected release artwork preview" className="h-24 w-24 rounded-lg object-cover" />
                ) : null}
                {coverFile ? (
                  <p className="text-xs text-slate-400">
                    {coverFile.name}
                    {coverUploadProgress > 0 && isCreating
                      ? ` · ${coverUploadProgress}%`
                      : ""}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setCoverFile(null);
                    setCoverPreviewUrl(null);
                    setCoverUploadProgress(0);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  disabled={isCreating}
                >
                  {isCreating ? "Creating..." : "Create draft & add tracks"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-white">Your releases</h2>
        </div>

        {isLoading ? (
          <div className="text-sm text-slate-400">Loading your releases...</div>
        ) : (
          <div className="space-y-4">
            <ReleaseGrid
              releases={releases}
              hrefBuilder={(release) => `/dashboard/releases/${release.id}`}
              showArtist={false}
              emptyMessage="You have not created any releases yet."
            />
          </div>
        )}
      </div>
    </div>
  );
};
