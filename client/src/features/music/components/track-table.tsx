"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { TrackSummary } from "@music-city/shared";

import { cn } from "@/lib/utils";

export const formatTrackStatus = (track: TrackSummary) => {
  if (track.playbackReady) {
    return "Ready";
  }

  if (track.muxAssetStatus === "asset_created") {
    return "Mux processing";
  }

  if (track.muxAssetStatus === "waiting") {
    return "Upload received";
  }

  if (track.muxAssetStatus === "errored") {
    return "Needs attention";
  }

  if (track.status === "awaiting_upload") {
    return "Awaiting upload";
  }

  return track.status;
};

export const formatTrackVisibilityLabel = (track: TrackSummary) =>
  track.visibility === "published" ? "Published" : "Unpublished";

export const TrackThumbnail = ({ track }: { track: TrackSummary }) => {
  if (track.coverImageUrl) {
    return (
      <div
        className="h-14 w-14 shrink-0 rounded-2xl bg-cover bg-center"
        style={{ backgroundImage: `url(${track.coverImageUrl})` }}
      />
    );
  }

  return (
    <div className="h-14 w-14 shrink-0 rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.28),_transparent_52%),linear-gradient(180deg,_rgba(15,23,42,0.15),_rgba(15,23,42,0.94))]" />
  );
};

interface TrackTableProps {
  tracks: TrackSummary[];
  actionHeader?: string;
  titleHref?: (track: TrackSummary) => string;
  onRowClick?: (track: TrackSummary) => void;
  isRowClickable?: (track: TrackSummary) => boolean;
  renderSelectionCell?: (track: TrackSummary) => ReactNode;
  renderAction: (track: TrackSummary) => ReactNode;
}

export const TrackTable = ({
  tracks,
  actionHeader = "Action",
  titleHref,
  onRowClick,
  isRowClickable,
  renderSelectionCell,
  renderAction,
}: TrackTableProps) => {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
      <div className="hidden grid-cols-[minmax(280px,2.2fr)_1fr_1fr_1fr_120px] gap-4 border-b border-white/10 px-6 py-4 text-xs uppercase tracking-[0.24em] text-slate-500 lg:grid">
        <span>Track</span>
        <span>Genre</span>
        <span>Status</span>
        <span>Runtime</span>
        <span className="text-right">{actionHeader}</span>
      </div>

      <div className="divide-y divide-white/10">
        {tracks.map((track) => {
          const rowClickable = isRowClickable?.(track) ?? false;

          return (
            <article
              key={track.id}
              className={cn(
                "px-4 py-4 transition sm:px-6",
                rowClickable && "cursor-pointer hover:bg-white/[0.03]",
              )}
              onClick={() => {
                if (!rowClickable || !onRowClick) {
                  return;
                }

                onRowClick(track);
              }}
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(280px,2.2fr)_1fr_1fr_1fr_120px] lg:items-center">
                <div className="flex items-center gap-4">
                  {renderSelectionCell?.(track)}
                  <TrackThumbnail track={track} />
                  <div className="min-w-0 space-y-1">
                    {titleHref ? (
                      <Link
                        href={titleHref(track)}
                        className="block truncate text-lg font-semibold text-white transition hover:text-emerald-300"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {track.title}
                      </Link>
                    ) : (
                      <h3 className="truncate text-lg font-semibold text-white">
                        {track.title}
                      </h3>
                    )}
                    <p className="truncate text-sm text-slate-400">
                      {track.artistName}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 lg:hidden">
                    Genre
                  </p>
                  <div>
                    <span className="inline-flex rounded-full border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-300">
                      {track.genre}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 lg:hidden">
                    Status
                  </p>
                  <p className="text-sm text-slate-200">{formatTrackStatus(track)}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 lg:hidden">
                    Runtime
                  </p>
                  <p className="text-sm text-slate-200">{track.runtime}</p>
                </div>

                <div className="flex justify-start lg:justify-end">
                  {renderAction(track)}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
