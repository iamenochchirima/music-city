import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TrackSummary } from "@music-city/shared";
import { TrackCommerceActions } from "./track-commerce-actions";
const m = vi.hoisted(() => ({ list: vi.fn(), download: vi.fn(), checkout: vi.fn(), play: vi.fn(), preload: vi.fn(), session: { token: "token" } as { token: string } | null, activeTrackId: null as string | null, isPlaying: false, purchasesEnabled: true }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: m.session }),
}));
vi.mock("@/features/payments/lib/payments-api", () => ({
  paymentsApi: { listMine: m.list, downloadTrack: m.download },
}));
vi.mock("@/features/payments/hooks/use-stellar-checkout", () => ({
  useStellarCheckout: () => m.checkout,
}));
vi.mock("@/features/playback/providers/global-playback-provider", () => ({
  useGlobalPlayback: () => ({ activeTrackId: m.activeTrackId, isPlaying: m.isPlaying, playTrack: m.play, setPlaybackQueue: vi.fn() }),
}));
vi.mock("@/features/playback/lib/playback-api", () => ({ playbackApi: { preloadTracks: m.preload } }));
vi.mock("@/lib/config/env", () => ({ clientEnv: { get trackPurchasesEnabled() { return m.purchasesEnabled; } } }));
const track = {
  id: "track",
  purchaseEnabled: true,
  purchasePrice: "1",
  purchaseAssetCode: "USDC",
} as TrackSummary;
beforeEach(() => { vi.clearAllMocks(); m.session = { token: "token" }; m.activeTrackId = null; m.isPlaying = false; m.purchasesEnabled = true; m.list.mockResolvedValue([]); });
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
it("offers a download after a confirmed purchase", async () => {
  m.list.mockResolvedValue([
    { trackId: "track", productType: "track_purchase", status: "confirmed" },
  ]);
  m.download.mockResolvedValue({
    blob: new Blob(["audio"], { type: "audio/mpeg" }),
    filename: "Artist - Track.mp3",
  });
  Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:track"),
    revokeObjectURL: vi.fn(),
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});

  render(<TrackCommerceActions track={track} />);
  await screen.findByText("Purchased");
  await userEvent.click(screen.getByRole("button", { name: "Download" }));

  await vi.waitFor(() => expect(m.download).toHaveBeenCalledWith("token", "track"));
  expect(click).toHaveBeenCalled();
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

it("hides configured track sales from listeners while public purchases are disabled", () => {
  m.purchasesEnabled = false;
  render(<TrackCommerceActions track={track} />);
  expect(screen.queryByRole("button", { name: "Buy 1 USDC" })).toBeNull();
});

it("keeps the download for a past purchase after sales are switched off", async () => {
  m.purchasesEnabled = false;
  m.list.mockResolvedValue([
    { trackId: "track", productType: "track_purchase", status: "confirmed" },
  ]);
  render(<TrackCommerceActions track={track} />);
  await screen.findByText("Purchased");
  expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Buy 1 USDC" })).toBeNull();
});

it("lets a guest play a ready song through the shared player", async () => {
  m.session = null;
  render(<TrackCommerceActions track={{ ...track, purchaseEnabled: false, playbackReady: true }} />);
  const play = screen.getByRole("button", { name: "Play" });
  expect(play.hasAttribute("disabled")).toBe(false);
  await userEvent.click(play);
  expect(m.play).toHaveBeenCalledWith(expect.objectContaining({ id: "track" }));
});
it("shows Play when the selected track has finished or is paused", () => {
  m.activeTrackId = "track";
  render(<TrackCommerceActions track={{ ...track, purchaseEnabled: false, playbackReady: true }} />);
  expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
});
it("shows Pause while the selected track is playing", async () => {
  m.activeTrackId = "track";
  m.isPlaying = true;
  render(<TrackCommerceActions track={{ ...track, purchaseEnabled: false, playbackReady: true }} />);
  const pause = screen.getByRole("button", { name: "Pause" });
  await userEvent.click(pause);
  expect(m.play).toHaveBeenCalledWith(expect.objectContaining({ id: "track" }));
});
it("keeps unprocessed audio unavailable to guests", () => {
  m.session = null;
  render(<TrackCommerceActions track={{ ...track, purchaseEnabled: false, playbackReady: false }} />);
  expect(screen.getByRole("button", { name: "Play" }).hasAttribute("disabled")).toBe(true);
});
