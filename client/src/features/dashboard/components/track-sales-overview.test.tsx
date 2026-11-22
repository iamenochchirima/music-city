import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { TrackSalesOverview } from "./track-sales-overview";

const m = vi.hoisted(() => ({
  listTracks: vi.fn(),
  listAgreements: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: { token: "token" } }),
}));
vi.mock("@/features/music/lib/tracks-api", () => ({
  tracksApi: { listMyTracks: m.listTracks, updateTrackMonetization: vi.fn() },
}));
vi.mock("@/features/agreements/agreement-api", () => ({
  agreementApi: { list: m.listAgreements },
}));
vi.mock("@/features/agreements/use-owner-sale-agreement", () => ({
  useOwnerSaleAgreement: () => ({ start: vi.fn(), busy: false }),
}));

const track = (id: string, title: string, extra = {}) => ({
  id,
  title,
  artistId: "artist",
  artistName: "Artist",
  genre: "Pop",
  runtime: "3:00",
  priceLabel: "Published",
  status: "published",
  visibility: "published",
  plays: 0,
  likes: 0,
  playbackReady: true,
  purchaseEnabled: false,
  releaseId: "rel-1",
  releaseTitle: "First release",
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.listAgreements.mockResolvedValue({ items: [] });
});
afterEach(cleanup);

it("shows which songs can be sold and which need an agreement", async () => {
  m.listTracks.mockResolvedValue([
    track("a", "Ready song", { purchaseEnabled: true, purchasePrice: "5" }),
    track("b", "Blocked song"),
  ]);
  m.listAgreements.mockResolvedValue({
    items: [
      { id: "agreement-a", effectiveVersion: 1, context: { track: { id: "a" } } },
    ],
  });

  render(
    <MemoryRouter>
      <TrackSalesOverview />
    </MemoryRouter>,
  );

  expect(await screen.findByText("Ready song")).toBeTruthy();
  expect(screen.getByText("Agreement active")).toBeTruthy();
  expect(screen.getByText("Agreement needed")).toBeTruthy();
  const onSaleStat = screen.getByText("Songs on sale").closest("div")!;
  expect(within(onSaleStat).getByText("1")).toBeTruthy();

  const blockedRow = screen.getByText("Blocked song").closest("li")!;
  expect(
    within(blockedRow).getByText(/Finalize this song's royalty agreement/),
  ).toBeTruthy();
  expect(
    within(blockedRow).getByRole("checkbox").hasAttribute("disabled"),
  ).toBe(true);
});

it("points a song without an agreement at the agreement setup", async () => {
  m.listTracks.mockResolvedValue([track("b", "Blocked song")]);

  render(
    <MemoryRouter>
      <TrackSalesOverview />
    </MemoryRouter>,
  );

  expect(await screen.findByText("Blocked song")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Set up agreement" })).toBeTruthy();
});
