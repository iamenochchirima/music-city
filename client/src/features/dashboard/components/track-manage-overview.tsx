"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TrackSummary } from "@music-city/shared";
import { ArrowLeft, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { tracksApi } from "@/features/music/lib/tracks-api";

type EditableTrackAccess = Extract<
  TrackSummary["access"],
  "private" | "public"
>;

const accessOptions: Array<{
  value: EditableTrackAccess;
  label: string;
  description: string;
}> = [
  {
    value: "private",
    label: "Unpublished",
    description: "Keep the song out of discovery while you prepare the release.",
  },
  {
    value: "public",
    label: "Published",
    description: "Make the song visible in discovery and open for listening.",
  },
];

export const TrackManageOverview = ({ trackId }: { trackId: string }) => {
  const router = useRouter();
  const { session } = useAuth();
  const [track, setTrack] = useState<TrackSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadTrack = async () => {
      if (!session?.token) {
        setIsLoading(false);
        return;
      }

      try {
        const nextTrack = await tracksApi.getManageTrack(session.token, trackId);

        if (!cancelled) {
          setTrack(nextTrack);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Unable to load track details",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTrack();

    return () => {
      cancelled = true;
    };
  }, [session?.token, trackId]);

  const updateAccess = async (access: EditableTrackAccess) => {
    if (!session?.token || !track) {
      return;
    }

    const currentVisibility = track.access === "private" ? "private" : "public";

    if (currentVisibility === access) {
      return;
    }

    try {
      setIsSaving(true);
      const updatedTrack = await tracksApi.updateTrackAccess(session.token, track.id, access);
      setTrack(updatedTrack);
      toast.success(access === "public" ? "Track published." : "Track unpublished.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update track visibility",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTrack = async () => {
    if (!session?.token || !track) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${track.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      await tracksApi.deleteTrack(session.token, track.id);
      toast.success("Track deleted.");
      router.push("/dashboard/tracks");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete track",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (!session) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Connect your account before managing a track.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Loading track details...
      </div>
    );
  }

  if (!track) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Track not found.
      </div>
    );
  }

  const currentVisibility: EditableTrackAccess =
    track.access === "private" ? "private" : "public";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button
          asChild
          variant="outline"
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>

        <Button
          variant="outline"
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          onClick={() => router.push("/discover")}
        >
          Open discover
        </Button>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Track details
          </p>
          <h2 className="text-3xl font-semibold text-white">{track.title}</h2>
          <p className="text-slate-400">
            {track.artistName} · {track.genre} · {track.runtime}
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              Status
            </p>
            <p className="mt-3 text-xl text-white">{track.status}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              Playback
            </p>
            <p className="mt-3 text-xl text-white">
              {track.playbackReady ? "Ready" : "Not ready"}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              Visibility
            </p>
            <p className="mt-3 text-xl capitalize text-emerald-300">
              {currentVisibility === "public" ? "Published" : "Unpublished"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Publishing
          </p>
          <h3 className="text-2xl font-semibold text-white">
            Control whether this song is live or held back.
          </h3>
          <p className="text-slate-400">
            Unpublished songs stay out of discovery. Published songs appear in the
            listening surfaces once playback is ready.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {accessOptions.map((option) => {
            const isActive = option.value === currentVisibility;

            return (
              <button
                key={option.value}
                type="button"
                className={`rounded-[24px] border p-5 text-left transition ${
                  isActive
                    ? "border-emerald-400/50 bg-emerald-400/10"
                    : "border-white/10 bg-slate-950/50 hover:border-white/20 hover:bg-white/[0.06]"
                }`}
                disabled={isSaving}
                onClick={() => void updateAccess(option.value)}
              >
                <p className="text-xl font-semibold text-white">{option.label}</p>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {option.description}
                </p>
                {isActive ? (
                  <p className="mt-4 text-xs uppercase tracking-[0.24em] text-emerald-300">
                    Active
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>

        {isSaving ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-slate-300">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Saving visibility...
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            disabled={isSaving || currentVisibility === "public"}
            onClick={() => void updateAccess("public")}
          >
            Publish
          </Button>
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            disabled={isSaving || currentVisibility === "private"}
            onClick={() => void updateAccess("private")}
          >
            Unpublish
          </Button>
          <Button
            variant="outline"
            className="border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20"
            disabled={isDeleting}
            onClick={() => void deleteTrack()}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? "Deleting..." : "Delete track"}
          </Button>
        </div>
      </div>
    </div>
  );
};
