import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  listTracks: vi.fn(),
  listReleases: vi.fn(),
  listPlaylists: vi.fn(),
  listArtists: vi.fn(),
}));

vi.mock("@/features/music/lib/tracks-api", () => ({
  tracksApi: { listTracks: mocks.listTracks },
}));
vi.mock("@/features/music/lib/releases-api", () => ({
  releasesApi: { listReleases: mocks.listReleases },
}));
vi.mock("@/features/music/lib/playlists-api", () => ({
  playlistsApi: { listPlaylists: mocks.listPlaylists },
}));
vi.mock("@/features/users/lib/users-api", () => ({
  usersApi: { listArtists: mocks.listArtists },
}));

vi.mock("@/features/music/components/track-grid", () => ({
  TrackGrid: () => <div>tracks</div>,
}));
vi.mock("@/features/music/components/release-grid", () => ({
  ReleaseGrid: () => <div>releases</div>,
}));
vi.mock("@/features/music/components/playlist-grid", () => ({
  PlaylistGrid: () => <div>playlists</div>,
}));
vi.mock("@/features/music/components/artist-grid", () => ({
  ArtistGrid: () => <div>artists</div>,
}));

import { DiscoverOverview } from "./discover-overview";

const open = () => render(<MemoryRouter><DiscoverOverview /></MemoryRouter>);

describe("DiscoverOverview", () => {
  beforeEach(() => {
    mocks.listTracks.mockResolvedValue([]);
    mocks.listReleases.mockResolvedValue([]);
    mocks.listPlaylists.mockResolvedValue([]);
    mocks.listArtists.mockResolvedValue([]);
  });

  it("hides categories that have no content", async () => {
    open();

    await waitFor(() => expect(screen.queryByText("Loading catalog...")).toBeNull());
    expect(screen.queryByRole("heading", { name: "Upcoming countdowns" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Latest live releases" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Featured tracks" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Community playlists" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Artists in motion" })).toBeNull();
  });

  it("shows a category when it has content", async () => {
    mocks.listPlaylists.mockResolvedValue([{ id: "playlist-1" }]);
    open();

    expect(await screen.findByRole("heading", { name: "Community playlists" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Latest live releases" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Featured tracks" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Artists in motion" })).toBeNull();
  });

  it("does not show the artist section when listed profiles have no public releases", async () => {
    mocks.listArtists.mockResolvedValue([{ id: "qa-profile" }]);
    mocks.listReleases.mockResolvedValue([
      { id: "draft-release", artistId: "qa-profile", status: "draft" },
    ]);
    open();

    await waitFor(() => expect(screen.queryByText("Loading catalog...")).toBeNull());
    expect(screen.queryByRole("heading", { name: "Artists in motion" })).toBeNull();
  });
});
