import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  listArtists: vi.fn(),
  listReleases: vi.fn(),
}));

vi.mock("@/features/users/lib/users-api", () => ({
  usersApi: { listArtists: mocks.listArtists },
}));
vi.mock("@/features/music/lib/releases-api", () => ({
  releasesApi: { listReleases: mocks.listReleases },
}));

import { ArtistsOverview } from "./artists-overview";

describe("ArtistsOverview", () => {
  beforeEach(() => {
    mocks.listArtists.mockResolvedValue([
      {
        id: "delight",
        walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        name: "Delight",
        genre: "Independent",
        city: "South Africa",
        monthlyListeners: "0",
        verified: false,
      },
      {
        id: "qa-listener",
        walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        name: "SOW2 QA Listener",
        genre: "Independent",
        city: "Remote",
        monthlyListeners: "0",
        verified: false,
      },
    ]);
    mocks.listReleases.mockResolvedValue([
      {
        id: "delight-single",
        artistId: "delight",
        artistName: "Delight",
        title: "Stayela",
        type: "single",
        status: "published",
        genre: "Hip-Hop",
        trackCount: 1,
      },
    ]);
  });

  afterEach(cleanup);

  it("shows artists with public releases and hides empty QA profiles", async () => {
    render(
      <MemoryRouter>
        <ArtistsOverview />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("link", { name: /Delight Independent/ }),
    ).toBeTruthy();
    expect(screen.queryByText("SOW2 QA Listener")).toBeNull();
  });
});
