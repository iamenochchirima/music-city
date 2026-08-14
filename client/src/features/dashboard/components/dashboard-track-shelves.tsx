"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TrackSummary, TrackVisibility } from "@music-city/shared";
import {
  Check,
  ExternalLink,
  LoaderCircle,
  MoreHorizontal,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
  TrackTable,
  formatTrackVisibilityLabel,
} from "@/features/music/components/track-table";
import { useGlobalPlayback } from "@/features/playback/providers/global-playback-provider";
import { useAuth } from "@/hooks/use-auth";

interface DashboardTrackShelvesProps {
  tracks: TrackSummary[];
  onTrackSynced: (track: TrackSummary) => void;
  onTrackDeleted: (trackId: string) => void;
}

const TrackTableSection = ({
  title,
  description,
  tracks,
  activeTrackId,
  syncingTrackId,
  deletingTrackId,
  selectionMode,
  selectedTrackIds,
  canPlayTrack,
  onPlay,
  onSync,
  onDelete,
  onUpdateVisibility,
  onToggleSelectionMode,
  onToggleTrackSelected,
}: {
  title: string;
  description: string;
  tracks: TrackSummary[];
  activeTrackId: string | null;
  syncingTrackId: string | null;
  deletingTrackId: string | null;
  selectionMode: boolean;
  selectedTrackIds: string[];
  canPlayTrack: (track: TrackSummary) => boolean;
  onPlay: (track: TrackSummary) => Promise<void>;
  onSync: (track: TrackSummary) => Promise<void>;
  onDelete: (track: TrackSummary) => Promise<void>;
  onUpdateVisibility: (track: TrackSummary, visibility: TrackVisibility) => Promise<void>;
  onToggleSelectionMode: (track: TrackSummary) => void;
  onToggleTrackSelected: (trackId: string) => void;
}) => {
  if (tracks.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <TrackTable
        tracks={tracks}
        titleHref={(track) => `/dashboard/tracks/${track.id}`}
        onRowClick={(track) => void onPlay(track)}
        isRowClickable={canPlayTrack}
        renderSelectionCell={(track) =>
          selectionMode ? (
            <button
              type="button"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                selectedTrackIds.includes(track.id)
                  ? "border-emerald-400 bg-emerald-400 text-slate-950"
                  : "border-white/15 bg-white/5 text-transparent hover:border-white/30"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleTrackSelected(track.id);
              }}
              aria-label={
                selectedTrackIds.includes(track.id)
                  ? "Deselect track"
                  : "Select track"
              }
            >
              <Check className="h-4 w-4" />
            </button>
          ) : null
        }
        renderAction={(track) => {
          const isSyncing = syncingTrackId === track.id;
          const isDeleting = deletingTrackId === track.id;
          const isActive = activeTrackId === track.id;

          return (
            <div className="flex flex-wrap justify-start gap-1.5 lg:justify-end">
              {track.playbackReady ? (
                <Button
                  variant={isActive ? "default" : "outline"}
                  className={
                    isActive
                      ? "bg-emerald-400 px-3 text-slate-950 hover:bg-emerald-300"
                      : "border-white/10 bg-white/5 px-3 text-white hover:bg-white/10"
                  }
                  disabled={!canPlayTrack(track)}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onPlay(track);
                  }}
                >
                  <Play className="h-4 w-4 fill-current" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  disabled={isSyncing}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onSync(track);
                  }}
                >
                  {isSyncing ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-white/5 px-3 text-white hover:bg-white/10"
                    disabled={isDeleting}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-44 border-white/10 bg-[#101625] text-white"
                >
                  <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10 focus:text-white">
                    <Link href={`/dashboard/tracks/${track.id}`}>
                      Manage
                      <ExternalLink className="ml-auto h-4 w-4" />
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    className="cursor-pointer focus:bg-white/10 focus:text-white"
                    onClick={() => void onUpdateVisibility(track, "unpublished")}
                  >
                    Unpublish
                    {track.visibility === "unpublished" ? (
                      <Check className="ml-auto h-4 w-4 text-emerald-300" />
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer focus:bg-white/10 focus:text-white"
                    onClick={() => void onUpdateVisibility(track, "published")}
                  >
                    Publish
                    {track.visibility === "published" ? (
                      <Check className="ml-auto h-4 w-4 text-emerald-300" />
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer focus:bg-white/10 focus:text-white"
                    onClick={() => onToggleSelectionMode(track)}
                  >
                    {selectionMode ? "Stop selecting" : "Select"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    className="cursor-pointer text-red-200 focus:bg-red-500/10 focus:text-red-100"
                    disabled={isDeleting || isSyncing}
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
          );
        }}
      />
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
  const [syncingTrackId, setSyncingTrackId] = useState<string | null>(null);
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  const [trackPendingDelete, setTrackPendingDelete] = useState<TrackSummary | null>(null);
  const [bulkDeleteCount, setBulkDeleteCount] = useState<number | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkAccessUpdating, setBulkAccessUpdating] = useState<TrackVisibility | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const canPlayTrack = (track: TrackSummary) =>
    Boolean(track.playbackReady && session?.token);

  const readyTracks = tracks.filter((track) => track.playbackReady);
  const pipelineTracks = tracks.filter((track) => !track.playbackReady);

  useEffect(() => {
    setPlaybackQueue(readyTracks);
  }, [readyTracks, setPlaybackQueue]);

  const syncTrack = async (track: TrackSummary) => {
    const token = session?.token;

    if (!token) {
      return;
    }

    try {
      setSyncingTrackId(track.id);
      const updated = await tracksApi.syncTrackMedia(token, track.id);
      onTrackSynced(updated);

      if (updated.playbackReady) {
        toast.success("Track is ready to play.");
      } else {
        toast.message("Track is still processing.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to refresh track status",
      );
    } finally {
      setSyncingTrackId(null);
    }
  };

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
      toast.success("Track deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete track",
      );
    } finally {
      setDeletingTrackId(null);
      setTrackPendingDelete(null);
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
        error instanceof Error ? error.message : "Unable to delete selected tracks",
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

  const applyTrackVisibilityUpdate = async (track: TrackSummary, visibility: TrackVisibility) => {
    const token = session?.token;

    if (!token || track.visibility === visibility) {
      return;
    }

    try {
      const updated = await tracksApi.updateTrackVisibility(token, track.id, visibility);
      onTrackSynced(updated);
      toast.success(`${track.title} is now ${formatTrackVisibilityLabel(updated).toLowerCase()}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update track visibility",
      );
    }
  };

  const updateTrackVisibility = async (track: TrackSummary, visibility: TrackVisibility) => {
    await applyTrackVisibilityUpdate(track, visibility);
  };

  const clearSelectionMode = () => {
    setSelectionMode(false);
    setSelectedTrackIds([]);
  };

  const applySelectedTracksVisibilityUpdate = async (visibility: TrackVisibility) => {
    const token = session?.token;

    if (!token || selectedTrackIds.length === 0) {
      return;
    }

    const selectedTracks = tracks.filter((track) => selectedTrackIds.includes(track.id));

    try {
      setBulkAccessUpdating(visibility);

      const updatedTracks = await Promise.all(
        selectedTracks
          .filter((track) => track.visibility !== visibility)
          .map((track) => tracksApi.updateTrackVisibility(token, track.id, visibility)),
      );

      updatedTracks.forEach((track) => onTrackSynced(track));

      toast.success(
        `${selectedTracks.length} track${selectedTracks.length === 1 ? "" : "s"} updated.`,
      );
      clearSelectionMode();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update selected tracks",
      );
    } finally {
      setBulkAccessUpdating(null);
    }
  };

  const updateSelectedTracksVisibility = async (visibility: TrackVisibility) => {
    await applySelectedTracksVisibilityUpdate(visibility);
  };

  const deleteSelectedTracks = async () => {
    if (selectedTrackIds.length === 0) {
      return;
    }

    setBulkDeleteCount(selectedTrackIds.length);
  };

  return (
    <div className="space-y-6 pb-32">
      {bulkDeleteCount ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#171a2a] p-5 shadow-2xl">
            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-red-300">
                Confirm delete
              </p>
              <h3 className="text-2xl font-semibold text-white">
                Are you sure you want to delete these tracks?
              </h3>
              <p className="text-sm leading-7 text-slate-300">
                This action can't be undone.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                disabled={isBulkDeleting}
                onClick={() => setBulkDeleteCount(null)}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-500 text-white hover:bg-red-400"
                disabled={isBulkDeleting}
                onClick={() => void confirmDeleteSelectedTracks()}
              >
                {isBulkDeleting ? "Deleting..." : `Delete ${bulkDeleteCount}`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {trackPendingDelete ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#171a2a] p-5 shadow-2xl">
            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-red-300">
                Confirm delete
              </p>
              <h3 className="text-2xl font-semibold text-white">
                Are you sure you want to delete this track?
              </h3>
              <p className="text-sm leading-7 text-slate-300">
                This action can't be undone.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                disabled={Boolean(deletingTrackId)}
                onClick={() => setTrackPendingDelete(null)}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-500 text-white hover:bg-red-400"
                disabled={deletingTrackId === trackPendingDelete.id}
                onClick={() => void confirmDeleteTrack()}
              >
                {deletingTrackId === trackPendingDelete.id ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {selectionMode ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
          <span>
            {selectedTrackIds.length} track{selectedTrackIds.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              disabled={Boolean(bulkAccessUpdating) || isBulkDeleting || selectedTrackIds.length === 0}
              onClick={() => void updateSelectedTracksVisibility("unpublished")}
            >
              {bulkAccessUpdating === "unpublished" ? "Updating..." : "Unpublish"}
            </Button>
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              disabled={Boolean(bulkAccessUpdating) || isBulkDeleting || selectedTrackIds.length === 0}
              onClick={() => void updateSelectedTracksVisibility("published")}
            >
              {bulkAccessUpdating === "published" ? "Updating..." : "Publish"}
            </Button>
            <Button
              variant="outline"
              className="border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20"
              disabled={Boolean(bulkAccessUpdating) || isBulkDeleting || selectedTrackIds.length === 0}
              onClick={() => void deleteSelectedTracks()}
            >
              {isBulkDeleting ? "Deleting..." : "Delete selected"}
            </Button>
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              disabled={Boolean(bulkAccessUpdating) || isBulkDeleting}
              onClick={clearSelectionMode}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <TrackTableSection
        title="Ready to play"
        description="Playable tracks"
        tracks={readyTracks}
        activeTrackId={activeTrackId}
        syncingTrackId={syncingTrackId}
        deletingTrackId={deletingTrackId}
        selectionMode={selectionMode}
        selectedTrackIds={selectedTrackIds}
        canPlayTrack={canPlayTrack}
        onPlay={playTrack}
        onSync={syncTrack}
        onDelete={deleteTrack}
        onUpdateVisibility={updateTrackVisibility}
        onToggleSelectionMode={toggleSelectionMode}
        onToggleTrackSelected={toggleTrackSelected}
      />
      <TrackTableSection
        title="Processing"
        description="Uploads still processing"
        tracks={pipelineTracks}
        activeTrackId={activeTrackId}
        syncingTrackId={syncingTrackId}
        deletingTrackId={deletingTrackId}
        selectionMode={selectionMode}
        selectedTrackIds={selectedTrackIds}
        canPlayTrack={canPlayTrack}
        onPlay={playTrack}
        onSync={syncTrack}
        onDelete={deleteTrack}
        onUpdateVisibility={updateTrackVisibility}
        onToggleSelectionMode={toggleSelectionMode}
        onToggleTrackSelected={toggleTrackSelected}
      />

    </div>
  );
};
