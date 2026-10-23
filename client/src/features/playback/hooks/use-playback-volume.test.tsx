import { afterEach, beforeEach, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { usePlaybackVolume } from "./use-playback-volume";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it("applies volume and mute to the audio element and restores the previous level", () => {
  const audio = document.createElement("audio");
  const ref = { current: audio };
  const { result } = renderHook(() => usePlaybackVolume(ref));
  act(() => result.current.setVolumeLevel(0.35));
  expect(audio.volume).toBe(0.35);
  act(() => result.current.toggleMute());
  expect(audio.muted).toBe(true);
  expect(audio.volume).toBe(0);
  act(() => result.current.toggleMute());
  expect(audio.muted).toBe(false);
  expect(audio.volume).toBe(0.35);
});

it("retains the volume and unmute level after a reload", () => {
  const first = renderHook(() => usePlaybackVolume({ current: document.createElement("audio") }));
  act(() => first.result.current.setVolumeLevel(0.4));
  act(() => first.result.current.toggleMute());
  first.unmount();
  const audio = document.createElement("audio");
  const second = renderHook(() => usePlaybackVolume({ current: audio }));
  expect(audio.muted).toBe(true);
  act(() => second.result.current.toggleMute());
  expect(audio.volume).toBe(0.4);
});

it("rejects corrupt storage and clamps out-of-range levels", () => {
  localStorage.setItem("music-city-playback-volume", "broken");
  const audio = document.createElement("audio");
  const { result } = renderHook(() => usePlaybackVolume({ current: audio }));
  expect(audio.volume).toBe(0.85);
  act(() => result.current.setVolumeLevel(2));
  expect(audio.volume).toBe(1);
  act(() => result.current.setVolumeLevel(-1));
  expect(audio.volume).toBe(0);
});
