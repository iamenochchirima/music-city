import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardRevenueOverview } from "./dashboard-revenue-overview";
const m = vi.hoisted(() => ({ sales: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { token: "artist-token", primaryIntent: "artist" },
  }),
}));
vi.mock("@/features/payments/lib/payments-api", () => ({
  paymentsApi: { listTrackSales: m.sales },
}));
vi.mock("@/features/settlements/creator-claims", () => ({
  CreatorClaims: () => <p>Claim earnings</p>,
}));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
it("shows incoming song sales with exact amounts and the receipt's original network", async () => {
  m.sales.mockResolvedValue([
    {
      id: "sale",
      trackId: "track",
      trackTitle: "Core Journey",
      amount: "0.0000001",
      assetCode: "USDC",
      confirmedAt: "2026-10-17T00:00:00Z",
      txHash: "abc",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  ]);
  render(<DashboardRevenueOverview />);
  await screen.findByText("Core Journey");
  expect(screen.getByText("0.0000001 USDC")).toBeTruthy();
  expect(screen.getByText("1 purchase")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "View receipt" }).getAttribute("href"),
  ).toBe("https://stellar.expert/explorer/testnet/tx/abc");
  expect(m.sales).toHaveBeenCalledWith("artist-token");
});
it("keeps claims accessible when sales fail and can retry without payment actions", async () => {
  m.sales
    .mockRejectedValueOnce(new Error("Connection interrupted"))
    .mockResolvedValueOnce([]);
  render(<DashboardRevenueOverview />);
  expect(screen.getByText("Claim earnings")).toBeTruthy();
  await screen.findByRole("alert");
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("Your song sales will appear here.");
  expect(screen.queryByRole("alert")).toBeNull();
});
