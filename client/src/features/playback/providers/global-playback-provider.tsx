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
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { adsApi } from "@/features/ads/lib/ads-api";
import { engagementApi } from "@/features/engagement/lib/engagement-api";
import { playbackApi } from "@/features/playback/lib/playback-api";
import { useAuth } from "@/hooks/use-auth";
import { ApiClientError } from "@/lib/api/http-client";
import { cn } from "@/lib/utils";

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
  if (!activeTrack) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(1180px,calc(100vw-2rem))] -translate-x-1/2 rounded-[32px] border border-white/10 bg-[#0d1324]/96 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_180px] lg:items-center">
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
            <TrackArt track={activeTrack} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
          </div>
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-lg font-semibold text-white">{activeTrack.title}</p>
              <p className="truncate text-sm text-slate-400">{activeTrack.artistName}</p>
              <div
                className={cn(
                  "flex items-center gap-2 text-xs uppercase tracking-[0.22em]",
                  isPlayingAd ? "text-amber-300" : "text-emerald-300",
                )}
              >
                <Music2 className="h-3.5 w-3.5" />
                {isPlayingAd
                  ? `Sponsored${activeAd?.brandName ? ` · ${activeAd.brandName}` : ""}`
                  : "Now playing"}
              </div>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              onClick={() => void dismissPlayback()}
              aria-label="Close player"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="space-y-4 rounded-[26px] border border-white/10 bg-black/20 px-4 py-4">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canPlayPrevious}
              onClick={() => void playPreviousTrack()}
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-lg transition hover:bg-emerald-300"
              onClick={() => void togglePlayback()}
            >
              {isPlaying ? (
                <Pause className="h-6 w-6 fill-current" />
              ) : (
                <Play className="h-6 w-6 fill-current" />
              )}
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canPlayNext}
              onClick={() => void playNextTrack()}
            >
              <SkipForward className="h-4 w-4" />
            </button>
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
              className="h-2 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background: buildRangeBackground(
                  Math.min(currentTime, duration || 0),
                  Math.max(duration, 0),
                  "#34d399",
                ),
              }}
            />
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{formatClock(currentTime)}</span>
              <span>{formatClock(duration)}</span>
            </div>
          </div>
        </div>
        <div className="rounded-[26px] border border-white/10 bg-black/20 px-4 py-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              {volume === 0 ? (
                <VolumeX className="h-4 w-4 text-slate-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-slate-400" />
              )}
              <span>Volume</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => setVolumeLevel(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background: buildRangeBackground(volume, 1, "#34d399"),
              }}
            />
            <p className="text-xs text-slate-500">
              {isPlayingAd
                ? "Sponsored preroll is playing before the selected track."
                : "Private preview stream for this release."}
            </p>
          </div>
        </div>
      </div>
    </div>
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
  const lastReportedProgressRef = useRef(0);
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

    setCurrentTime(audio.currentTime || 0);

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
        lastReportedProgressRef.current = 0;
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

        if (error instanceof ApiClientError && error.status === 403) {
          if (track.access === "purchase_required") {
            toast.error("Buy this track first to unlock playback.");
            return;
          }

          if (track.access === "subscribers") {
            toast.error("Subscribe to Music City Pass first to unlock playback.");
            return;
          }
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
    async (eventType: "progress" | "completed", positionSeconds: number) => {
      if (!session?.token || !playbackSession) {
        return;
      }

      try {
        const updatedSession = await engagementApi.recordPlaybackEvent(
          session.token,
          playbackSession,
          {
            eventType,
            positionSeconds,
            durationSeconds: duration > 0 ? duration : undefined,
          },
        );

        setPlaybackSession(updatedSession);
      } catch {
        // Ignore analytics delivery failures so they never interrupt playback.
      }
    },
    [duration, playbackSession, session?.token],
  );

  useEffect(() => {
    if (!playbackSession || !isPlaying) {
      return;
    }

    if (currentTime - lastReportedProgressRef.current < 15) {
      return;
    }

    lastReportedProgressRef.current = currentTime;
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
    void recordPlaybackEvent("completed", currentTime);
  }, [currentTime, duration, playbackSession, recordPlaybackEvent]);

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

      lastReportedProgressRef.current = 0;
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
    setCurrentTime(value);
  };

  const skipBy = (delta: number) => {
    if (activeAd) return;
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Math.max(0, Math.min(duration || 0, audio.currentTime + delta));
    audio.currentTime = nextTime;
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
    lastReportedProgressRef.current = 0;
    completionReportedRef.current = false;
  }, [activeAdImpressionId, clearActiveAdState, reportAdImpressionUpdate]);

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
