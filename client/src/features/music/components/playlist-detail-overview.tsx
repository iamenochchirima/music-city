"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PlaylistDetail } from "@music-city/shared";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TrackGrid } from "@/features/music/components/track-grid";
import { playlistsApi } from "@/features/music/lib/playlists-api";

export const PlaylistDetailOverview = ({ playlistId }: { playlistId: string }) => {
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await playlistsApi.getPlaylist(playlistId);

        if (!cancelled) {
          setPlaylist(next);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Unable to load playlist",
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
  }, [playlistId]);

  if (isLoading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Loading playlist details...
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Playlist not found.
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
        <Link href="/playlists">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to playlists
        </Link>
      </Button>

      <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-8">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Playlist
          </p>
          <h2 className="text-4xl font-semibold text-white sm:text-5xl">
            {playlist.title}
          </h2>
          <p className="text-lg text-slate-300">{playlist.ownerDisplayName}</p>
          {playlist.description ? (
            <p className="max-w-3xl text-base leading-7 text-slate-300">
              {playlist.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-5">
        <h3 className="text-2xl font-semibold text-white">Tracklist</h3>
        <TrackGrid tracks={playlist.tracks.map((item) => item.track)} />
      </div>
    </div>
  );
};
