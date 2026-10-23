import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import type { ReleaseDetail, TrackSummary } from "@music-city/shared";
import { ReleaseGrid } from "./release-grid";

const m = vi.hoisted(() => ({ get: vi.fn(), play: vi.fn(), queue: vi.fn(), toggle: vi.fn(), preload: vi.fn(), activeTrackId: null as string | null, isPlaying: false, currentTime: 0, duration: 120 }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: null }) }));
vi.mock("@/features/music/lib/releases-api", () => ({ releasesApi: { getRelease: m.get } }));
vi.mock("@/features/playback/lib/playback-api", () => ({ playbackApi: { preloadTracks: m.preload } }));
vi.mock("@/features/playback/providers/global-playback-provider", () => ({ useGlobalPlayback: () => ({ activeTrackId: m.activeTrackId, isPlaying: m.isPlaying, currentTime: m.currentTime, duration: m.duration, playTrack: m.play, setPlaybackQueue: m.queue, togglePlayback: m.toggle }) }));
const song = (id: string, ready = true) => ({ id, title: id, playbackReady: ready, visibility: "published" }) as TrackSummary;
const release = {
  id: "release", title: "New album", type: "album", artistName: "Artist", genre: "Jazz", status: "published", trackCount: 3,
  tracks: [
    { trackId: "last", discNumber: 2, trackNumber: 1, track: song("last") },
    { trackId: "second", discNumber: 1, trackNumber: 2, track: song("second") },
    { trackId: "first", discNumber: 1, trackNumber: 1, track: song("first") },
    { trackId: "processing", discNumber: 1, trackNumber: 3, track: song("processing", false) },
  ],
} as ReleaseDetail;
beforeEach(() => { vi.clearAllMocks(); m.activeTrackId = null; m.isPlaying = false; m.currentTime = 0; m.get.mockResolvedValue(release); });
afterEach(cleanup);

it("plays a live release directly as a guest, in disc and track order", async () => {
  render(<MemoryRouter><ReleaseGrid releases={[release]} /></MemoryRouter>);
  const button = screen.getByRole("button", { name: "Play New album" });
  expect(button.closest("a")).toBeNull();
  expect(screen.getByRole("link", { name: "New album" }).getAttribute("href")).toBe("/releases/release");
  await userEvent.click(button);
  expect(m.queue).toHaveBeenCalledWith([song("first"), song("second"), song("last")]);
  expect(m.play).toHaveBeenCalledWith(song("first"));
  expect(m.preload).toHaveBeenCalledWith(undefined, [song("first"), song("second"), song("last")]);
});

it("pauses the current release without restarting its first song", async () => {
  m.activeTrackId = "second"; m.isPlaying = true;
  render(<MemoryRouter><ReleaseGrid releases={[release]} /></MemoryRouter>);
  await userEvent.click(screen.getByRole("button", { name: "Play New album" }));
  expect(m.toggle).toHaveBeenCalledOnce();
  expect(m.play).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Pause New album" })).toBeTruthy();
});

it("keeps upcoming releases as details links without a play action", () => {
  render(<MemoryRouter><ReleaseGrid releases={[{ ...release, status: "scheduled" }]} /></MemoryRouter>);
  expect(screen.queryByRole("button", { name: "Play New album" })).toBeNull();
  expect(screen.getByRole("link", { name: "New album" })).toBeTruthy();
  expect(m.get).not.toHaveBeenCalled();
});

it("shows a loading state during preparation and does not duplicate clicks", async () => {
  let resolve!: (value: ReleaseDetail) => void;
  m.get.mockReturnValue(new Promise<ReleaseDetail>((done) => { resolve = done; }));
  render(<MemoryRouter><ReleaseGrid releases={[release]} /></MemoryRouter>);
  const button = screen.getByRole("button", { name: "Play New album" });
  await userEvent.click(button);
  expect(button.hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("Starting…")).toBeTruthy();
  await userEvent.click(button);
  expect(m.get).toHaveBeenCalledOnce();
  resolve(release);
  await vi.waitFor(() => expect(m.play).toHaveBeenCalledOnce());
});

it("restarts the release from its first song after the final song ends", async () => {
  m.activeTrackId = "last"; m.currentTime = 120;
  render(<MemoryRouter><ReleaseGrid releases={[release]} /></MemoryRouter>);
  await userEvent.click(screen.getByRole("button", { name: "Play New album" }));
  expect(m.play).toHaveBeenCalledWith(song("first"));
  expect(m.toggle).not.toHaveBeenCalled();
});
