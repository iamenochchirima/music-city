import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminRampsPage } from "./ramps-page";
const mock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/features/auth/providers/admin-auth-provider", () => ({ useAdminAuth: () => ({ session: { token: "admin-session", role: "admin" } }) }));
vi.mock("@/lib/api/http-client", () => ({ httpClient: { get: mock.get } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("shows provider and chain states separately and opens read-only details", async () => {
  const order = { id: "one", userId: "user", walletAddress: "wallet", provider: "moonpay", direction: "buy", environment: "sandbox", network: "stellar:testnet", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amount: { units: "10000", decimals: 2, currency: "GBP" }, providerState: "completed", chainState: "unobserved", providerTransactionId: "ref", createdAt: "2026-10-28T00:00:00Z", updatedAt: "2026-10-28T00:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps" ? { items: [order] } : { order, events: [], attempts: [{ transaction_hash: "hash", state: "unknown", created_at: "2026-10-28T00:00:00Z" }, { transaction_hash: "a".repeat(64), state: "confirmed", created_at: "2026-10-28T00:00:00Z" }], job: { attempts: 2, last_error_code: "provider_check_failed" } });
  const user = userEvent.setup();
  render(<AdminRampsPage />);
  await user.click(await screen.findByRole("button", { name: /100.00 GBP/ }));
  expect(await screen.findByText("Provider status")).toBeTruthy();
  expect(screen.getByText("Chain status")).toBeTruthy();
  expect(screen.getByText(/provider check failed/)).toBeTruthy();
  expect(screen.getByText(/unknown · hash/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "View receipt" }).getAttribute("href")).toBe(`https://stellar.expert/explorer/testnet/tx/${"a".repeat(64)}`);
  expect(screen.queryByRole("button", { name: /submit|retry|pay/i })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Back to transactions" }));
  expect(await screen.findByRole("button", { name: /100.00 GBP/ })).toBeTruthy();
});
it("shows empty history", async () => {
  mock.get.mockResolvedValue({ items: [] });
  render(<AdminRampsPage />);
  expect(await screen.findByText("No transactions yet.")).toBeTruthy();
});
