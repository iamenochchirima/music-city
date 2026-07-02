"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ArtistPublicProfile, TrackSummary } from "@music-city/shared";
import { ArrowLeft, Bookmark, Heart, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { engagementApi } from "@/features/engagement/lib/engagement-api";
import { SaveToPlaylistButton } from "@/features/music/components/save-to-playlist-button";
import { TrackCommerceActions } from "@/features/music/components/track-commerce-actions";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { usersApi } from "@/features/users/lib/users-api";
import { useGlobalPlayback } from "@/features/playback/providers/global-playback-provider";
import { useAuth } from "@/hooks/use-auth";

export const TrackDetailOverview = ({ trackId }: { trackId: string }) => {
  const { session } = useAuth();
  const { setPlaybackQueue } = useGlobalPlayback();
  const [track, setTrack] = useState<TrackSummary | null>(null);
  const [artistProfile, setArtistProfile] = useState<ArtistPublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutating, setIsMutating] = useState<"like" | "follow" | "save" | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    const loadTrack = async () => {
      try {
        const nextTrack = await tracksApi.getTrack(trackId);

        if (!cancelled) {
          setTrack(nextTrack);
          setArtistProfile(
            nextTrack ? await usersApi.getArtistProfile(nextTrack.artistId) : null,
          );
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Unable to load track details",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTrack();

    return () => {
      cancelled = true;
    };
  }, [trackId]);

  useEffect(() => {
    setPlaybackQueue(track ? [track] : []);
  }, [track, setPlaybackQueue]);

  useEffect(() => {
    let cancelled = false;

    const loadEngagement = async () => {
      if (!session?.token || !track || !artistProfile) {
        setIsLiked(false);
        setIsSaved(false);
        setIsFollowing(false);
        return;
      }

      try {
        const [likeState, saveState, followState] = await Promise.all([
          engagementApi.getTrackLikeState(session.token, track.id),
          engagementApi.getTrackSaveState(session.token, track.id),
          engagementApi.getArtistFollowState(session.token, artistProfile.id),
        ]);

        if (!cancelled) {
          setIsLiked(likeState.liked);
          setIsSaved(saveState.saved);
          setIsFollowing(followState.following);
          setTrack((current) =>
            current ? { ...current, likes: likeState.likeCount } : current,
          );
          setArtistProfile((current) =>
            current
              ? { ...current, followerCount: followState.followerCount }
              : current,
          );
        }
      } catch {
        if (!cancelled) {
          setIsLiked(false);
          setIsFollowing(false);
        }
      }
    };

    void loadEngagement();

    return () => {
      cancelled = true;
    };
  }, [artistProfile?.id, session?.token, track?.id]);

  const toggleLike = async () => {
    if (!session?.token || !track) {
      return;
    }

    try {
      setIsMutating("like");
      const nextState = isLiked
        ? await engagementApi.unlikeTrack(session.token, track.id)
        : await engagementApi.likeTrack(session.token, track.id);
      setIsLiked(nextState.liked);
      setTrack((current) =>
        current ? { ...current, likes: nextState.likeCount } : current,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update like");
    } finally {
      setIsMutating(null);
    }
  };

  const toggleSave = async () => {
    if (!session?.token || !track) {
      return;
    }

    try {
      setIsMutating("save");
      const nextState = isSaved
        ? await engagementApi.unsaveTrack(session.token, track.id)
        : await engagementApi.saveTrack(session.token, track.id);
      setIsSaved(nextState.saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update save");
    } finally {
      setIsMutating(null);
    }
  };

  const toggleFollow = async () => {
    if (!session?.token || !artistProfile) {
      return;
    }

    try {
      setIsMutating("follow");
      const nextState = isFollowing
        ? await engagementApi.unfollowArtist(session.token, artistProfile.id)
        : await engagementApi.followArtist(session.token, artistProfile.id);
      setIsFollowing(nextState.following);
      setArtistProfile((current) =>
        current
          ? { ...current, followerCount: nextState.followerCount }
          : current,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update follow status",
      );
    } finally {
      setIsMutating(null);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Loading track details...
      </div>
    );
  }

  if (!track) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Track not found.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Button
        asChild
        variant="outline"
        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
      >
        <Link href="/stream">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to streaming
        </Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04]">
          {track.coverImageUrl ? (
            <div
              className="aspect-square bg-cover bg-center"
              style={{ backgroundImage: `url(${track.coverImageUrl})` }}
            />
          ) : (
            <div className="aspect-square bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.28),_transparent_52%),linear-gradient(180deg,_rgba(15,23,42,0.15),_rgba(15,23,42,0.94))]" />
          )}
        </div>

        <div className="space-y-6 rounded-[32px] border border-white/10 bg-white/[0.04] p-8">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
              Track details
            </p>
            <h2 className="text-4xl font-semibold text-white sm:text-5xl">
              {track.title}
            </h2>
            <p className="text-lg text-slate-300">{track.artistName}</p>
            {track.releaseId && track.releaseTitle ? (
              <p className="text-sm text-slate-400">
                From{" "}
                <Link
                  href={`/releases/${track.releaseId}`}
                  className="text-emerald-300 hover:text-emerald-200"
                >
                  {track.releaseTitle}
                </Link>
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                Genre
              </p>
              <p className="mt-2 text-base text-white">{track.genre}</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                Runtime
              </p>
              <p className="mt-2 text-base text-white">{track.runtime}</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                Status
              </p>
              <p className="mt-2 text-base text-white">{track.status}</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                Likes
              </p>
              <p className="mt-2 text-base text-white">{track.likes}</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                Followers
              </p>
              <p className="mt-2 text-base text-white">
                {artistProfile?.followerCount ?? 0}
              </p>
            </div>
          </div>

          {track.description ? (
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                Description
              </p>
              <p className="max-w-3xl text-base leading-7 text-slate-300">
                {track.description}
              </p>
            </div>
          ) : null}

          <TrackCommerceActions
            track={track}
            artistProfile={artistProfile}
            onUnlocked={async () => {
              setTrack(await tracksApi.getTrack(track.id));
            }}
          />

          {session ? (
            <div className="flex flex-wrap gap-3">
              <Button
                variant={isLiked ? "default" : "outline"}
                className={
                  isLiked
                    ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                }
                disabled={isMutating === "like"}
                onClick={() => void toggleLike()}
              >
                <Heart className="h-4 w-4" />
                {isLiked ? "Liked" : "Like track"}
              </Button>
              {artistProfile ? (
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  disabled={isMutating === "follow"}
                  onClick={() => void toggleFollow()}
                >
                  <UserPlus className="h-4 w-4" />
                  {isFollowing ? "Following artist" : "Follow artist"}
                </Button>
              ) : null}
              <Button
                variant={isSaved ? "default" : "outline"}
                className={
                  isSaved
                    ? "bg-white text-slate-950 hover:bg-slate-100"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                }
                disabled={isMutating === "save"}
                onClick={() => void toggleSave()}
              >
                <Bookmark className="h-4 w-4" />
                {isSaved ? "Saved" : "Save track"}
              </Button>
              <SaveToPlaylistButton track={track} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
