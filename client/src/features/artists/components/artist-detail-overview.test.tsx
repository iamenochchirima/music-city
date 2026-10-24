import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReleaseSummary } from "@music-city/shared";
import { ArtistDetailOverview } from "./artist-detail-overview";

const api = vi.hoisted(() => ({
  getArtistProfile: vi.fn(),
  getArtistReleases: vi.fn(),
  getArtistTracks: vi.fn(),
}));
vi.mock("@/features/users/lib/users-api", () => ({ usersApi: api }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: null }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/features/support/support-controls", () => ({ ArtistSupport: () => null }));
vi.mock("@/features/music/components/track-grid", () => ({ TrackGrid: () => null }));
vi.mock("@/features/music/components/release-play-button", () => ({
  ReleasePlayButton: ({ title }: { title: string }) => <button>Play {title}</button>,
}));

const release = (id: string, type: ReleaseSummary["type"], status: ReleaseSummary["status"] = "published"): ReleaseSummary => ({
  id, title: id, type, status, artistId: "artist", artistName: "Artist", genre: "Jazz", trackCount: 1,
});
const renderArtist = () => render(<MemoryRouter><ArtistDetailOverview artistId="artist" /></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks();
  api.getArtistProfile.mockResolvedValue({ id: "artist", displayName: "Artist", followerCount: 0 });
  api.getArtistTracks.mockResolvedValue([]);
  api.getArtistReleases.mockResolvedValue([]);
});
afterEach(cleanup);

it("shows a single once and hides empty release categories", async () => {
  api.getArtistReleases.mockResolvedValue([release("Stayela", "single")]);
  renderArtist();
  await screen.findByRole("heading", { name: "Singles" });
  expect(screen.getAllByRole("link", { name: "Stayela" })).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Play Stayela" })).toBeTruthy();
  for (const name of ["Albums", "EPs", "Latest releases", "Upcoming releases"]) {
    expect(screen.queryByRole("heading", { name })).toBeNull();
  }
});

it("shows every published release once in its category, including releases beyond the latest three", async () => {
  const releases = [release("Album one", "album"), release("Album two", "album"), release("EP one", "ep"), release("Single one", "single")];
  api.getArtistReleases.mockResolvedValue(releases);
  renderArtist();
  await screen.findByRole("heading", { name: "Albums" });
  for (const item of releases) {
    const category = item.type === "album" ? "Albums" : item.type === "ep" ? "EPs" : "Singles";
    const section = screen.getByRole("heading", { name: category }).closest("section")!;
    expect(within(section).getByRole("link", { name: item.title })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: item.title })).toHaveLength(1);
  }
});

it("shows scheduled releases only under upcoming and excludes private releases", async () => {
  api.getArtistReleases.mockResolvedValue([
    release("Coming soon", "album", "scheduled"),
    release("Private draft", "ep", "draft"),
    release("Old release", "single", "archived"),
  ]);
  renderArtist();
  await screen.findByRole("heading", { name: "Upcoming releases" });
  expect(screen.getAllByRole("link", { name: "Coming soon" })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Play Coming soon" })).toBeNull();
  for (const name of ["Albums", "EPs", "Singles"]) expect(screen.queryByRole("heading", { name })).toBeNull();
  expect(screen.queryByRole("link", { name: "Private draft" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Old release" })).toBeNull();
});

it("shows one empty discography message without empty release sections", async () => {
  renderArtist();
  expect(await screen.findByText("No releases yet.")).toBeTruthy();
  for (const name of ["Albums", "EPs", "Singles", "Latest releases", "Upcoming releases"]) {
    expect(screen.queryByRole("heading", { name })).toBeNull();
  }
});
