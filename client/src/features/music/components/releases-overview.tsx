"use client";

import { useEffect, useState } from "react";
import type { ReleaseSummary } from "@music-city/shared";

import { ReleaseGrid } from "@/features/music/components/release-grid";
import { releasesApi } from "@/features/music/lib/releases-api";

export const ReleasesOverview = () => {
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextReleases = await releasesApi.listReleases();

        if (!cancelled) {
          setReleases(nextReleases);
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
  }, []);

  if (isLoading) {
    return <div className="text-sm text-slate-400">Loading releases...</div>;
  }

  const scheduledReleases = releases.filter((release) => release.status === "scheduled");
  const liveReleases = releases.filter((release) => release.status === "published");

  return (
    <div className="space-y-10">
      {scheduledReleases.length > 0 ? (
        <section className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-white">Upcoming releases</h2>
            <p className="text-sm text-slate-400">
              Countdown pages fans can follow before the music unlocks.
            </p>
          </div>
          <ReleaseGrid releases={scheduledReleases} emptyMessage="No upcoming releases yet." />
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Live now</h2>
          <p className="text-sm text-slate-400">
            Full releases that are ready to stream right away.
          </p>
        </div>
        <ReleaseGrid releases={liveReleases} emptyMessage="No live releases yet." />
      </section>
    </div>
  );
};
