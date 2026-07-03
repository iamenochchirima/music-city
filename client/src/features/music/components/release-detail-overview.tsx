"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ReleaseDetail } from "@music-city/shared";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { engagementApi } from "@/features/engagement/lib/engagement-api";
import { TrackGrid } from "@/features/music/components/track-grid";
import { releasesApi } from "@/features/music/lib/releases-api";
import { useAuth } from "@/hooks/use-auth";

const formatReleaseDateTime = (value?: string) => {
  if (!value) {
    return "Coming soon";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatCountdown = (value?: string) => {
  if (!value) {
    return null;
  }

  const target = new Date(value).getTime();

  if (Number.isNaN(target)) {
    return null;
  }

  const remainingMs = target - Date.now();

  if (remainingMs <= 0) {
    return "Releasing now";
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return `${days}d ${hours}h ${minutes}m`;
};

export const ReleaseDetailOverview = ({ releaseId }: { releaseId: string }) => {
  const { session } = useAuth();
  const [release, setRelease] = useState<ReleaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextRelease = await releasesApi.getRelease(releaseId);

        if (!cancelled) {
          setRelease(nextRelease);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Unable to load release details",
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
  }, [releaseId]);

  useEffect(() => {
    if (release?.status !== "scheduled" || !release.releaseDate) {
      setCountdown(null);
      return;
    }

    let cancelled = false;

    const updateCountdown = async () => {
      const nextCountdown = formatCountdown(release.releaseDate);
      setCountdown(nextCountdown);

      if (nextCountdown !== "Releasing now") {
        return;
      }

      try {
        const nextRelease = await releasesApi.getRelease(releaseId);

        if (!cancelled && nextRelease) {
          setRelease(nextRelease);
        }
      } catch {
        // Ignore refresh errors and let the next interval retry.
      }
    };

    void updateCountdown();
    const timer = window.setInterval(() => {
      void updateCountdown();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [release?.releaseDate, release?.status, releaseId]);

  useEffect(() => {
    let cancelled = false;

    const recordView = async () => {
      try {
        await engagementApi.recordReleaseView(releaseId, session?.token);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    };

    void recordView();

    return () => {
      cancelled = true;
    };
  }, [releaseId, session?.token]);

  if (isLoading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Loading release details...
      </div>
    );
  }

  if (!release) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Release not found.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Button
        asChild
        variant="outline"
        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
      >
        <Link href="/releases">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to releases
        </Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04]">
          {release.coverImageUrl ? (
            <div
              className="aspect-square bg-cover bg-center"
              style={{ backgroundImage: `url(${release.coverImageUrl})` }}
            />
          ) : (
            <div className="aspect-square bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.28),_transparent_52%),linear-gradient(180deg,_rgba(15,23,42,0.15),_rgba(15,23,42,0.94))]" />
          )}
        </div>

        <div className="space-y-6 rounded-[32px] border border-white/10 bg-white/[0.04] p-8">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
              {release.type === "ep" ? "EP" : release.type}
            </p>
            <h2 className="text-4xl font-semibold text-white sm:text-5xl">
              {release.title}
            </h2>
            <p className="text-lg text-slate-300">{release.artistName}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                Genre
              </p>
              <p className="mt-2 text-base text-white">{release.genre}</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                Tracks
              </p>
              <p className="mt-2 text-base text-white">{release.trackCount}</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                Release date
              </p>
              <p className="mt-2 text-base text-white">
                {formatReleaseDateTime(release.releaseDate)}
              </p>
            </div>
          </div>

          {release.status === "scheduled" ? (
            <div className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-5">
              <p className="text-sm uppercase tracking-[0.24em] text-emerald-300">
                Scheduled release
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {countdown ?? "Countdown starting"}
              </p>
              <p className="mt-2 text-sm leading-7 text-emerald-100/85">
                Fans can follow the countdown here until the full release goes live.
              </p>
            </div>
          ) : null}

          {release.description ? (
            <p className="max-w-3xl text-base leading-7 text-slate-300">
              {release.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-5">
        <h3 className="text-2xl font-semibold text-white">Tracklist</h3>
        {release.status === "scheduled" ? (
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
            <div className="divide-y divide-white/10">
              {release.tracks.map((item) => (
                <div
                  key={item.trackId}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div>
                    <p className="font-semibold text-white">{item.track.title}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Track {item.trackNumber}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                    Unlocks at release
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <TrackGrid tracks={release.tracks.map((item) => item.track)} />
        )}
      </div>
    </div>
  );
};
