"use client";

import Link from "next/link";
import type { PlaylistSummary } from "@music-city/shared";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const PlaylistGrid = ({
  playlists,
  hrefBuilder,
}: {
  playlists: PlaylistSummary[];
  hrefBuilder?: (playlist: PlaylistSummary) => string;
}) => {
  if (playlists.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
        No playlists are available yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {playlists.map((playlist) => (
        <Link
          key={playlist.id}
          href={hrefBuilder ? hrefBuilder(playlist) : `/playlists/${playlist.id}`}
        >
          <Card className="h-full border-white/10 bg-white/5 text-white shadow-none transition hover:border-emerald-400/30 hover:bg-white/[0.07]">
            <div className="aspect-square border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.28),_transparent_52%),linear-gradient(180deg,_rgba(15,23,42,0.15),_rgba(15,23,42,0.94))]" />
            <CardHeader className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">
                {playlist.visibility}
              </p>
              <CardTitle className="text-xl">{playlist.title}</CardTitle>
              <p className="text-sm text-slate-400">{playlist.ownerDisplayName}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
                <span>{playlist.trackCount} tracks</span>
                <span>{playlist.visibility === "public" ? "Open" : "Private"}</span>
              </div>
              {playlist.description ? (
                <p className="line-clamp-3 leading-6 text-slate-400">
                  {playlist.description}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
};
