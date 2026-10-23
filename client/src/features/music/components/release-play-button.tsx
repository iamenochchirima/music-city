"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReleaseDetail } from "@music-city/shared";
import { LoaderCircle, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { releasesApi } from "@/features/music/lib/releases-api";
import { playbackApi } from "@/features/playback/lib/playback-api";
import { useGlobalPlayback } from "@/features/playback/providers/global-playback-provider";

export const orderedReleaseTracks = (release: ReleaseDetail) =>
  [...release.tracks]
    .sort((a, b) => a.discNumber - b.discNumber || a.trackNumber - b.trackNumber)
    .map((item) => item.track)
    .filter((track) => track.playbackReady && track.visibility === "published");

export function ReleasePlayButton({ releaseId, title, release: initialRelease }: {
  releaseId: string;
  title: string;
  release?: ReleaseDetail;
}) {
  const { session } = useAuth();
  const { activeTrackId, isPlaying, currentTime, duration, playTrack, togglePlayback, setPlaybackQueue } = useGlobalPlayback();
  const [release, setRelease] = useState(initialRelease ?? null);
  const [isStarting, setIsStarting] = useState(false);
  const pending = useRef<Promise<ReleaseDetail | null> | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const load = useCallback(() => {
    if (initialRelease) return Promise.resolve(initialRelease);
    if (!pending.current) {
      pending.current = releasesApi.getRelease(releaseId).then((next) => {
        setRelease(next);
        return next;
      }).catch((error) => { pending.current = null; throw error; });
    }
    return pending.current;
  }, [initialRelease, releaseId]);

  useEffect(() => {
    if (initialRelease || !button.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        void load().catch(() => {});
      }
    }, { rootMargin: "200px" });
    observer.observe(button.current);
    return () => observer.disconnect();
  }, [initialRelease, load]);

  const currentRelease = initialRelease ?? release;
  const tracks = currentRelease ? orderedReleaseTracks(currentRelease) : [];
  const isActive = tracks.some((track) => track.id === activeTrackId);
  useEffect(() => {
    if (currentRelease?.status === "published") playbackApi.preloadTracks(session?.token, orderedReleaseTracks(currentRelease));
  }, [currentRelease, session?.token]);

  const start = async () => {
    setIsStarting(true);
    try {
      const next = await load();
      const queue = next?.status === "published" ? orderedReleaseTracks(next) : [];
      if (!queue.length) { toast.error("This release is not ready to play yet."); return; }
      setPlaybackQueue(queue);
      if (queue.some((track) => track.id === activeTrackId) && currentTime < duration) await togglePlayback();
      else await playTrack(queue[0]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to play this release");
    } finally { setIsStarting(false); }
  };

  const isPausedAction = isActive && isPlaying;
  return (
    <Button
      ref={button}
      type="button"
      className="relative z-10 gap-2 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
      onClick={() => void start()}
      disabled={isStarting}
      aria-label={`${isPausedAction ? "Pause" : "Play"} ${title}`}
      aria-busy={isStarting}
    >
      {isStarting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : isPausedAction ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
      {isStarting ? "Starting…" : isPausedAction ? "Pause" : "Play"}
    </Button>
  );
}
