"use client";

import Link from "next/link";
import type { ReleaseSummary } from "@music-city/shared";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatReleaseType = (value: ReleaseSummary["type"]) =>
  value === "ep" ? "EP" : value.charAt(0).toUpperCase() + value.slice(1);

const formatReleaseDate = (value?: string) => {
  if (!value) {
    return "Date not set";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString([], {
    month: "short",
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

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
};

const getStatusLabel = (release: ReleaseSummary) => {
  switch (release.status) {
    case "draft":
      return "Draft";
    case "scheduled":
      return "Scheduled";
    case "published":
      return "Live";
    case "archived":
      return "Archived";
    default:
      return release.status;
  }
};

const getStatusClasses = (release: ReleaseSummary) => {
  switch (release.status) {
    case "scheduled":
      return "border-sky-400/30 bg-sky-400/10 text-sky-100";
    case "published":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
    case "draft":
      return "border-amber-400/30 bg-amber-400/10 text-amber-100";
    default:
      return "border-white/10 bg-slate-950/60 text-slate-300";
  }
};

const getTimingCopy = (release: ReleaseSummary) => {
  if (release.status === "scheduled") {
    const countdown = formatCountdown(release.releaseDate);

    return {
      label: "Upcoming release",
      value: formatReleaseDate(release.releaseDate),
      detail: countdown ? `Countdown: ${countdown}` : "Countdown coming soon",
    };
  }

  if (release.status === "published") {
    return {
      label: "Out now",
      value: formatReleaseDate(release.releaseDate ?? release.publishedAt),
      detail: "Available to fans right now",
    };
  }

  return {
    label: "Release plan",
    value: release.releaseDate ? formatReleaseDate(release.releaseDate) : "Date not set",
    detail: release.status === "draft" ? "Still private in the studio" : "Not currently live",
  };
};

export const ReleaseGrid = ({
  releases,
  hrefBuilder,
  emptyMessage,
  showArtist = true,
}: {
  releases: ReleaseSummary[];
  hrefBuilder?: (release: ReleaseSummary) => string;
  emptyMessage?: string;
  showArtist?: boolean;
}) => {
  if (releases.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
        {emptyMessage ?? "No releases are available yet."}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {releases.map((release) => (
        <Link key={release.id} href={hrefBuilder ? hrefBuilder(release) : `/releases/${release.id}`}>
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
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">
                  {formatReleaseType(release.type)}
                </p>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] ${getStatusClasses(release)}`}
                >
                  {getStatusLabel(release)}
                </span>
              </div>
              <CardTitle className="text-xl">{release.title}</CardTitle>
              {showArtist ? <p className="text-sm text-slate-400">{release.artistName}</p> : null}
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
                <span>{release.trackCount} tracks</span>
                <span>{release.genre}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  {getTimingCopy(release).label}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  {getTimingCopy(release).value}
                </p>
                <p className="mt-1 text-xs text-slate-400">{getTimingCopy(release).detail}</p>
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
