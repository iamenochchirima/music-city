import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WalletRampActivity } from "./wallet-ramp-activity";
const mock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/http-client", () => ({ httpClient: { get: mock.get } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("keeps unavailable options disabled and distinguishes provider completion from delivery", async () => {
  mock.get.mockResolvedValue({ items: [{ id: "one", direction: "buy", providerState: "completed", chainState: "unobserved", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" }] });
  render(<WalletRampActivity token="session" />);
  expect(screen.getByRole("button", { name: "Add funds" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Cash out" }).hasAttribute("disabled")).toBe(true);
  expect(await screen.findByText("Provider completed · Transfer unconfirmed")).toBeTruthy();
  expect(screen.getByText("Add funds · 100.00 GBP")).toBeTruthy();
  expect(mock.get).toHaveBeenCalledWith("/ramps", "session");
});
it("offers retry when transaction history cannot be loaded", async () => {
  let historyCalls = 0;
  mock.get.mockImplementation(async (path: string) => {
    if (path === "/ramps/capabilities") return { routes: [] };
    if (++historyCalls === 1) throw new Error("offline");
    return { items: [] };
  });
  render(<WalletRampActivity token="session" />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Try again" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(historyCalls).toBe(2);
});
it("offers funding only when the server provides a buy route", async () => {
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [{ provider: "moonpay", direction: "buy", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amountDecimals: 2, minUnits: "1000", maxUnits: "100000" }] } : { items: [] });
  const user = userEvent.setup();
  render(<WalletRampActivity token="session" />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Add funds" }).hasAttribute("disabled")).toBe(false));
  await user.click(screen.getByRole("button", { name: "Add funds" }));
  expect(await screen.findByRole("radio", { name: /United Kingdom/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Cash out" }).hasAttribute("disabled")).toBe(true);
});
