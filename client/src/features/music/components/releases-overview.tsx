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

  return <ReleaseGrid releases={releases} />;
};
