"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TrackSummary } from "@music-city/shared";
import { Ellipsis, LoaderCircle, Play } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { playbackApi } from "@/features/playback/lib/playback-api";
import { Button } from "@/components/ui/button";
import { useGlobalPlayback } from "@/features/playback/providers/global-playback-provider";
import { TrackTable } from "@/features/music/components/track-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const TrackGrid = ({
  tracks,
  onTrackSynced,
}: {
  tracks?: TrackSummary[];
  onTrackSynced?: (track: TrackSummary) => void;
}) => {
  const { session } = useAuth();
  const { activeTrackId, playTrack, setPlaybackQueue } = useGlobalPlayback();
  const [syncingTrackId, setSyncingTrackId] = useState<string | null>(null);
  const safeTracks = Array.isArray(tracks) ? tracks : [];

  const handleTrackAction = async (track: TrackSummary) => {
    setPlaybackQueue(safeTracks);
    await playTrack(track);
  };

  useEffect(() => {
    playbackApi.preloadTracks(session?.token, safeTracks);
  }, [safeTracks, session?.token]);

  if (safeTracks.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
        No tracks are published yet.
      </div>
    );
  }

  return (
    <TrackTable
      tracks={safeTracks}
      actionHeader="Action"
      titleHref={(track) => `/stream/${track.id}`}
      onRowClick={(track) => void handleTrackAction(track)}
      isRowClickable={(track) =>
        Boolean(
          track.playbackReady &&
          track.visibility === "published",
        )
      }
      renderAction={(track) =>
        track.playbackReady && track.visibility === "published" ? (
          <Button
            data-playback-preload={track.id}
            variant={activeTrackId === track.id ? "default" : "outline"}
            className={
              activeTrackId === track.id
                ? "bg-emerald-400 px-3 text-slate-950 hover:bg-emerald-300"
                : "border-white/10 bg-white/5 px-3 text-white hover:bg-white/10"
            }
            onClick={(event) => {
              event.stopPropagation();
              void handleTrackAction(track);
            }}
          >
            <Play className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 px-3 text-white hover:bg-white/10"
            disabled
            onClick={(event) => event.stopPropagation()}
          >
            <Play className="h-4 w-4 fill-current" />
          </Button>
        )
      }
      renderOverflowAction={(track) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              aria-label={`More options for ${track.title}`}
              className="border-white/10 bg-white/5 px-3 text-white hover:bg-white/10"
              onClick={(event) => event.stopPropagation()}
            >
              <Ellipsis className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-44 border-white/10 bg-[#101625] text-white"
          >
            <DropdownMenuItem
              asChild
              className="cursor-pointer focus:bg-white/10 focus:text-white"
            >
              <Link href={`/stream/${track.id}`}>View track details</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    />
  );
};
