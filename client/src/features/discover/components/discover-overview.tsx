"use client";

import { useEffect, useState } from "react";
import type {
  ArtistSummary,
  PlaylistSummary,
  ReleaseSummary,
  TrackSummary,
} from "@music-city/shared";

import { ArtistGrid } from "@/features/music/components/artist-grid";
import { PlaylistGrid } from "@/features/music/components/playlist-grid";
import { playlistsApi } from "@/features/music/lib/playlists-api";
import { ReleaseGrid } from "@/features/music/components/release-grid";
import { releasesApi } from "@/features/music/lib/releases-api";
import { TrackGrid } from "@/features/music/components/track-grid";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { usersApi } from "@/features/users/lib/users-api";

export const DiscoverOverview = () => {
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [nextTracks, nextReleases, nextPlaylists, nextArtists] = await Promise.all([
          tracksApi.listTracks(),
          releasesApi.listReleases(),
          playlistsApi.listPlaylists(),
          usersApi.listArtists(),
        ]);

        if (!cancelled) {
          setTracks(nextTracks);
          setReleases(nextReleases);
          setPlaylists(nextPlaylists);
          setArtists(nextArtists);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <div className="text-sm text-slate-400">Loading catalog...</div>;
  }

  const scheduledReleases = releases.filter((release) => release.status === "scheduled");
  const liveReleases = releases.filter((release) => release.status === "published");

  return (
    <div className="space-y-12">
      {scheduledReleases.length > 0 ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-white">Upcoming countdowns</h2>
            <p className="text-sm text-slate-400">
              Stay close to the next drops and watch the clock on scheduled releases.
            </p>
          </div>
          <ReleaseGrid releases={scheduledReleases} emptyMessage="No scheduled releases yet." />
        </div>
      ) : null}
      <div className="space-y-5">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Latest live releases</h2>
          <p className="text-sm text-slate-400">
            Freshly released projects you can stream right now.
          </p>
        </div>
        <ReleaseGrid releases={liveReleases} emptyMessage="No live releases yet." />
      </div>
      <div className="space-y-5">
        <h2 className="text-2xl font-semibold text-white">Featured tracks</h2>
        <TrackGrid tracks={tracks} />
      </div>
      <div className="space-y-5">
        <h2 className="text-2xl font-semibold text-white">Community playlists</h2>
        <PlaylistGrid playlists={playlists} />
      </div>
      <div className="space-y-5">
        <h2 className="text-2xl font-semibold text-white">Artists in motion</h2>
        <ArtistGrid artists={artists} />
      </div>
    </div>
  );
};
