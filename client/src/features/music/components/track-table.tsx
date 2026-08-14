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

export const formatTrackReleaseLabel = (track: TrackSummary) =>
  track.releaseTitle ?? "Not in a release";

export const formatTrackUploadedDate = (createdAt?: string) => {
  if (!createdAt) {
    return "Upload date unavailable";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "Upload date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const TrackThumbnail = ({ track }: { track: TrackSummary }) => {
  if (track.coverImageUrl) {
    return (
      <div
        className="h-12 w-12 shrink-0 rounded-lg bg-cover bg-center"
        style={{ backgroundImage: `url(${track.coverImageUrl})` }}
      />
    );
  }

  return (
    <div className="h-12 w-12 shrink-0 rounded-lg bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.28),_transparent_52%),linear-gradient(180deg,_rgba(15,23,42,0.15),_rgba(15,23,42,0.94))]" />
  );
};

interface TrackTableProps {
  tracks: TrackSummary[];
  actionHeader?: string;
  showMetadata?: boolean;
  titleHref?: (track: TrackSummary) => string;
  onRowClick?: (track: TrackSummary) => void;
  isRowClickable?: (track: TrackSummary) => boolean;
  renderSelectionCell?: (track: TrackSummary) => ReactNode;
  renderAction: (track: TrackSummary) => ReactNode;
  renderOverflowAction?: (track: TrackSummary) => ReactNode;
}

export const TrackTable = ({
  tracks,
  actionHeader = "Action",
  showMetadata = false,
  titleHref,
  onRowClick,
  isRowClickable,
  renderSelectionCell,
  renderAction,
  renderOverflowAction,
}: TrackTableProps) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.025]">
      <table className={cn("w-full text-left", showMetadata ? "min-w-[760px]" : "min-w-[520px]")}>
        <caption className="sr-only">Track catalog</caption>
        <thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.18em] text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Track</th>
            {showMetadata ? (
              <>
                <th scope="col" className="px-4 py-3 font-medium">Artist</th>
                <th scope="col" className="px-4 py-3 font-medium">Uploaded</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Release</th>
              </>
            ) : null}
            <th scope="col" className="px-4 py-3 text-right font-medium">{actionHeader}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
        {tracks.map((track) => {
          const rowClickable = isRowClickable?.(track) ?? false;

          return (
            <tr
              key={track.id}
              className={cn(
                "transition",
                rowClickable && "cursor-pointer hover:bg-white/[0.03]",
              )}
              onClick={() => {
                if (!rowClickable || !onRowClick) {
                  return;
                }

                onRowClick(track);
              }}
              onKeyDown={(event) => {
                if (rowClickable && (event.key === "Enter" || event.key === " ") && onRowClick) {
                  event.preventDefault();
                  onRowClick(track);
                }
              }}
              tabIndex={rowClickable ? 0 : undefined}
              role={rowClickable ? "button" : undefined}
            >
              <td className="px-4 py-3">
                <div className="flex min-w-[220px] items-center gap-3">
                  {renderSelectionCell?.(track)}
                  <TrackThumbnail track={track} />
                  <div className="min-w-0 space-y-1">
                    {titleHref ? (
                      <Link
                        href={titleHref(track)}
                        className="block truncate text-base font-semibold text-white transition hover:text-emerald-300"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {track.title}
                      </Link>
                    ) : (
                      <h3 className="truncate text-base font-semibold text-white">
                        {track.title}
                      </h3>
                    )}
                  </div>
                </div>
              </td>
              {showMetadata ? (
                <>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-300">
                    {track.artistName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-400">
                    {formatTrackUploadedDate(track.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-400">
                    {formatTrackStatus(track)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-400">
                    {formatTrackReleaseLabel(track)}
                  </td>
                </>
              ) : null}
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1.5">
                  {renderAction(track)}
                  {renderOverflowAction?.(track)}
                </div>
              </td>
            </tr>
          );
        })}
        </tbody>
      </table>
    </div>
  );
};
