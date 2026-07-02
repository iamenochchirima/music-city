"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ReleaseDetail } from "@music-city/shared";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TrackGrid } from "@/features/music/components/track-grid";
import { releasesApi } from "@/features/music/lib/releases-api";

export const ReleaseDetailOverview = ({ releaseId }: { releaseId: string }) => {
  const [release, setRelease] = useState<ReleaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
                {release.releaseDate ?? "Coming soon"}
              </p>
            </div>
          </div>

          {release.description ? (
            <p className="max-w-3xl text-base leading-7 text-slate-300">
              {release.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-5">
        <h3 className="text-2xl font-semibold text-white">Tracklist</h3>
        <TrackGrid tracks={release.tracks.map((item) => item.track)} />
      </div>
    </div>
  );
};
