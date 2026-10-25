import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { TrackSummary } from "@music-city/shared";
import { TrackTable } from "./track-table";
import { TrackDetailOverview } from "./track-detail-overview";

const api = vi.hoisted(() => ({ getTrack: vi.fn(), getArtistProfile: vi.fn() }));
vi.mock("@/features/music/lib/tracks-api", () => ({ tracksApi: { getTrack: api.getTrack } }));
vi.mock("@/features/users/lib/users-api", () => ({ usersApi: { getArtistProfile: api.getArtistProfile } }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: null }) }));
vi.mock("@/features/support/support-controls", () => ({ TrackSupport: () => null }));
vi.mock("./track-commerce-actions", () => ({ TrackCommerceActions: () => null }));
vi.mock("./save-to-playlist-button", () => ({ SaveToPlaylistButton: () => null }));

const track = (plays: number): TrackSummary => ({
  id: "song", title: "Test song", artistId: "artist", artistName: "Artist",
  genre: "Jazz", runtime: "3:00", priceLabel: "Free", status: "published", plays, likes: 0,
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it.each([[0, "0 streams"], [1, "1 stream"], [12345, "12,345 streams"]])(
  "shows %s streams in track listings",
  (plays, label) => {
    render(<TrackTable tracks={[track(plays)]} renderAction={() => <button>Play</button>} />);
    expect(screen.getByText(label)).toBeTruthy();
  },
);

it("shows the API stream total in song details, including zero", async () => {
  api.getTrack.mockResolvedValue(track(0));
  api.getArtistProfile.mockResolvedValue(null);
  render(<MemoryRouter><TrackDetailOverview trackId="song" /></MemoryRouter>);
  const label = await screen.findByText("Streams");
  expect(label.parentElement?.textContent).toBe("Streams0");
});
