import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TrackSummary } from "@music-city/shared";

import { TrackSaleButton } from "./track-sale-button";

const m = vi.hoisted(() => ({
  createIntent: vi.fn(),
  confirm: vi.fn(),
  download: vi.fn(),
  checkout: vi.fn(),
  purchasesEnabled: true,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: { token: "token" } }),
}));
vi.mock("@/features/payments/hooks/use-stellar-checkout", () => ({
  useStellarCheckout: () => m.checkout,
}));
vi.mock("@/features/payments/lib/payments-api", () => ({
  paymentsApi: {
    createTrackPurchaseIntent: m.createIntent,
    confirm: m.confirm,
    downloadTrack: m.download,
  },
}));
vi.mock("@/lib/config/env", () => ({
  clientEnv: { get trackPurchasesEnabled() { return m.purchasesEnabled; } },
}));

const track = {
  id: "track",
  title: "Song",
  artistName: "Artist",
  purchaseEnabled: true,
  purchasePrice: "5",
  purchaseAssetCode: "USDC",
} as TrackSummary;

beforeEach(() => {
  vi.clearAllMocks();
  m.purchasesEnabled = true;
  m.createIntent.mockResolvedValue({ id: "intent" });
  m.checkout.mockResolvedValue("tx-hash");
  m.confirm.mockResolvedValue({});
});
afterEach(cleanup);

it("shows the price on the normal music listing when sales are enabled", () => {
  render(<TrackSaleButton track={track} />);

  expect(screen.getByRole("button", { name: "Buy 5 USDC" })).toBeTruthy();
});

it("hides the action when the track has no sales configured", () => {
  render(<TrackSaleButton track={{ ...track, purchaseEnabled: false }} />);

  expect(screen.queryByRole("button", { name: /Buy/ })).toBeNull();
});

it("buys the song and then offers the download", async () => {
  render(<TrackSaleButton track={track} />);

  await userEvent.click(screen.getByRole("button", { name: "Buy 5 USDC" }));

  await vi.waitFor(() =>
    expect(m.confirm).toHaveBeenCalledWith("token", {
      intentId: "intent",
      txHash: "tx-hash",
    }),
  );
  expect(await screen.findByRole("button", { name: "Download" })).toBeTruthy();
});

it("downloads an owned song from the listing", async () => {
  m.download.mockResolvedValue({
    blob: new Blob(["audio"], { type: "audio/mpeg" }),
    filename: "Artist - Song.mp3",
  });
  Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:song"),
    revokeObjectURL: vi.fn(),
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});

  render(<TrackSaleButton track={track} owned />);
  await userEvent.click(screen.getByRole("button", { name: "Download" }));

  await vi.waitFor(() =>
    expect(m.download).toHaveBeenCalledWith("token", "track"),
  );
  expect(click).toHaveBeenCalled();
});
