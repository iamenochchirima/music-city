"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TrackSummary } from "@music-city/shared";

import { Button } from "@/components/ui/button";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
import { useAuth } from "@/hooks/use-auth";
import { DashboardTrackShelves } from "./dashboard-track-shelves";

export const DashboardTracksOverview = () => {
  const { session } = useAuth();
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTracks = async () => {
    if (!session?.token) {
      setTracks([]);
      return;
    }

    setIsLoading(true);

    try {
      setTracks(await tracksApi.listMyTracks(session.token));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTracks();
  }, [session?.token]);

  const handleTrackSynced = (updatedTrack: TrackSummary) => {
    setTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === updatedTrack.id ? updatedTrack : track,
      ),
    );
  };

  const handleTrackDeleted = (trackId: string) => {
    setTracks((currentTracks) =>
      currentTracks.filter((track) => track.id !== trackId),
    );
  };

  if (!session) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-slate-300">
        Connect your wallet before using the studio catalog.
      </div>
    );
  }

  if (session.onboardingStatus !== "complete") {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-slate-300">
        Complete onboarding before managing tracks.
      </div>
    );
  }

  if (session.primaryIntent !== "artist" && session.primaryIntent !== "both") {
    return <ArtistAccessGate action="manage tracks" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h2 className="text-2xl font-semibold text-white">Your track catalog</h2>
          <p className="mt-1 text-sm text-slate-400">Manage uploads, metadata, and releases.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          >
            <Link href="/dashboard/create">New track</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href="/dashboard/releases">Manage releases</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">
          Loading your tracks...
        </div>
      ) : (
        <DashboardTrackShelves
          tracks={tracks}
          onTrackSynced={handleTrackSynced}
          onTrackDeleted={handleTrackDeleted}
        />
      )}
    </div>
  );
};
