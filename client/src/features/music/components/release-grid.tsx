"use client";

import Link from "next/link";
import type { ReleaseSummary } from "@music-city/shared";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatReleaseType = (value: ReleaseSummary["type"]) =>
  value === "ep" ? "EP" : value.charAt(0).toUpperCase() + value.slice(1);

export const ReleaseGrid = ({
  releases,
  hrefBuilder,
}: {
  releases: ReleaseSummary[];
  hrefBuilder?: (release: ReleaseSummary) => string;
}) => {
  if (releases.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
        No releases are available yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {releases.map((release) => (
        <Link
          key={release.id}
          href={hrefBuilder ? hrefBuilder(release) : `/releases/${release.id}`}
        >
          <Card className="h-full border-white/10 bg-white/5 text-white shadow-none transition hover:border-emerald-400/30 hover:bg-white/[0.07]">
            <div className="overflow-hidden border-b border-white/10">
              {release.coverImageUrl ? (
                <div
                  className="aspect-square bg-cover bg-center"
                  style={{ backgroundImage: `url(${release.coverImageUrl})` }}
                />
              ) : (
                <div className="aspect-square bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.28),_transparent_52%),linear-gradient(180deg,_rgba(15,23,42,0.15),_rgba(15,23,42,0.94))]" />
              )}
            </div>
            <CardHeader className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">
                {formatReleaseType(release.type)}
              </p>
              <CardTitle className="text-xl">{release.title}</CardTitle>
              <p className="text-sm text-slate-400">{release.artistName}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
                <span>{release.trackCount} tracks</span>
                <span>{release.genre}</span>
              </div>
              {release.description ? (
                <p className="line-clamp-3 leading-6 text-slate-400">
                  {release.description}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
};
