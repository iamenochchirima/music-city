"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AdRecord, PlaybackSession, TrackSummary } from "@music-city/shared";
import Hls from "hls.js";
import {
  ChevronDown,
  Ellipsis,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { adsApi } from "@/features/ads/lib/ads-api";
import { engagementApi } from "@/features/engagement/lib/engagement-api";
import { playbackApi } from "@/features/playback/lib/playback-api";
import { useAuth } from "@/hooks/use-auth";
import { ApiClientError } from "@/lib/api/http-client";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type GlobalPlaybackContextValue = {
  activeTrack: TrackSummary | null;
  activeTrackId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  canPlayPrevious: boolean;
  canPlayNext: boolean;
  playTrack: (track: TrackSummary) => Promise<void>;
  togglePlayback: () => Promise<void>;
  playPreviousTrack: () => Promise<void>;
  playNextTrack: () => Promise<void>;
  dismissPlayback: () => Promise<void>;
  seekTo: (value: number) => void;
  skipBy: (delta: number) => void;
  setVolumeLevel: (value: number) => void;
  setPlaybackQueue: (tracks: TrackSummary[]) => void;
};

const GlobalPlaybackContext = createContext<GlobalPlaybackContextValue | null>(null);

const formatClock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const isHlsStream = (url: string) => {
  try {
    return new URL(url, window.location.origin).pathname.endsWith(".m3u8");
  } catch {
    return url.includes(".m3u8");
  }
};

const describePlaybackError = (error: unknown) =>
  error instanceof DOMException && error.name === "NotSupportedError"
    ? "The audio source could not be loaded. Check the media URL and format."
    : error instanceof Error
      ? error.message
      : "Unable to start audio playback";

const TrackArt = ({ track }: { track: TrackSummary }) => {
  if (track.coverImageUrl) {
    return (
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${track.coverImageUrl})` }}
      />
    );
  }

  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.28),_transparent_52%),linear-gradient(180deg,_rgba(15,23,42,0.15),_rgba(15,23,42,0.94))]" />
  );
};

const buildRangeBackground = (value: number, max: number, playedColor: string) => {
  if (!Number.isFinite(max) || max <= 0) {
    return "rgba(255,255,255,0.08)";
  }

  const clampedPercent = Math.max(0, Math.min(100, (value / max) * 100));

  return `linear-gradient(90deg, ${playedColor} 0%, ${playedColor} ${clampedPercent}%, rgba(255,255,255,0.08) ${clampedPercent}%, rgba(255,255,255,0.08) 100%)`;
};

const GlobalPlaybackBar = ({
  activeTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  canPlayPrevious,
  canPlayNext,
  isPlayingAd,
  activeAd,
  togglePlayback,
  playPreviousTrack,
  playNextTrack,
  dismissPlayback,
  seekTo,
  setVolumeLevel,
}: Omit<
  GlobalPlaybackContextValue,
  "activeTrackId" | "playTrack" | "skipBy" | "setPlaybackQueue"
> & {
  isPlayingAd: boolean;
  activeAd: AdRecord | null;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded]);

  if (!activeTrack) {
    return null;
  }

  const progressPercent =
    duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;

  return (
    <>
      {isExpanded ? (
        <section
          className="fixed inset-0 z-[60] flex flex-col bg-[#070b16] px-5 pb-8 pt-[max(1rem,env(safe-area-inset-top))] text-white sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`Now playing ${activeTrack.title}`}
        >
          <header className="grid h-12 grid-cols-[44px_1fr_44px] items-center">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/10"
              onClick={() => setIsExpanded(false)}
              aria-label="Collapse player"
            >
              <ChevronDown className="h-6 w-6" />
            </button>
            <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
              Now playing
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/10"
                  aria-label="More track options"
                >
                  <Ellipsis className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 border-white/10 bg-[#101625] text-white"
              >
                <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10 focus:text-white">
                  <Link href={`/stream/${activeTrack.id}`}>View track details</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void dismissPlayback()}
                  className="cursor-pointer focus:bg-white/10 focus:text-white"
                >
                  Hide player
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <div className="flex min-h-0 flex-1 flex-col justify-evenly py-4">
            <div className="relative mx-auto aspect-square w-full max-w-[min(78vw,360px)] overflow-hidden rounded-2xl bg-slate-900 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
              <TrackArt track={activeTrack} />
            </div>

            <div className="space-y-6">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{activeTrack.title}</h2>
                <p className="mt-1 truncate text-sm text-slate-400">{activeTrack.artistName}</p>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min={0}
                  max={Math.max(duration, 0)}
                  step={0.1}
                  value={Math.min(currentTime, duration || 0)}
                  onChange={(event) => seekTo(Number(event.target.value))}
                  disabled={isPlayingAd}
                  aria-label="Playback position"
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
                  style={{
                    background: buildRangeBackground(
                      Math.min(currentTime, duration || 0),
                      Math.max(duration, 0),
                      "#34d399",
                    ),
                  }}
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{formatClock(currentTime)}</span>
                  <span>{formatClock(duration)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 items-center justify-items-center">
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:bg-white/10 disabled:opacity-35"
                  disabled={!canPlayPrevious}
                  onClick={() => void playPreviousTrack()}
                  aria-label="Previous track"
                >
                  <SkipBack className="h-6 w-6 fill-current" />
                </button>
                <button
                  type="button"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400 text-slate-950 transition hover:bg-emerald-300"
                  onClick={() => void togglePlayback()}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="h-7 w-7 fill-current" />
                  ) : (
                    <Play className="h-7 w-7 fill-current" />
                  )}
                </button>
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:bg-white/10 disabled:opacity-35"
                  disabled={!canPlayNext}
                  onClick={() => void playNextTrack()}
                  aria-label="Next track"
                >
                  <SkipForward className="h-6 w-6 fill-current" />
                </button>
              </div>

              {isPlayingAd ? (
                <p className="text-center text-xs uppercase tracking-[0.18em] text-amber-300">
                  Sponsored{activeAd?.brandName ? ` · ${activeAd.brandName}` : ""}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="fixed bottom-2 left-1/2 z-50 flex h-16 w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-[#0d1324]/96 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:hidden">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => setIsExpanded(true)}
          aria-label={`Open player for ${activeTrack.title}`}
        >
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-900">
            <TrackArt track={activeTrack} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{activeTrack.title}</p>
            <p className="mt-0.5 truncate text-xs text-slate-400">{activeTrack.artistName}</p>
          </div>
        </button>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          onClick={() => void togglePlayback()}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current" />
          )}
        </button>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 disabled:opacity-35"
          disabled={!canPlayNext}
          onClick={() => void playNextTrack()}
          aria-label="Next track"
        >
          <SkipForward className="h-5 w-5 fill-current" />
        </button>
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
          <div
            className="h-full bg-emerald-400 transition-[width] duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="fixed bottom-4 left-1/2 z-50 hidden w-[min(1180px,calc(100vw-2rem))] -translate-x-1/2 rounded-[28px] border border-white/10 bg-[#0d1324]/96 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:block">
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_180px] lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-900">
              <TrackArt track={activeTrack} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{activeTrack.title}</p>
              <p className="mt-1 truncate text-sm text-slate-400">{activeTrack.artistName}</p>
              <div
                className={cn(
                  "mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]",
                  isPlayingAd ? "text-amber-300" : "text-emerald-300",
                )}
              >
                <Music2 className="h-3 w-3" />
                {isPlayingAd
                  ? `Sponsored${activeAd?.brandName ? ` · ${activeAd.brandName}` : ""}`
                  : "Now playing"}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10 disabled:opacity-35"
                disabled={!canPlayPrevious}
                onClick={() => void playPreviousTrack()}
                aria-label="Previous track"
              >
                <SkipBack className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400 text-slate-950 transition hover:bg-emerald-300"
                onClick={() => void togglePlayback()}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="h-5 w-5 fill-current" />
                )}
              </button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10 disabled:opacity-35"
                disabled={!canPlayNext}
                onClick={() => void playNextTrack()}
                aria-label="Next track"
              >
                <SkipForward className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-[36px_1fr_36px] items-center gap-2 text-[10px] text-slate-400">
              <span>{formatClock(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(duration, 0)}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => seekTo(Number(event.target.value))}
                disabled={isPlayingAd}
                aria-label="Playback position"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
                style={{
                  background: buildRangeBackground(
                    Math.min(currentTime, duration || 0),
                    Math.max(duration, 0),
                    "#34d399",
                  ),
                }}
              />
              <span className="text-right">{formatClock(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {volume === 0 ? (
              <VolumeX className="h-4 w-4 shrink-0 text-slate-400" />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0 text-slate-400" />
            )}
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => setVolumeLevel(Number(event.target.value))}
              aria-label="Volume"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
              style={{ background: buildRangeBackground(volume, 1, "#34d399") }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export const GlobalPlaybackProvider = ({ children }: { children: ReactNode }) => {
  const { session, logout } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [activeTrack, setActiveTrack] = useState<TrackSummary | null>(null);
  const [playbackSession, setPlaybackSession] = useState<PlaybackSession | null>(
    null,
  );
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [playbackQueue, setPlaybackQueueState] = useState<TrackSummary[]>([]);
  const [activeAd, setActiveAd] = useState<AdRecord | null>(null);
  const [activeAdImpressionId, setActiveAdImpressionId] = useState<string | null>(
    null,
  );
  const [pendingTrackAfterAd, setPendingTrackAfterAd] = useState<TrackSummary | null>(
    null,
  );
  const lastObservedPlaybackPositionRef = useRef<number | null>(null);
  const unreportedListenSecondsRef = useRef(0);
  const isReportingPlaybackRef = useRef(false);
  const completionReportedRef = useRef(false);

  const setPlaybackQueue = useCallback((tracks: TrackSummary[]) => {
    const nextQueue = tracks.filter((track) => track.playbackReady);

    setPlaybackQueueState((currentQueue) => {
      if (
        currentQueue.length === nextQueue.length &&
        currentQueue.every((track, index) => track.id === nextQueue[index]?.id)
      ) {
        return currentQueue;
      }

      return nextQueue;
    });
  }, []);

  const syncProgress = () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const nextPosition = audio.currentTime || 0;
    const previousPosition = lastObservedPlaybackPositionRef.current;

    if (
      !audio.paused &&
      previousPosition !== null &&
      nextPosition > previousPosition &&
      nextPosition - previousPosition <= 2
    ) {
      unreportedListenSecondsRef.current += nextPosition - previousPosition;
    }

    lastObservedPlaybackPositionRef.current = nextPosition;
    setCurrentTime(nextPosition);

    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
      return;
    }

    const seekableRange = audio.seekable;
    const fallbackDuration =
      seekableRange.length > 0 ? seekableRange.end(seekableRange.length - 1) : 0;

    if (fallbackDuration > 0) {
      setDuration(fallbackDuration);
    }
  };

  const stopAnimationLoop = () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const startAnimationLoop = () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    stopAnimationLoop();

    const tick = () => {
      syncProgress();

      if (!audio.paused && !audio.ended) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
  };

  const clearActiveAdState = useCallback(() => {
    setActiveAd(null);
    setActiveAdImpressionId(null);
    setPendingTrackAfterAd(null);
  }, []);

  const reportAdImpressionUpdate = useCallback(
    async (
      impressionId: string,
      input: {
        status: "completed" | "skipped" | "failed";
        reason?: string;
      },
    ) => {
      if (!session?.token) {
        return;
      }

      try {
        await adsApi.updateImpression(session.token, impressionId, input);
      } catch {
        // Ignore impression delivery failures so playback is never blocked.
      }
    },
    [session?.token],
  );

  const startTrackSession = useCallback(
    async (track: TrackSummary) => {
      if (!session?.token) {
        return;
      }

      try {
        const nextPlaybackSession = await playbackApi.createSession(
          session.token,
          track.id,
        );
        lastObservedPlaybackPositionRef.current = null;
        unreportedListenSecondsRef.current = 0;
        isReportingPlaybackRef.current = false;
        completionReportedRef.current = false;
        clearActiveAdState();
        setActiveTrack(track);
        setPlaybackSession(nextPlaybackSession);
        setStreamUrl(nextPlaybackSession.streamUrl);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          toast.error("Your session expired. Please sign in again.");
          await logout();
          return;
        }

        toast.error(
          error instanceof Error ? error.message : "Unable to start playback",
        );
      }
    },
    [clearActiveAdState, logout, session?.token],
  );

  const handleAudioEnded = useCallback(async () => {
    stopAnimationLoop();
    setIsPlaying(false);
    setCurrentTime(0);

    if (activeAd && pendingTrackAfterAd) {
      const impressionId = activeAdImpressionId;
      const nextTrack = pendingTrackAfterAd;
      clearActiveAdState();

      if (impressionId) {
        void reportAdImpressionUpdate(impressionId, {
          status: "completed",
        });
      }

      await startTrackSession(nextTrack);
    }
  }, [
    activeAd,
    activeAdImpressionId,
    clearActiveAdState,
    pendingTrackAfterAd,
    reportAdImpressionUpdate,
    startTrackSession,
  ]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const handleTimeUpdate = () => syncProgress();
    const handleLoadedMetadata = () => syncProgress();
    const handleDurationChange = () => syncProgress();
    const handleCanPlay = () => {
      syncProgress();
    };
    const handlePlay = () => {
      setIsPlaying(true);
      startAnimationLoop();
    };
    const handlePause = () => {
      setIsPlaying(false);
      stopAnimationLoop();
      syncProgress();
    };
    const handleEnded = () => {
      void handleAudioEnded();
    };

    audio.volume = volume;
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      stopAnimationLoop();
    };
  }, [handleAudioEnded, volume]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !streamUrl) {
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setCurrentTime(0);
    setDuration(0);

    const startPlayback = async () => {
      try {
        if (isHlsStream(streamUrl)) {
          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(audio);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (audio.duration) {
                setDuration(audio.duration);
              }
            });
            hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
              const nextDuration = data.details?.totalduration;
              if (nextDuration) {
                setDuration(nextDuration);
              }
            });
            hlsRef.current = hls;
          } else {
            audio.src = streamUrl;
          }
        } else {
          audio.src = streamUrl;
        }

        await audio.play();
        setIsPlaying(true);
        syncProgress();
        startAnimationLoop();
      } catch (error) {
        setIsPlaying(false);

        if (activeAd && pendingTrackAfterAd) {
          const impressionId = activeAdImpressionId;
          const nextTrack = pendingTrackAfterAd;
          clearActiveAdState();

          if (impressionId) {
            void reportAdImpressionUpdate(impressionId, {
              status: "failed",
              reason: describePlaybackError(error),
            });
          }

          toast.error("Ad could not be loaded. Continuing to the track.");
          await startTrackSession(nextTrack);
          return;
        }

        toast.error(describePlaybackError(error));
      }
    };

    void startPlayback();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [
    activeAd,
    activeAdImpressionId,
    clearActiveAdState,
    pendingTrackAfterAd,
    reportAdImpressionUpdate,
    startTrackSession,
    streamUrl,
  ]);

  const recordPlaybackEvent = useCallback(
    async (
      eventType: "progress" | "completed",
      positionSeconds: number,
      force = false,
    ) => {
      if (
        !session?.token ||
        !playbackSession ||
        isReportingPlaybackRef.current
      ) {
        return;
      }

      const listenedSeconds = Math.min(unreportedListenSecondsRef.current, 30);

      if (!force && listenedSeconds < 15) {
        return;
      }

      if (eventType === "progress" && listenedSeconds <= 0) {
        return;
      }

      isReportingPlaybackRef.current = true;

      try {
        const updatedSession = await engagementApi.recordPlaybackEvent(
          session.token,
          playbackSession,
          {
            eventType,
            positionSeconds,
            durationSeconds: duration > 0 ? duration : undefined,
            listenedSeconds: listenedSeconds || undefined,
          },
        );

        unreportedListenSecondsRef.current = Math.max(
          0,
          unreportedListenSecondsRef.current - listenedSeconds,
        );
        setPlaybackSession(updatedSession);
      } catch {
        // Keep the unreported duration so the next heartbeat can retry it.
      } finally {
        isReportingPlaybackRef.current = false;
      }
    },
    [duration, playbackSession, session?.token],
  );

  useEffect(() => {
    if (!playbackSession || !isPlaying || unreportedListenSecondsRef.current < 15) {
      return;
    }

    void recordPlaybackEvent("progress", currentTime);
  }, [currentTime, isPlaying, playbackSession, recordPlaybackEvent]);

  useEffect(() => {
    if (!playbackSession || completionReportedRef.current || !duration) {
      return;
    }

    if (currentTime < Math.max(duration - 1, duration * 0.98)) {
      return;
    }

    completionReportedRef.current = true;
    void recordPlaybackEvent("completed", currentTime, true);
  }, [currentTime, duration, playbackSession, recordPlaybackEvent]);

  useEffect(() => {
    if (isPlaying || !playbackSession) {
      return;
    }

    void recordPlaybackEvent("progress", currentTime, true);
  }, [currentTime, isPlaying, playbackSession, recordPlaybackEvent]);

  useEffect(() => {
    const flushProgress = () => {
      if (document.visibilityState === "hidden") {
        void recordPlaybackEvent("progress", currentTime, true);
      }
    };

    document.addEventListener("visibilitychange", flushProgress);
    window.addEventListener("pagehide", flushProgress);

    return () => {
      document.removeEventListener("visibilitychange", flushProgress);
      window.removeEventListener("pagehide", flushProgress);
    };
  }, [currentTime, recordPlaybackEvent]);

  const playTrack = useCallback(async (track: TrackSummary) => {
    if (track.id === activeTrack?.id && audioRef.current) {
      try {
        if (audioRef.current.paused) {
          await audioRef.current.play();
          setIsPlaying(true);
          syncProgress();
          startAnimationLoop();
        } else {
          audioRef.current.pause();
          setIsPlaying(false);
          stopAnimationLoop();
        }
      } catch (error) {
        setIsPlaying(false);
        toast.error(describePlaybackError(error));
      }
      return;
    }

    if (!session?.token) {
      return;
    }

    if (playbackSession) {
      await recordPlaybackEvent("progress", currentTime, true);
    }

    if (activeAdImpressionId) {
      void reportAdImpressionUpdate(activeAdImpressionId, {
        status: "skipped",
        reason: "Listener selected another track before the ad completed.",
      });
      clearActiveAdState();
    }

    try {
      const decision = await adsApi.getPlaybackDecision(session.token, track.id);

      if (!decision.serveAd || !decision.ad || !decision.impressionId) {
        await startTrackSession(track);
        return;
      }

      lastObservedPlaybackPositionRef.current = null;
      unreportedListenSecondsRef.current = 0;
      isReportingPlaybackRef.current = false;
      completionReportedRef.current = false;
      setActiveTrack(track);
      setPlaybackSession(null);
      setActiveAd(decision.ad);
      setActiveAdImpressionId(decision.impressionId);
      setPendingTrackAfterAd(track);
      setStreamUrl(decision.ad.audioUrl);
      void adsApi.startImpression(session.token, {
        impressionId: decision.impressionId,
      }).catch(() => {
        // Ignore impression start failures so music playback can continue.
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        toast.error("Your session expired. Please sign in again.");
        await logout();
        return;
      }

      await startTrackSession(track);
    }
  }, [
    activeAdImpressionId,
    activeTrack?.id,
    clearActiveAdState,
    logout,
    currentTime,
    playbackSession,
    recordPlaybackEvent,
    reportAdImpressionUpdate,
    session?.token,
    startTrackSession,
  ]);

  const activeTrackIndex = playbackQueue.findIndex(
    (track) => track.id === activeTrack?.id,
  );
  const canPlayPrevious = activeTrackIndex > 0;
  const canPlayNext =
    activeTrackIndex >= 0 && activeTrackIndex < playbackQueue.length - 1;

  const playPreviousTrack = useCallback(async () => {
    if (!canPlayPrevious) {
      return;
    }

    const previousTrack = playbackQueue[activeTrackIndex - 1];

    if (!previousTrack) {
      return;
    }

    await playTrack(previousTrack);
  }, [activeTrackIndex, canPlayPrevious, playbackQueue, playTrack]);

  const playNextTrack = useCallback(async () => {
    if (!canPlayNext) {
      return;
    }

    const nextTrack = playbackQueue[activeTrackIndex + 1];

    if (!nextTrack) {
      return;
    }

    await playTrack(nextTrack);
  }, [activeTrackIndex, canPlayNext, playbackQueue, playTrack]);

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (audio.paused) {
        await audio.play();
        setIsPlaying(true);
        syncProgress();
        startAnimationLoop();
      } else {
        audio.pause();
        setIsPlaying(false);
        stopAnimationLoop();
      }
    } catch (error) {
      setIsPlaying(false);
      toast.error(describePlaybackError(error));
    }
  }, []);

  const seekTo = (value: number) => {
    if (activeAd) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    lastObservedPlaybackPositionRef.current = value;
    setCurrentTime(value);
  };

  const skipBy = (delta: number) => {
    if (activeAd) return;
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Math.max(0, Math.min(duration || 0, audio.currentTime + delta));
    audio.currentTime = nextTime;
    lastObservedPlaybackPositionRef.current = nextTime;
    setCurrentTime(nextTime);
  };

  const setVolumeLevel = (value: number) => {
    setVolume(value);
    if (audioRef.current) {
      audioRef.current.volume = value;
    }
  };

  const dismissPlayback = useCallback(async () => {
    const audio = audioRef.current;

    await recordPlaybackEvent("progress", currentTime, true);

    if (activeAdImpressionId) {
      void reportAdImpressionUpdate(activeAdImpressionId, {
        status: "skipped",
        reason: "Listener dismissed the player before playback completed.",
      });
    }

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    stopAnimationLoop();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackSession(null);
    setStreamUrl(null);
    setActiveTrack(null);
    clearActiveAdState();
    lastObservedPlaybackPositionRef.current = null;
    unreportedListenSecondsRef.current = 0;
    isReportingPlaybackRef.current = false;
    completionReportedRef.current = false;
  }, [
    activeAdImpressionId,
    clearActiveAdState,
    currentTime,
    recordPlaybackEvent,
    reportAdImpressionUpdate,
  ]);

  const value = useMemo<GlobalPlaybackContextValue>(
    () => ({
      activeTrack,
      activeTrackId: activeTrack?.id ?? null,
      isPlaying,
      currentTime,
      duration,
      volume,
      canPlayPrevious,
      canPlayNext,
      playTrack,
      togglePlayback,
      playPreviousTrack,
      playNextTrack,
      dismissPlayback,
      seekTo,
      skipBy,
      setVolumeLevel,
      setPlaybackQueue,
    }),
    [
      activeTrack,
      isPlaying,
      currentTime,
      duration,
      volume,
      canPlayPrevious,
      canPlayNext,
      playTrack,
      togglePlayback,
      playPreviousTrack,
      playNextTrack,
      dismissPlayback,
      setPlaybackQueue,
    ],
  );

  return (
    <GlobalPlaybackContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" />
      <GlobalPlaybackBar
      activeTrack={activeTrack}
      isPlaying={isPlaying}
      currentTime={currentTime}
      duration={duration}
      volume={volume}
      canPlayPrevious={canPlayPrevious}
      canPlayNext={canPlayNext}
      isPlayingAd={Boolean(activeAd)}
      activeAd={activeAd}
      togglePlayback={togglePlayback}
      playPreviousTrack={playPreviousTrack}
      playNextTrack={playNextTrack}
      dismissPlayback={dismissPlayback}
        seekTo={seekTo}
        setVolumeLevel={setVolumeLevel}
      />
    </GlobalPlaybackContext.Provider>
  );
};

export const useGlobalPlayback = () => {
  const context = useContext(GlobalPlaybackContext);

  if (!context) {
    throw new Error("useGlobalPlayback must be used within GlobalPlaybackProvider");
  }

  return context;
};
