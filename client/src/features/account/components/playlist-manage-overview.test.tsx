import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PlaylistDetail } from "@music-city/shared";
import { PlaylistManageOverview } from "./playlist-manage-overview";

const mocks = vi.hoisted(() => ({
  auth: { session: null as unknown, isLoading: true },
  getManagePlaylist: vi.fn(),
  listTracks: vi.fn(),
  listMyTracks: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/features/music/lib/playlists-api", () => ({
  playlistsApi: { getManagePlaylist: mocks.getManagePlaylist },
}));
vi.mock("@/features/music/lib/tracks-api", () => ({
  tracksApi: { listTracks: mocks.listTracks, listMyTracks: mocks.listMyTracks },
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth = { session: null, isLoading: true };
  mocks.getManagePlaylist.mockReturnValue(new Promise(() => {}));
  mocks.listTracks.mockResolvedValue([]);
  mocks.listMyTracks.mockResolvedValue([]);
});

it("keeps a private playlist deep link loading while Sandbox auth and its record recover", async () => {
  let resolvePlaylist!: (playlist: PlaylistDetail) => void;
  const playlistRequest = new Promise<PlaylistDetail>((resolve) => {
    resolvePlaylist = resolve;
  });
  mocks.getManagePlaylist.mockReturnValueOnce(playlistRequest);

  const { rerender } = render(
    <MemoryRouter>
      <PlaylistManageOverview playlistId="playlist-1" />
    </MemoryRouter>,
  );

  expect(screen.getByText("Loading playlist details...")).toBeTruthy();
  expect(mocks.getManagePlaylist).not.toHaveBeenCalled();

  mocks.auth = { session: { token: "sandbox-session" }, isLoading: false };
  rerender(
    <MemoryRouter>
      <PlaylistManageOverview playlistId="playlist-1" />
    </MemoryRouter>,
  );

  expect(screen.getByText("Loading playlist details...")).toBeTruthy();
  expect(screen.queryByText("Playlist not found.")).toBeNull();
  expect(mocks.getManagePlaylist).toHaveBeenCalledWith("sandbox-session", "playlist-1");

  const playlist: PlaylistDetail = {
    id: "playlist-1",
    ownerUserId: "artist-1",
    ownerDisplayName: "Sandbox artist",
    title: "Private test playlist",
    visibility: "private",
    trackCount: 0,
    tracks: [],
    createdAt: "2026-10-29T00:00:00.000Z",
    updatedAt: "2026-10-29T00:00:00.000Z",
  };

  await act(async () => {
    resolvePlaylist(playlist);
    await playlistRequest;
  });
  expect(screen.getByRole("heading", { name: "Private test playlist" })).toBeTruthy();
});
