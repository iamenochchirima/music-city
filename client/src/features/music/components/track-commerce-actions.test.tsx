import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TrackSummary } from "@music-city/shared";
import { TrackCommerceActions } from "./track-commerce-actions";
const m = vi.hoisted(() => ({ list: vi.fn(), checkout: vi.fn(), play: vi.fn(), preload: vi.fn(), session: { token: "token" } as { token: string } | null }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: m.session }),
}));
vi.mock("@/features/payments/lib/payments-api", () => ({
  paymentsApi: { listMine: m.list },
}));
vi.mock("@/features/payments/hooks/use-stellar-checkout", () => ({
  useStellarCheckout: () => m.checkout,
}));
vi.mock("@/features/playback/providers/global-playback-provider", () => ({
  useGlobalPlayback: () => ({ playTrack: m.play, setPlaybackQueue: vi.fn() }),
}));
vi.mock("@/features/playback/lib/playback-api", () => ({ playbackApi: { preloadTracks: m.preload } }));
const track = {
  id: "track",
  purchaseEnabled: true,
  purchasePrice: "1",
  purchaseAssetCode: "USDC",
} as TrackSummary;
beforeEach(() => { vi.clearAllMocks(); m.session = { token: "token" }; });
afterEach(cleanup);
it("shows a retained purchase after reopening without offering another payment", async () => {
  m.list.mockResolvedValue([
    { trackId: "track", productType: "track_purchase", status: "confirmed" },
  ]);
  render(<TrackCommerceActions track={track} />);
  await screen.findByText("Purchased");
  expect(screen.queryByRole("button", { name: "Buy 1 USDC" })).toBeNull();
  expect(m.checkout).not.toHaveBeenCalled();
});
it("does not treat another song or unconfirmed payment as ownership", async () => {
  m.list.mockResolvedValue([
    { trackId: "other", productType: "track_purchase", status: "confirmed" },
    { trackId: "track", productType: "track_purchase", status: "pending" },
  ]);
  render(<TrackCommerceActions track={track} />);
  const button = await screen.findByRole("button", { name: "Buy 1 USDC" });
  await vi.waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  expect(screen.queryByText("Purchased")).toBeNull();
});

it("lets a guest play a ready song through the shared player", async () => {
  m.session = null;
  render(<TrackCommerceActions track={{ ...track, purchaseEnabled: false, playbackReady: true }} />);
  const play = screen.getByRole("button", { name: "Play" });
  expect(play.hasAttribute("disabled")).toBe(false);
  await userEvent.click(play);
  expect(m.play).toHaveBeenCalledWith(expect.objectContaining({ id: "track" }));
});
it("keeps unprocessed audio unavailable to guests", () => {
  m.session = null;
  render(<TrackCommerceActions track={{ ...track, purchaseEnabled: false, playbackReady: false }} />);
  expect(screen.getByRole("button", { name: "Play" }).hasAttribute("disabled")).toBe(true);
});
