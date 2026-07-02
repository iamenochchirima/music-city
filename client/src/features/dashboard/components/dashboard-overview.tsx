"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TrackSummary } from "@music-city/shared";

import { Button } from "@/components/ui/button";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { useAuth } from "@/hooks/use-auth";
import { DashboardTrackShelves } from "./dashboard-track-shelves";
import { TrackCreateForm } from "./track-create-form";

export const DashboardOverview = () => {
  const { session } = useAuth();
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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
      <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
        Connect your wallet before using the dashboard.
      </div>
    );
  }

  if (!session.profileComplete) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
        Complete onboarding before creating tracks.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Create a track</h2>
          <p className="text-sm text-slate-300">
            Add a new release when you are ready.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href="/dashboard/analytics">Analytics</Link>
          </Button>
          <Button
            className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            onClick={() => setIsCreateOpen(true)}
          >
            New track
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Build your discography</h2>
          <p className="text-sm text-slate-300">
            Organize tracks into singles, EPs, and albums.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          <Link href="/dashboard/releases">Manage releases</Link>
        </Button>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-[#171a2a] p-6 shadow-2xl sm:p-8">
            <div className="mb-6 space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-400">
                New track
              </p>
              <h3 className="text-3xl font-semibold tracking-tight text-white">
                Create and upload
              </h3>
              <p className="text-sm leading-7 text-slate-300 sm:text-base">
                Add the track details and upload your audio file when you are ready.
              </p>
            </div>
            <TrackCreateForm
              onCreated={() => void loadTracks()}
              onClose={() => setIsCreateOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Your tracks</h2>
        {isLoading ? (
          <div className="text-sm text-slate-400">Loading your tracks...</div>
        ) : (
          <DashboardTrackShelves
            tracks={tracks}
            onTrackSynced={handleTrackSynced}
            onTrackDeleted={handleTrackDeleted}
          />
        )}
      </div>
    </div>
  );
};
