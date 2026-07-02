"use client";

import { useEffect, useState } from "react";
import type { PlaylistSummary } from "@music-city/shared";

import { PlaylistGrid } from "@/features/music/components/playlist-grid";
import { playlistsApi } from "@/features/music/lib/playlists-api";

export const PlaylistsOverview = () => {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await playlistsApi.listPlaylists();

        if (!cancelled) {
          setPlaylists(next);
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
    return <div className="text-sm text-slate-400">Loading playlists...</div>;
  }

  return <PlaylistGrid playlists={playlists} />;
};
