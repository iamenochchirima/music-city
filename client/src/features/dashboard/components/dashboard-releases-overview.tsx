"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import type { ReleaseCreateInput, ReleaseDetail, ReleaseSummary } from "@music-city/shared";
import { CalendarClock, Eye, Plus, Radio, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReleaseGrid } from "@/features/music/components/release-grid";
import { releasesApi } from "@/features/music/lib/releases-api";
import { uploadsApi } from "@/features/uploads/lib/uploads-api";
import { useAuth } from "@/hooks/use-auth";

const initialForm: ReleaseCreateInput = {
  title: "",
  artistName: "",
  type: "single",
  genre: "",
  description: "",
  releaseDate: "",
};

type ReleaseLaunchMode = "draft" | "now" | "scheduled";

const toIsoString = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const getReleaseBuckets = (releases: ReleaseSummary[]) => ({
  drafts: releases.filter((release) => release.status === "draft").length,
  scheduled: releases.filter((release) => release.status === "scheduled").length,
  live: releases.filter((release) => release.status === "published").length,
});

export const DashboardReleasesOverview = () => {
  const { session } = useAuth();
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [form, setForm] = useState<ReleaseCreateInput>(initialForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [launchMode, setLaunchMode] = useState<ReleaseLaunchMode>("draft");

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

  const updateReleaseStatus = async (
    releaseId: string,
    status: Extract<ReleaseSummary["status"], "draft" | "published">,
  ) => {
    const token = session?.token;

    if (!token) {
      return;
    }

    try {
      const updated = await releasesApi.updateRelease(token, releaseId, { status });
      setReleases((current) =>
        current.map((release) => (release.id === updated.id ? updated : release)),
      );
      toast.success(status === "published" ? "Release published." : "Release unpublished.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update release");
    }
  };

  const handleCreated = (release: ReleaseDetail) => {
    setReleases((current) => [release, ...current.filter((item) => item.id !== release.id)]);
    setIsCreateOpen(false);
    setForm({
      ...initialForm,
      artistName: session?.displayName ?? "",
    });
    setLaunchMode("draft");
    setCoverFile(null);
    setCoverUploadProgress(0);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const token = session?.token;

    if (!token) {
      return;
    }

    try {
      setIsCreating(true);
      const releaseDate = toIsoString(form.releaseDate?.trim());
      let release = await releasesApi.createRelease(token, {
        ...form,
        artistName: form.artistName?.trim() || undefined,
        releaseDate,
      });

      if (coverFile) {
        const uploadSession = await uploadsApi.createSession(token, {
          releaseId: release.id,
          purpose: "cover",
          fileName: coverFile.name,
          contentType: coverFile.type || "application/octet-stream",
          sizeBytes: coverFile.size,
        });
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

      if (launchMode !== "draft") {
        release = await releasesApi.updateRelease(token, release.id, {
          status: launchMode === "scheduled" ? "scheduled" : "published",
          releaseDate: launchMode === "scheduled" ? releaseDate : undefined,
        });
      }

      handleCreated(release);
      toast.success(
        launchMode === "scheduled"
          ? "Release scheduled."
          : launchMode === "now"
            ? "Release published."
            : "Release created.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create release");
    } finally {
      setIsCreating(false);
    }
  };

  if (!session) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
        Connect your wallet before managing releases.
      </div>
    );
  }

  const releaseBuckets = getReleaseBuckets(releases);
  const featuredScheduled = releases.find((release) => release.status === "scheduled");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Release management</h2>
          <p className="text-sm text-slate-300">
            Create singles, EPs, and albums, then organize the tracks inside them.
          </p>
        </div>
        <Button
          className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New release
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-3 text-amber-200">
            <WandSparkles className="h-5 w-5" />
            <p className="text-sm uppercase tracking-[0.24em]">Drafts</p>
          </div>
          <p className="mt-4 text-3xl font-semibold text-white">{releaseBuckets.drafts}</p>
          <p className="mt-2 text-sm text-slate-400">Still private while you finish setup.</p>
        </div>
        <div className="rounded-3xl border border-sky-400/20 bg-sky-400/5 p-5">
          <div className="flex items-center gap-3 text-sky-200">
            <CalendarClock className="h-5 w-5" />
            <p className="text-sm uppercase tracking-[0.24em]">Scheduled</p>
          </div>
          <p className="mt-4 text-3xl font-semibold text-white">{releaseBuckets.scheduled}</p>
          <p className="mt-2 text-sm text-slate-400">Upcoming drops with public countdowns.</p>
        </div>
        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-5">
          <div className="flex items-center gap-3 text-emerald-200">
            <Radio className="h-5 w-5" />
            <p className="text-sm uppercase tracking-[0.24em]">Live</p>
          </div>
          <p className="mt-4 text-3xl font-semibold text-white">{releaseBuckets.live}</p>
          <p className="mt-2 text-sm text-slate-400">Available to fans right now.</p>
        </div>
      </div>

      {featuredScheduled ? (
        <div className="rounded-[28px] border border-sky-400/20 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(15,23,42,0.7))] p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-sky-200">Next countdown page</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-white">{featuredScheduled.title}</h3>
              <p className="text-sm text-sky-100/80">
                Fans can already see this release and count down to launch.
              </p>
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
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#171a2a] p-6 shadow-2xl sm:p-8">
            <div className="mb-6 space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-400">
                New release
              </p>
              <h3 className="text-3xl font-semibold tracking-tight text-white">
                Create a release
              </h3>
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
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value as ReleaseCreateInput["type"],
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-white"
                  >
                    <option value="single">Single</option>
                    <option value="ep">EP</option>
                    <option value="album">Album</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-300">Genre</label>
                  <Input
                    value={form.genre}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, genre: event.target.value }))
                    }
                    className="border-white/10 bg-slate-950 text-white"
                    required
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm text-slate-300">Release plan</label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      {
                        value: "draft",
                        label: "Save draft",
                        description: "Create the release without making it public yet.",
                      },
                      {
                        value: "now",
                        label: "Release now",
                        description: "Publish immediately after creation.",
                      },
                      {
                        value: "scheduled",
                        label: "Schedule",
                        description: "Make it public with a countdown before launch.",
                      },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`rounded-2xl border p-4 text-left transition ${
                        launchMode === option.value
                          ? "border-emerald-400/40 bg-emerald-400/10"
                          : "border-white/10 bg-slate-950/40 hover:border-white/20 hover:bg-white/[0.05]"
                      }`}
                      onClick={() => setLaunchMode(option.value)}
                    >
                      <p className="text-sm font-semibold text-white">{option.label}</p>
                      <p className="mt-2 text-xs leading-6 text-slate-400">
                        {option.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
              {launchMode === "scheduled" ? (
                <div className="space-y-2">
                  <label className="text-sm text-slate-300">Scheduled release date</label>
                  <Input
                    type="datetime-local"
                    value={form.releaseDate ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        releaseDate: event.target.value,
                      }))
                    }
                    className="border-white/10 bg-slate-950 text-white"
                    required
                  />
                </div>
              ) : null}
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
                  onChange={(event) =>
                    setCoverFile(event.target.files?.[0] ?? null)
                  }
                  className="border-white/10 bg-slate-950 text-white file:text-white"
                />
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
                    setLaunchMode("draft");
                    setCoverFile(null);
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
                  {isCreating
                    ? "Creating..."
                    : launchMode === "scheduled"
                      ? "Schedule release"
                      : launchMode === "now"
                        ? "Create and release"
                        : "Create draft"}
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
            <div className="grid gap-4 xl:grid-cols-2">
              {releases.map((release) => (
                <div
                  key={release.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{release.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">
                        {release.status} · {release.type}
                      </p>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Link href={`/dashboard/releases/${release.id}`}>Open</Link>
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {release.status !== "published" ? (
                      <Button
                        type="button"
                        className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                        onClick={() => void updateReleaseStatus(release.id, "published")}
                      >
                        Release now
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => void updateReleaseStatus(release.id, "draft")}
                      >
                        Unpublish
                      </Button>
                    )}
                    <Button
                      asChild
                      variant="outline"
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Link href={`/releases/${release.id}`}>View fan page</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
