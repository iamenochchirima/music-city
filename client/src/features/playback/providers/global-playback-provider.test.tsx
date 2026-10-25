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
  return <><button onClick={() => { player.setPlaybackQueue(queue); void player.playTrack(queue[0]); }}>Start release</button><span data-testid="active">{player.activeTrackId}</span></>;
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  m.create.mockImplementation(async (_token, id) => ({ id: `session-${id}`, trackId: id, streamUrl: `https://media.test/${id}.mp3`, isGuest: true, guestBudgetRemainingSeconds: 1500, guestTrackDurationSeconds: 120, guestRemainingSeconds: 120 }));
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
