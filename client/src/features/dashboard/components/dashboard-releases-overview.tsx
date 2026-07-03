"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import type { ReleaseCreateInput, ReleaseDetail, ReleaseSummary } from "@music-city/shared";
import { Plus } from "lucide-react";
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

export const DashboardReleasesOverview = () => {
  const { session } = useAuth();
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [form, setForm] = useState<ReleaseCreateInput>(initialForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);

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

  const handleCreated = (release: ReleaseDetail) => {
    setReleases((current) => [release, ...current.filter((item) => item.id !== release.id)]);
    setIsCreateOpen(false);
    setForm({
      ...initialForm,
      artistName: session?.displayName ?? "",
    });
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
      let release = await releasesApi.createRelease(token, {
        ...form,
        artistName: form.artistName?.trim() || undefined,
        releaseDate: form.releaseDate?.trim() || undefined,
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

      handleCreated(release);
      toast.success("Release created.");
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
                <div className="space-y-2">
                  <label className="text-sm text-slate-300">Release date</label>
                  <Input
                    type="date"
                    value={form.releaseDate ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        releaseDate: event.target.value,
                      }))
                    }
                    className="border-white/10 bg-slate-950 text-white"
                  />
                </div>
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
                  {isCreating ? "Creating..." : "Create release"}
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
          <ReleaseGrid
            releases={releases}
            hrefBuilder={(release) => `/dashboard/releases/${release.id}`}
          />
        )}
      </div>
    </div>
  );
};
