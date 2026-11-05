"use client";

import { useEffect, useState } from "react";
import type { ArtistSummary } from "@music-city/shared";

import { ArtistGrid } from "@/features/music/components/artist-grid";
import { releasesApi } from "@/features/music/lib/releases-api";
import { usersApi } from "@/features/users/lib/users-api";
import { artistsWithPublicReleases } from "../lib/artist-directory";

export const ArtistsOverview = () => {
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [nextArtists, nextReleases] = await Promise.all([
          usersApi.listArtists(),
          releasesApi.listReleases(),
        ]);

        if (!cancelled) {
          setArtists(artistsWithPublicReleases(nextArtists, nextReleases));
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
    return <div className="text-sm text-slate-400">Loading artists...</div>;
  }

  return <ArtistGrid artists={artists} />;
};
