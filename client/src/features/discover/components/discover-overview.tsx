"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

const DiscoverSection = ({
  title,
  description,
  href,
  linkLabel,
  children,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      <Link
        href={href}
        className="text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
      >
        {linkLabel} →
      </Link>
    </div>
    {children}
  </section>
);

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
        <DiscoverSection
          title="Upcoming countdowns"
          description="Stay close to the next drops and watch the clock on scheduled releases."
          href="/releases"
          linkLabel="View all releases"
        >
          <ReleaseGrid releases={scheduledReleases.slice(0, 3)} emptyMessage="No scheduled releases yet." />
        </DiscoverSection>
      ) : null}
      <DiscoverSection
        title="Latest live releases"
        description="Freshly released projects you can stream right now."
        href="/releases"
        linkLabel="View all releases"
      >
        <ReleaseGrid releases={liveReleases.slice(0, 3)} emptyMessage="No live releases yet." />
      </DiscoverSection>
      <DiscoverSection
        title="Featured tracks"
        description="A quick way into the latest music on Music City."
        href="/stream"
        linkLabel="View all tracks"
      >
        <TrackGrid tracks={tracks.slice(0, 6)} />
      </DiscoverSection>
      <DiscoverSection
        title="Community playlists"
        description="Listening paths built by the Music City community."
        href="/playlists"
        linkLabel="View all playlists"
      >
        <PlaylistGrid playlists={playlists.slice(0, 3)} />
      </DiscoverSection>
      <DiscoverSection
        title="Artists in motion"
        description="Explore artists and the music they are sharing."
        href="/artists"
        linkLabel="View all artists"
      >
        <ArtistGrid artists={artists.slice(0, 6)} />
      </DiscoverSection>
    </div>
  );
};
