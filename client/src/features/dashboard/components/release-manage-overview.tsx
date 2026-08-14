"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { ReleaseDetail, TrackSummary } from "@music-city/shared";
import { AlertTriangle, ArrowLeft, GripVertical, TimerReset, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { releasesApi } from "@/features/music/lib/releases-api";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { uploadsApi } from "@/features/uploads/lib/uploads-api";
import { useAuth } from "@/hooks/use-auth";

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

export const ReleaseManageOverview = ({ releaseId }: { releaseId: string }) => {
  const router = useRouter();
  const { session } = useAuth();
  const [release, setRelease] = useState<ReleaseDetail | null>(null);
  const [myTracks, setMyTracks] = useState<TrackSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [launchMode, setLaunchMode] = useState<"draft" | "published" | "scheduled">("draft");
  const [releaseDateInput, setReleaseDateInput] = useState("");

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

    try {
      setIsSaving(true);
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
        setRelease(completed.release);
      } else {
        const refreshed = await releasesApi.getManageRelease(token, release.id);
        setRelease(refreshed);
      }

      setCoverFile(null);
      setCoverUploadProgress(0);
      toast.success("Release cover updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload cover");
    } finally {
      setIsSaving(false);
    }
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

    const confirmed = window.confirm(
      `Delete "${release.title}"? This removes the release page and detaches its tracks, but it will not delete the tracks themselves.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      await releasesApi.deleteRelease(token, release.id);
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
              disabled={isSaving || launchMode !== "scheduled" || !releaseDateInput.trim()}
              onClick={() => void updateStatus("scheduled")}
            >
              <TimerReset className="mr-2 h-4 w-4" />
              Schedule release
            </Button>
            <Button
              type="button"
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              disabled={isSaving}
              onClick={() => void updateStatus("published")}
            >
              Release now
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Title</label>
            <Input
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
              value={release.artistName}
              onChange={(event) =>
                setRelease({ ...release, artistName: event.target.value })
              }
              className="border-white/10 bg-slate-950 text-white"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Genre</label>
            <Input
              value={release.genre}
              onChange={(event) =>
                setRelease({ ...release, genre: event.target.value })
              }
              className="border-white/10 bg-slate-950 text-white"
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
                  description: "Publish later and show fans a countdown page first.",
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
              type="file"
              accept="image/*"
              onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
              className="border-white/10 bg-slate-950 text-white file:text-white"
            />
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

      <section className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-rose-300">
              Danger zone
            </p>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-300" />
              <h3 className="text-xl font-semibold text-white">Delete this release</h3>
            </div>
            <p className="text-sm text-rose-100/80">
              Removes the release page and detaches its tracks. Tracks stay in your library.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
            disabled={isDeleting || isSaving}
            onClick={() => void deleteRelease()}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? "Deleting..." : "Delete release"}
          </Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Tracklist</h3>
              <p className="text-xs text-slate-500">Reorder tracks and choose a focus track.</p>
            </div>
            <Button
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              disabled={isSaving || release.tracks.length === 0}
              onClick={() => void saveTrackOrder()}
            >
              Save order
            </Button>
          </div>

          <div className="space-y-4">
            {release.tracks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-6 text-sm text-slate-400">
                No tracks assigned yet.
              </div>
            ) : (
              release.tracks.map((item) => (
                <div
                  key={item.trackId}
                  className="grid gap-4 rounded-xl border border-white/10 bg-slate-950/50 p-3 lg:grid-cols-[minmax(0,1fr)_100px_100px_100px_40px]"
                >
                  <div className="flex items-start gap-3">
                    <GripVertical className="mt-1 h-4 w-4 text-slate-500" />
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">
                        {item.track.title}
                      </p>
                      <p className="truncate text-sm text-slate-400">
                        {item.track.runtime} · {item.track.status}
                      </p>
                    </div>
                  </div>
                  <Input
                    value={String(item.trackNumber)}
                    onChange={(event) =>
                      updateTrackOrder(item.trackId, {
                        trackNumber: Number(event.target.value) || 1,
                      })
                    }
                    className="border-white/10 bg-slate-950 text-white"
                  />
                  <Input
                    value={String(item.discNumber)}
                    onChange={(event) =>
                      updateTrackOrder(item.trackId, {
                        discNumber: Number(event.target.value) || 1,
                      })
                    }
                    className="border-white/10 bg-slate-950 text-white"
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={item.isFocusTrack}
                      onChange={(event) =>
                        updateTrackOrder(item.trackId, {
                          isFocusTrack: event.target.checked,
                        })
                      }
                    />
                    Focus
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="border border-white/10 text-red-200 hover:bg-red-500/10 hover:text-red-100"
                    onClick={() => void removeTrack(item.trackId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
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
          </div>
        </aside>
      </div>
    </div>
  );
};
