"use client";

import { recordingDuration } from "../lib/recording-duration";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TrackSummary } from "@music-city/shared";
import {
  ExternalLink,
  LoaderCircle,
  MoreHorizontal,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tracksApi } from "@/features/music/lib/tracks-api";
import {
  formatTrackStatus,
  formatTrackUploadedDate,
} from "@/features/music/components/track-table";
import { LibraryRow } from "@/components/studio/library-row";
import { StatusBadge } from "@/components/studio/status-badge";
import { Dialog } from "@/components/ui/dialog";
import { useGlobalPlayback } from "@/features/playback/providers/global-playback-provider";
import { useAuth } from "@/hooks/use-auth";

interface DashboardTrackShelvesProps {
  tracks: TrackSummary[];
  onTrackSynced: (track: TrackSummary) => void;
  onTrackDeleted: (trackId: string) => void;
}

const TrackLibrarySection = ({
  title,
  description,
  tracks,
  activeTrackId,
  deletingTrackId,
  selectionMode,
  selectedTrackIds,
  canPlayTrack,
  onPlay,
  onDelete,
  onToggleSelectionMode,
  onToggleTrackSelected,
}: {
  title: string;
  description: string;
  tracks: TrackSummary[];
  activeTrackId: string | null;
  deletingTrackId: string | null;
  selectionMode: boolean;
  selectedTrackIds: string[];
  canPlayTrack: (track: TrackSummary) => boolean;
  onPlay: (track: TrackSummary) => Promise<void>;
  onDelete: (track: TrackSummary) => Promise<void>;
  onToggleSelectionMode: (track: TrackSummary) => void;
  onToggleTrackSelected: (trackId: string) => void;
}) => {
  if (tracks.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ul className="divide-y divide-border">
        {tracks.map((track) => {
          const isDeleting = deletingTrackId === track.id;
          const isActive = activeTrackId === track.id;
          return (
            <LibraryRow
              key={track.id}
              title={track.title}
              href={`/dashboard/tracks/${track.id}`}
              leading={
                selectionMode ? (
                  <label className="flex min-h-11 items-center">
                    <Checkbox
                      checked={selectedTrackIds.includes(track.id)}
                      onChange={() => onToggleTrackSelected(track.id)}
                      aria-label={`Select ${track.title}`}
                    />
                  </label>
                ) : null
              }
              description={
                <>
                  {[
                    track.artistName,
                    track.genre,
                    recordingDuration(track.runtime),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  <br />
                  {track.releaseTitle ?? "Not in a release"} ·{" "}
                  {formatTrackUploadedDate(track.createdAt)}
                </>
              }
              actions={
                <div className="flex flex-wrap justify-start gap-1.5 lg:justify-end">
                  {track.playbackReady ? (
                    <Button
                      variant={isActive ? "default" : "outline"}
                      aria-label={`Play ${track.title}`}
                      data-playback-preload={canPlayTrack(track) ? track.id : undefined}
                      disabled={!canPlayTrack(track)}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onPlay(track);
                      }}
                    >
                      <Play className="h-4 w-4 fill-current" />
                    </Button>
                  ) : (
                    <span
                      aria-label="Audio processing"
                      className="inline-flex h-10 items-center px-3"
                    >
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    </span>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        aria-label={`Actions for ${track.title}`}
                        disabled={isDeleting}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="studio-theme w-44"
                    >
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href={`/dashboard/tracks/${track.id}`}>
                          Edit track
                          <ExternalLink className="ml-auto h-4 w-4" />
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link
                          href={
                            track.releaseId
                              ? `/dashboard/releases/${track.releaseId}`
                              : "/dashboard/releases"
                          }
                        >
                          {track.releaseId
                            ? "Manage release"
                            : "Add to release"}
                          <ExternalLink className="ml-auto h-4 w-4" />
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => onToggleSelectionMode(track)}
                      >
                        {selectionMode ? "Stop selecting" : "Select"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        disabled={isDeleting}
                        onClick={() => void onDelete(track)}
                      >
                        {isDeleting ? (
                          <>
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            Deleting
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              }
            >
              <StatusBadge status={formatTrackStatus(track)} />
            </LibraryRow>
          );
        })}
      </ul>
    </section>
  );
};

export const DashboardTrackShelves = ({
  tracks,
  onTrackSynced,
  onTrackDeleted,
}: DashboardTrackShelvesProps) => {
  const { session } = useAuth();
  const { activeTrackId, playTrack, setPlaybackQueue } = useGlobalPlayback();
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  const [trackPendingDelete, setTrackPendingDelete] =
    useState<TrackSummary | null>(null);
  const [bulkDeleteCount, setBulkDeleteCount] = useState<number | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const canPlayTrack = (track: TrackSummary) =>
    Boolean(track.playbackReady && session?.token);

  const readyTracks = tracks.filter((track) => track.playbackReady);
  const pipelineTracks = tracks.filter((track) => !track.playbackReady);

  useEffect(() => {
    if (!session?.token || !pipelineTracks.some((t) => t.status !== "failed"))
      return;
    let active = true;
    const timer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void tracksApi
        .listMyTracks(session.token!)
        .then((updated) => {
          if (active)
            updated
              .filter((t) => pipelineTracks.some((p) => p.id === t.id))
              .forEach((t) => onTrackSynced(t));
        })
        .catch(() => undefined);
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [
    session?.token,
    tracks.map((t) => `${t.id}:${t.playbackReady}:${t.status}`).join(","),
  ]);

  const deleteTrack = async (track: TrackSummary) => {
    setTrackPendingDelete(track);
  };

  const confirmDeleteTrack = async () => {
    const token = session?.token;
    const track = trackPendingDelete;

    if (!token || !track) {
      return;
    }

    try {
      setDeletingTrackId(track.id);
      await tracksApi.deleteTrack(token, track.id);
      onTrackDeleted(track.id);
      setTrackPendingDelete(null);
      toast.success("Track deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete track",
      );
    } finally {
      setDeletingTrackId(null);
    }
  };

  const confirmDeleteSelectedTracks = async () => {
    const token = session?.token;

    if (!token || selectedTrackIds.length === 0) {
      return;
    }

    try {
      setIsBulkDeleting(true);

      await Promise.all(
        selectedTrackIds.map(async (trackId) => {
          await tracksApi.deleteTrack(token, trackId);
          onTrackDeleted(trackId);
        }),
      );

      toast.success(
        `${selectedTrackIds.length} track${selectedTrackIds.length === 1 ? "" : "s"} deleted.`,
      );
      setBulkDeleteCount(null);
      clearSelectionMode();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to delete selected tracks",
      );
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectionMode = (track: TrackSummary) => {
    setSelectionMode((current) => {
      const next = !current;

      if (next) {
        setSelectedTrackIds((currentIds) =>
          currentIds.includes(track.id) ? currentIds : [track.id],
        );
      } else {
        setSelectedTrackIds([]);
      }

      return next;
    });
  };

  const toggleTrackSelected = (trackId: string) => {
    setSelectedTrackIds((current) =>
      current.includes(trackId)
        ? current.filter((id) => id !== trackId)
        : [...current, trackId],
    );
  };

  const clearSelectionMode = () => {
    setSelectionMode(false);
    setSelectedTrackIds([]);
  };

  const deleteSelectedTracks = async () => {
    if (selectedTrackIds.length === 0) {
      return;
    }

    setBulkDeleteCount(selectedTrackIds.length);
  };

  return (
    <div className="space-y-8">
      {bulkDeleteCount ? (
        <Dialog
          title={`Delete ${bulkDeleteCount} selected tracks?`}
          description="This removes their recordings and cannot be undone."
          busy={isBulkDeleting}
          onClose={() => setBulkDeleteCount(null)}
        >
          <div className="flex justify-end gap-3">
            <Button
              autoFocus
              variant="outline"
              disabled={isBulkDeleting}
              onClick={() => setBulkDeleteCount(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isBulkDeleting}
              onClick={() => void confirmDeleteSelectedTracks()}
            >
              {isBulkDeleting ? "Deleting..." : `Delete ${bulkDeleteCount}`}
            </Button>
          </div>
        </Dialog>
      ) : null}
      {trackPendingDelete ? (
        <Dialog
          title={`Delete "${trackPendingDelete.title}"?`}
          description="This action cannot be undone."
          busy={Boolean(deletingTrackId)}
          onClose={() => setTrackPendingDelete(null)}
        >
          <div className="flex justify-end gap-3">
            <Button
              autoFocus
              variant="outline"
              disabled={Boolean(deletingTrackId)}
              onClick={() => setTrackPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={Boolean(deletingTrackId)}
              onClick={() => void confirmDeleteTrack()}
            >
              {deletingTrackId ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </Dialog>
      ) : null}

      {selectionMode ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <span>
            {selectedTrackIds.length} track
            {selectedTrackIds.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="outline"
              className="text-destructive"
              disabled={isBulkDeleting || selectedTrackIds.length === 0}
              onClick={() => void deleteSelectedTracks()}
            >
              {isBulkDeleting ? "Deleting..." : "Delete selected"}
            </Button>
            <Button
              variant="outline"
              disabled={isBulkDeleting}
              onClick={clearSelectionMode}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <TrackLibrarySection
        title="Ready to play"
        description="Playable tracks"
        tracks={readyTracks}
        activeTrackId={activeTrackId}
        deletingTrackId={deletingTrackId}
        selectionMode={selectionMode}
        selectedTrackIds={selectedTrackIds}
        canPlayTrack={canPlayTrack}
        onPlay={async (track) => { setPlaybackQueue(readyTracks); await playTrack(track); }}
        onDelete={deleteTrack}
        onToggleSelectionMode={toggleSelectionMode}
        onToggleTrackSelected={toggleTrackSelected}
      />
      <TrackLibrarySection
        title="Processing"
        description="Uploads still processing"
        tracks={pipelineTracks}
        activeTrackId={activeTrackId}
        deletingTrackId={deletingTrackId}
        selectionMode={selectionMode}
        selectedTrackIds={selectedTrackIds}
        canPlayTrack={canPlayTrack}
        onPlay={async (track) => { setPlaybackQueue(readyTracks); await playTrack(track); }}
        onDelete={deleteTrack}
        onToggleSelectionMode={toggleSelectionMode}
        onToggleTrackSelected={toggleTrackSelected}
      />
    </div>
  );
};
