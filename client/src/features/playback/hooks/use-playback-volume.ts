import { useEffect, useState, type RefObject } from "react";

const STORAGE_KEY = "music-city-playback-volume";
const DEFAULT_VOLUME = 0.85;
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : DEFAULT_VOLUME;

export function usePlaybackVolume(audioRef: RefObject<HTMLAudioElement | null>) {
  const [preference, setPreference] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved && typeof saved.volume === "number" && typeof saved.audibleVolume === "number") {
        return { volume: clamp(saved.volume), audibleVolume: clamp(saved.audibleVolume) || DEFAULT_VOLUME };
      }
    } catch {}
    return { volume: DEFAULT_VOLUME, audibleVolume: DEFAULT_VOLUME };
  });

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = preference.volume;
      audioRef.current.muted = preference.volume === 0;
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preference)); } catch {}
  }, [audioRef, preference]);

  const setVolumeLevel = (value: number) => {
    const volume = clamp(value);
    setPreference((current) => ({ volume, audibleVolume: volume > 0 ? volume : current.audibleVolume }));
  };
  const toggleMute = () => setPreference((current) => ({
    ...current,
    volume: current.volume > 0 ? 0 : current.audibleVolume,
  }));

  return { volume: preference.volume, setVolumeLevel, toggleMute };
}
