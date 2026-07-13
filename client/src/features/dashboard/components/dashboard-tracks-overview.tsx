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
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Connect your wallet before using the studio catalog.
      </div>
    );
  }

  if (!session.profileComplete) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Complete onboarding before managing tracks.
      </div>
    );
  }

  if (session.role !== "artist" || !session.artistOnboardingFeePaid) {
    return <ArtistAccessGate action="manage tracks" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Your track catalog</h2>
          <p className="max-w-2xl text-sm leading-7 text-slate-300">
            Review playback readiness, sync uploads, change access, and open each
            song’s management page from one table-driven workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
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
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-sm text-slate-400">
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
