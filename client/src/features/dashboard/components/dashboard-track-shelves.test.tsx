import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { TrackSummary } from "@music-city/shared";
import { DashboardTrackShelves } from "./dashboard-track-shelves";

const mocks = vi.hoisted(() => ({
  play: vi.fn(),
  queue: vi.fn(),
  sync: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: { token: "token" } }),
}));
vi.mock("@/features/playback/providers/global-playback-provider", () => ({
  useGlobalPlayback: () => ({
    activeTrackId: null,
    playTrack: mocks.play,
    setPlaybackQueue: mocks.queue,
  }),
}));
vi.mock("@/features/music/lib/tracks-api", () => ({
  tracksApi: { listMyTracks: mocks.sync },
}));
const ready = {
  id: "ready",
  title: "Playable recording",
  artistName: "Artist",
  runtime: "1:00",
  genre: "Pop",
  playbackReady: true,
} as TrackSummary;
const processing = {
  ...ready,
  id: "processing",
  title: "Processing recording",
  playbackReady: false,
  status: "processing",
} as TrackSummary;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.sync.mockResolvedValue([{ ...processing, playbackReady: true }]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("plays ready recordings and updates processing status without a refresh action", async () => {
  const user = userEvent.setup();
  const onSynced = vi.fn();
  render(
    <MemoryRouter>
      <DashboardTrackShelves
        tracks={[ready, processing]}
        onTrackSynced={onSynced}
        onTrackDeleted={vi.fn()}
      />
    </MemoryRouter>,
  );
  await user.click(
    screen.getByRole("button", { name: "Play Playable recording" }),
  );
  expect(mocks.play).toHaveBeenCalledWith(ready);
  expect(
    screen.queryByRole("button", { name: "Play Processing recording" }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", {
      name: "Refresh Processing recording status",
    }),
  ).toBeNull();
  await waitFor(() => expect(mocks.sync).toHaveBeenCalled(), { timeout: 6500 });
  expect(onSynced).toHaveBeenCalledWith(
    expect.objectContaining({ id: "processing", playbackReady: true }),
  );
  expect(mocks.sync).toHaveBeenCalledWith("token");
  expect(mocks.queue).toHaveBeenCalledWith([ready]);
}, 10000);
