"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TrackSummary } from "@music-city/shared";

import { StudioPageHeader } from "@/components/studio/page-header";
import { EmptyState } from "@/components/studio/empty-state";
import { Button } from "@/components/ui/button";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
import { useAuth } from "@/hooks/use-auth";
import { DashboardTrackShelves } from "./dashboard-track-shelves";

export const DashboardTracksOverview = () => {
  const { session } = useAuth();
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadTracks = async () => {
    if (!session?.token) {
      setTracks([]);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      setTracks(await tracksApi.listMyTracks(session.token));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to load tracks",
      );
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
      <div className="rounded-xl border border-border bg-card p-5 text-muted-foreground">
        Connect your wallet before using the studio catalog.
      </div>
    );
  }

  if (session.onboardingStatus !== "complete") {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-muted-foreground">
        Complete onboarding before managing tracks.
      </div>
    );
  }

  if (session.primaryIntent !== "artist" && session.primaryIntent !== "both") {
    return <ArtistAccessGate action="manage tracks" />;
  }

  return (
    <div className="space-y-5">
      <StudioPageHeader
        title="Your tracks"
        description="Manage recordings, metadata, and release placement."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/dashboard/create?recording=1">New track</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/releases">Manage releases</Link>
            </Button>
          </div>
        }
      />
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 text-sm text-destructive"
        >
          {error}
          <Button variant="outline" onClick={() => void loadTracks()}>
            Retry
          </Button>
        </div>
      ) : null}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Loading your tracks...
        </div>
      ) : !tracks.length && !error ? (
        <EmptyState
          title="No tracks yet"
          description="Upload your first recording, then add it to a release."
          action={
            <Button asChild variant="outline">
              <Link href="/dashboard/create?recording=1">Upload a track</Link>
            </Button>
          }
        />
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
