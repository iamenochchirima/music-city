import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { TrackSummary } from "@music-city/shared";
import { TrackCommerceActions } from "./track-commerce-actions";
const m = vi.hoisted(() => ({ list: vi.fn(), checkout: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: { token: "token" } }),
}));
vi.mock("@/features/payments/lib/payments-api", () => ({
  paymentsApi: { listMine: m.list },
}));
vi.mock("@/features/payments/hooks/use-stellar-checkout", () => ({
  useStellarCheckout: () => m.checkout,
}));
vi.mock("@/features/playback/providers/global-playback-provider", () => ({
  useGlobalPlayback: () => ({ playTrack: vi.fn() }),
}));
const track = {
  id: "track",
  purchaseEnabled: true,
  purchasePrice: "1",
  purchaseAssetCode: "USDC",
} as TrackSummary;
beforeEach(() => vi.clearAllMocks());
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
