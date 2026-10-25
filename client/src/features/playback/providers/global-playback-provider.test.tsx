import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { TrackGrid } from "@/features/music/components/track-grid";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TrackSummary } from "@music-city/shared";
import { GlobalPlaybackProvider, useGlobalPlayback } from "./global-playback-provider";

const m = vi.hoisted(() => ({ create: vi.fn(), record: vi.fn(), preload: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: null, logout: vi.fn(), connectWallet: vi.fn() }) }));
vi.mock("@/features/playback/lib/playback-api", () => ({ playbackApi: { createSession: m.create, preloadTracks: m.preload, preloadTrackIds: vi.fn() } }));
vi.mock("@/features/engagement/lib/engagement-api", () => ({ engagementApi: { recordPlaybackEvent: m.record } }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
const song = (id: string, ready = true) => ({ id, title: id, artistName: "Artist", playbackReady: ready, runtime: "2:00", plays: 0 }) as TrackSummary;
const queue = [song("one"), song("processing", false), song("two")];
function Controls() {
  const player = useGlobalPlayback();
  return <><button onClick={() => { player.setPlaybackQueue(queue); void player.playTrack(queue[0]); }}>Start release</button><button onClick={() => void player.playTrack(queue[2])}>Replay last song</button><button onClick={() => void player.togglePlayback()}>Toggle player</button><span data-testid="active">{player.activeTrackId}</span></>;
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  m.create.mockImplementation(async (_token, id) => ({ id: `session-${id}-${m.create.mock.calls.length}`, trackId: id, streamUrl: `https://media.test/${id}.mp3`, isGuest: true, guestBudgetRemainingSeconds: 1500, guestTrackDurationSeconds: 120, guestRemainingSeconds: 120 }));
  m.record.mockImplementation(async (_token, session) => session);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function (this: HTMLMediaElement) { this.dispatchEvent(new Event("play")); });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) { this.dispatchEvent(new Event("pause")); });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("automatically advances through ready songs and stops at the end of the release", async () => {
  const { container } = render(<GlobalPlaybackProvider><Controls /></GlobalPlaybackProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Start release" }));
  await vi.waitFor(() => expect(screen.getByTestId("active").textContent).toBe("one"));
  const audio = container.querySelector("audio")!;
  await act(async () => { fireEvent.ended(audio); });
  await vi.waitFor(() => expect(screen.getByTestId("active").textContent).toBe("two"));
  expect(m.create.mock.calls.map((args) => args[1])).toEqual(["one", "two"]);
  await act(async () => { fireEvent.ended(audio); });
  expect(m.create).toHaveBeenCalledTimes(2);
});

it("does not advance when the guest listening budget is exhausted", async () => {
  m.create.mockResolvedValue({ id: "session-one", trackId: "one", streamUrl: "https://media.test/one.mp3", isGuest: true, guestBudgetRemainingSeconds: 10, guestTrackDurationSeconds: 120, guestRemainingSeconds: 10 });
  const { container } = render(<GlobalPlaybackProvider><Controls /></GlobalPlaybackProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Start release" }));
  await vi.waitFor(() => expect(screen.getByTestId("active").textContent).toBe("one"));
  await act(async () => { fireEvent.ended(container.querySelector("audio")!); });
  expect(m.create).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("dialog", { name: "Keep listening" })).toBeTruthy();
});

it("keeps the release queue when another catalog mounts during playback", async () => {
  function Browse() {
    const [browsing, setBrowsing] = useState(false);
    return <><Controls /><button onClick={() => setBrowsing(true)}>Browse music</button>{browsing ? <TrackGrid tracks={[song("unrelated")]} /> : null}</>;
  }
  const { container } = render(<MemoryRouter><GlobalPlaybackProvider><Browse /></GlobalPlaybackProvider></MemoryRouter>);
  await userEvent.click(screen.getByRole("button", { name: "Start release" }));
  await vi.waitFor(() => expect(screen.getByTestId("active").textContent).toBe("one"));
  await userEvent.click(screen.getByRole("button", { name: "Browse music" }));
  await act(async () => { fireEvent.ended(container.querySelector("audio")!); });
  await vi.waitFor(() => expect(screen.getByTestId("active").textContent).toBe("two"));
});

it.each(["Replay last song", "Toggle player"])("starts a fresh session after completion using %s", async (button) => {
  const { container } = render(<GlobalPlaybackProvider><Controls /></GlobalPlaybackProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Replay last song" }));
  const audio = container.querySelector("audio")!;
  Object.defineProperty(audio, "ended", { configurable: true, value: true });
  await act(async () => { fireEvent.ended(audio); });
  await userEvent.click(screen.getByRole("button", { name: button }));
  expect(m.create.mock.calls.map((args) => args[1])).toEqual(["two", "two"]);
  expect(m.record.mock.calls.some((args) => args[2].eventType === "completed")).toBe(true);
});

it("resumes a paused song without creating another listening session", async () => {
  render(<GlobalPlaybackProvider><Controls /></GlobalPlaybackProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Replay last song" }));
  await userEvent.click(screen.getByRole("button", { name: "Replay last song" }));
  expect(m.create).toHaveBeenCalledTimes(1);
});

it("credits a delayed background update and refreshes visible stream counts", async () => {
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  let clockOffset = 0;
  const realNow = performance.now.bind(performance);
  vi.spyOn(performance, "now").mockImplementation(() => realNow() + clockOffset);
  m.record.mockImplementation(async (_token, session, input) => ({ ...session, listenedSeconds: input.listenedSeconds, streamCount: 1 }));
  const { container } = render(<MemoryRouter><GlobalPlaybackProvider><Controls /><TrackGrid tracks={[queue[0]]} /></GlobalPlaybackProvider></MemoryRouter>);
  await userEvent.click(screen.getByRole("button", { name: "Start release" }));
  const audio = container.querySelector("audio")!;
  Object.defineProperty(audio, "paused", { configurable: true, value: false });
  clockOffset = 45_000;
  audio.currentTime = 45;
  await act(async () => { fireEvent.timeUpdate(audio); });
  await vi.waitFor(() => expect(m.record).toHaveBeenCalled());
  expect(m.record.mock.calls[0][2].listenedSeconds).toBeCloseTo(45, 0);
  expect(screen.getByText("1 stream")).toBeTruthy();
});

it("does not credit a seek as listening time", async () => {
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  let clockOffset = 0;
  const realNow = performance.now.bind(performance);
  vi.spyOn(performance, "now").mockImplementation(() => realNow() + clockOffset);
  const { container } = render(<GlobalPlaybackProvider><Controls /></GlobalPlaybackProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Start release" }));
  const audio = container.querySelector("audio")!;
  Object.defineProperty(audio, "paused", { configurable: true, value: false });
  audio.currentTime = 90;
  act(() => { fireEvent.seeking(audio); fireEvent.timeUpdate(audio); });
  clockOffset = 1000;
  audio.currentTime = 91;
  act(() => { fireEvent.timeUpdate(audio); });
  act(() => { fireEvent.click(screen.getByRole("button", { name: "Replay last song" })); });
  await vi.waitFor(() => expect(m.record).toHaveBeenCalled());
  expect(m.record.mock.calls[0][2].listenedSeconds).toBeCloseTo(1, 0);
});

it("sends the first progress report at five seconds, not before", async () => {
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  let clockOffset = 0;
  const realNow = performance.now.bind(performance);
  vi.spyOn(performance, "now").mockImplementation(() => realNow() + clockOffset);
  const { container } = render(<GlobalPlaybackProvider><Controls /></GlobalPlaybackProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Start release" }));
  const audio = container.querySelector("audio")!;
  Object.defineProperty(audio, "paused", { configurable: true, value: false });
  clockOffset = 4900;
  audio.currentTime = 4.9;
  act(() => { fireEvent.timeUpdate(audio); });
  expect(m.record).not.toHaveBeenCalled();
  clockOffset = 5000;
  audio.currentTime = 5;
  act(() => { fireEvent.timeUpdate(audio); });
  await vi.waitFor(() => expect(m.record).toHaveBeenCalledTimes(1));
  expect(m.record.mock.calls[0][2].listenedSeconds).toBeCloseTo(5, 1);
});

it("waits for an in-flight progress report before switching sessions", async () => {
  let clockOffset = 0;
  const realNow = performance.now.bind(performance);
  vi.spyOn(performance, "now").mockImplementation(() => realNow() + clockOffset);
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  let finish!: () => void;
  m.record.mockImplementationOnce((_token, session) => new Promise((resolve) => {
    finish = () => resolve({ ...session, listenedSeconds: 20, streamCount: 1 });
  }));
  const { container } = render(<GlobalPlaybackProvider><Controls /></GlobalPlaybackProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Start release" }));
  const audio = container.querySelector("audio")!;
  Object.defineProperty(audio, "paused", { configurable: true, value: false });
  clockOffset = 20_000;
  audio.currentTime = 20;
  act(() => { fireEvent.timeUpdate(audio); });
  expect(m.record).toHaveBeenCalledTimes(1);
  act(() => { fireEvent.click(screen.getByRole("button", { name: "Replay last song" })); });
  expect(m.create).toHaveBeenCalledTimes(1);
  act(() => { finish(); });
  await vi.waitFor(() => expect(m.create).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId("active").textContent).toBe("two");
});
