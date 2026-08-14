"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  ArtistPublicProfile,
  ReleaseSummary,
  TrackSummary,
} from "@music-city/shared";
import { ArrowLeft, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { engagementApi } from "@/features/engagement/lib/engagement-api";
import { ReleaseGrid } from "@/features/music/components/release-grid";
import { TrackGrid } from "@/features/music/components/track-grid";
import { usersApi } from "@/features/users/lib/users-api";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";

export const ArtistDetailOverview = ({ artistId }: { artistId: string }) => {
  const { session } = useAuth();
  const [profile, setProfile] = useState<ArtistPublicProfile | null>(null);
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [nextProfile, nextReleases, nextTracks] = await Promise.all([
          usersApi.getArtistProfile(artistId),
          usersApi.getArtistReleases(artistId),
          usersApi.getArtistTracks(artistId),
        ]);

        if (!cancelled) {
          setProfile(nextProfile);
          setReleases(nextReleases);
          setTracks(nextTracks);
          trackEvent("artist_profile_viewed");
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Unable to load artist details",
          );
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
  }, [artistId]);

  useEffect(() => {
    let cancelled = false;

    const loadFollowState = async () => {
      if (!session?.token || !profile) {
        setIsFollowing(false);
        return;
      }

      try {
        const state = await engagementApi.getArtistFollowState(
          session.token,
          profile.id,
        );

        if (!cancelled) {
          setIsFollowing(state.following);
          setProfile((current) =>
            current ? { ...current, followerCount: state.followerCount } : current,
          );
        }
      } catch {
        if (!cancelled) {
          setIsFollowing(false);
        }
      }
    };

    void loadFollowState();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, session?.token]);

  const groupedReleases = useMemo(
    () => ({
      scheduled: releases.filter((release) => release.status === "scheduled"),
      albums: releases.filter((release) => release.type === "album"),
      eps: releases.filter((release) => release.type === "ep"),
      singles: releases.filter((release) => release.type === "single"),
    }),
    [releases],
  );

  if (isLoading) {
    return <div className="text-sm text-slate-400">Loading artist profile...</div>;
  }

  if (!profile) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-300">
        Artist not found.
      </div>
    );
  }

  const toggleFollow = async () => {
    if (!session?.token || !profile) {
      return;
    }

    try {
      setIsFollowLoading(true);
      const state = isFollowing
        ? await engagementApi.unfollowArtist(session.token, profile.id)
        : await engagementApi.followArtist(session.token, profile.id);
      setIsFollowing(state.following);
      setProfile((current) =>
        current ? { ...current, followerCount: state.followerCount } : current,
      );
      if (state.following) {
        trackEvent("artist_followed");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update follow status",
      );
    } finally {
      setIsFollowLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <Button
        asChild
        variant="outline"
        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
      >
        <Link href="/artists">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to artists
        </Link>
      </Button>

      <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
              Artist profile
            </p>
            <h2 className="text-4xl font-semibold text-white sm:text-5xl">
              {profile.displayName}
            </h2>
            <p className="text-lg text-slate-300">{profile.location || "Remote"}</p>
            <p className="text-sm text-slate-400">
              {profile.followerCount} follower
              {profile.followerCount === 1 ? "" : "s"}
            </p>
          </div>
          {session ? (
            <Button
              variant={isFollowing ? "default" : "outline"}
              className={
                isFollowing
                  ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  : "border-white/10 bg-white/5 text-white hover:bg-white/10"
              }
              disabled={isFollowLoading}
              onClick={() => void toggleFollow()}
            >
              <UserPlus className="h-4 w-4" />
              {isFollowing ? "Following" : "Follow artist"}
            </Button>
          ) : null}
        </div>
      </section>

      {groupedReleases.scheduled.length > 0 ? (
        <section className="space-y-5">
          <h3 className="text-2xl font-semibold text-white">Upcoming releases</h3>
          <ReleaseGrid
            releases={groupedReleases.scheduled}
            emptyMessage="No upcoming releases from this artist yet."
          />
        </section>
      ) : null}

      <section className="space-y-5">
        <h3 className="text-2xl font-semibold text-white">Latest releases</h3>
        <ReleaseGrid
          releases={releases.filter((release) => release.status === "published").slice(0, 3)}
          emptyMessage="No live releases from this artist yet."
        />
      </section>

      <section className="space-y-5">
        <h3 className="text-2xl font-semibold text-white">Albums</h3>
        <ReleaseGrid
          releases={groupedReleases.albums.filter((release) => release.status === "published")}
          emptyMessage="No live albums yet."
        />
      </section>

      <section className="space-y-5">
        <h3 className="text-2xl font-semibold text-white">EPs</h3>
        <ReleaseGrid
          releases={groupedReleases.eps.filter((release) => release.status === "published")}
          emptyMessage="No live EPs yet."
        />
      </section>

      <section className="space-y-5">
        <h3 className="text-2xl font-semibold text-white">Singles</h3>
        <ReleaseGrid
          releases={groupedReleases.singles.filter((release) => release.status === "published")}
          emptyMessage="No live singles yet."
        />
      </section>

      <section className="space-y-5">
        <h3 className="text-2xl font-semibold text-white">Top tracks</h3>
        <TrackGrid tracks={tracks} />
      </section>
    </div>
  );
};
