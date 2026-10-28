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
  mock.get.mockImplementation(async (path: string) => path === "/ramps" ? { items: [order] } : { order, events: [], receipts: [], deliveries: [{ transaction_hash: "b".repeat(64), operation_id: "123", ledger: "42", asset_units: "10" }], attempts: [{ transaction_hash: "hash", state: "unknown", created_at: "2026-10-28T00:00:00Z" }, { transaction_hash: "a".repeat(64), state: "confirmed", created_at: "2026-10-28T00:00:00Z" }], job: { attempts: 2, last_error_code: "provider_check_failed" } });
  const user = userEvent.setup();
  render(<AdminRampsPage />);
  await user.click(await screen.findByRole("button", { name: /100.00 GBP/ }));
  expect(await screen.findByText("Provider status")).toBeTruthy();
  expect(screen.getByText("Chain status")).toBeTruthy();
  expect(screen.getByText(/provider check failed/)).toBeTruthy();
  expect(screen.getByText(/unknown · hash/)).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "View receipt" }).map((link) => link.getAttribute("href"))).toEqual([
    `https://stellar.expert/explorer/testnet/tx/${"a".repeat(64)}`,
    `https://stellar.expert/explorer/testnet/tx/${"b".repeat(64)}`,
  ]);
  expect(screen.queryByRole("button", { name: /submit|retry|pay/i })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Back to transactions" }));
  expect(await screen.findByRole("button", { name: /100.00 GBP/ })).toBeTruthy();
});
it("shows empty history", async () => {
  mock.get.mockResolvedValue({ items: [] });
  render(<AdminRampsPage />);
  expect(await screen.findByText("No transactions yet.")).toBeTruthy();
});
it("shows a clear warning for the latest conflicting provider status", async () => {
  const order = { id: "one", userId: "user", walletAddress: "wallet", provider: "moonpay", direction: "buy", environment: "sandbox", network: "stellar:testnet", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amount: { units: "10000", decimals: 2, currency: "GBP" }, providerState: "unknown", chainState: "confirmed", providerTransactionId: "ref", createdAt: "2026-10-28T00:00:00Z", updatedAt: "2026-10-28T00:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps" ? { items: [order] } : { order, events: [{ source: "provider_api", kind: "status_conflict", created_at: order.updatedAt }], attempts: [], deliveries: [], receipts: [], job: { attempts: 1, last_error_code: "provider_status_conflict" } });
  const user = userEvent.setup();
  render(<AdminRampsPage />);
  await user.click(await screen.findByRole("button", { name: /100.00 GBP/ }));
  expect(await screen.findByText("Provider statuses conflict. Check with the provider before taking further action.")).toBeTruthy();
  expect(screen.queryByText(/Reconciliation needs attention/)).toBeNull();
});
it("does not display an old conflict after a newer provider observation", async () => {
  const order = { id: "one", userId: "user", walletAddress: "wallet", provider: "moonpay", direction: "buy", environment: "sandbox", network: "stellar:testnet", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amount: { units: "10000", decimals: 2, currency: "GBP" }, providerState: "unknown", chainState: "unobserved", providerTransactionId: "ref", createdAt: "2026-10-28T00:00:00Z", updatedAt: "2026-10-28T00:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps" ? { items: [order] } : { order, events: [{ source: "provider_api", kind: "status_observed", created_at: order.updatedAt }, { source: "provider_api", kind: "status_conflict", created_at: order.createdAt }], attempts: [], deliveries: [], receipts: [], job: null });
  const user = userEvent.setup();
  render(<AdminRampsPage />);
  await user.click(await screen.findByRole("button", { name: /100.00 GBP/ }));
  await screen.findByText("Provider status");
  expect(screen.queryByText(/Provider statuses conflict/)).toBeNull();
});
