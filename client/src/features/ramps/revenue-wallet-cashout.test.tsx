import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { RevenueWalletCashout } from "./revenue-wallet-cashout";

const mock = vi.hoisted(() => ({ getMe: vi.fn(), authorize: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { token: "artist-token", walletAddress: "GTEST" },
  }),
}));
vi.mock("@dynamic-labs/sdk-react-core", () => ({
  useDynamicContext: () => ({ primaryWallet: null }),
  useUserWallets: () => [],
}));
vi.mock("@/features/wallet/lib/use-stellar-authorization", () => ({
  useStellarAuthorization: () => mock.authorize,
}));
vi.mock("@/features/wallet/lib/resolve-stellar-wallet", () => ({
  resolveStellarWallet: () => null,
}));
vi.mock("@/features/wallet/lib/wallet-api", () => ({
  walletApi: { getMe: mock.getMe },
}));
vi.mock("@/features/ramps/wallet-ramp-activity", () => ({
  WalletRampActivity: ({ spendableUsdc }: { spendableUsdc: string }) => (
    <output data-testid="ramp-balance">{spendableUsdc}</output>
  ),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("shows spendable wallet USDC separately from earnings and links to history", async () => {
  mock.getMe.mockResolvedValue({
    balances: [
      {
        assetCode: "USDC",
        assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        availableAmount: "2.5000000",
      },
      { assetCode: "USDC", assetIssuer: "different-issuer", availableAmount: "90" },
    ],
  });
  render(
    <MemoryRouter>
      <RevenueWalletCashout />
    </MemoryRouter>,
  );

  expect(await screen.findByText("2.5 USDC")).toBeTruthy();
  expect(screen.getByText("Spendable USDC is separate from unclaimed earnings.")).toBeTruthy();
  expect(screen.getByTestId("ramp-balance").textContent).toBe("2.5000000");
  expect(
    screen.getByRole("link", { name: "View wallet and transaction history" }).getAttribute("href"),
  ).toBe("/account");
});

it("lets the user retry a failed wallet balance request", async () => {
  mock.getMe
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ balances: [] });
  render(
    <MemoryRouter>
      <RevenueWalletCashout />
    </MemoryRouter>,
  );

  await screen.findByRole("alert");
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(screen.getByText("0 USDC")).toBeTruthy();
});
