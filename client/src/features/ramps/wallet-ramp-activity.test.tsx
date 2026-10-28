import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WalletRampActivity } from "./wallet-ramp-activity";
const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/http-client", () => ({ httpClient: { get: mock.get, post: mock.post } }));
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
it("resumes an unlaunched saved order without creating another", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, launchRequested: false, providerState: "created", chainState: "unobserved", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [{ provider: "moonpay", direction: "buy", assetCode: "XLM", market: order.market, amountDecimals: 2, minUnits: "1000", maxUnits: "100000" }] } : { items: [order] });
  mock.post.mockResolvedValue({ url: "https://buy-sandbox.moonpay.com/?signature=test" });
  const user = userEvent.setup();
  render(<WalletRampActivity token="session" />);
  expect(await screen.findByText("Not started")).toBeTruthy();
  await user.click(await screen.findByRole("button", { name: "Manage" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("link", { name: "Continue to provider" })).toBeTruthy();
  expect(mock.post).toHaveBeenCalledTimes(1);
  expect(mock.post).toHaveBeenCalledWith("/ramps/saved/launch", {}, "session");
});
it("shows unresolved launches as checking and blocks another funding request", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", launchRequested: true, providerState: "created", chainState: "unobserved", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" };
  const route = { provider: "moonpay", direction: "buy", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amountDecimals: 2, minUnits: "1000", maxUnits: "100000" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [route] } : { items: [order] });
  render(<WalletRampActivity token="session" />);
  expect(await screen.findByText("Checking status · Transfer unconfirmed")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add funds" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("button", { name: "Manage" })).toBeNull();
});
it("does not reopen an order with an existing provider reference", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", launchRequested: false, providerStarted: true, providerState: "created", chainState: "unobserved", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [] } : { items: [order] });
  render(<WalletRampActivity token="session" />);
  expect(await screen.findByText("Checking status · Transfer unconfirmed")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Manage" })).toBeNull();
});
it("cancels an unlaunched funding request without opening the provider", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", launchRequested: false, providerStarted: false, providerState: "created", chainState: "unobserved", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [] } : { items: [order] });
  mock.post.mockResolvedValue({});
  const user = userEvent.setup();
  render(<WalletRampActivity token="session" />);
  await user.click(await screen.findByRole("button", { name: "Manage" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel funding" }));
  expect(await screen.findByText("Funding request cancelled.")).toBeTruthy();
  expect(mock.post).toHaveBeenCalledTimes(1);
  expect(mock.post).toHaveBeenCalledWith("/ramps/saved/cancel", {}, "session");
});


it("allows cancellation but hides provider launch when the saved route is unavailable", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, launchRequested: false, providerStarted: false, providerState: "created", chainState: "unobserved", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [] } : { items: [order] });
  mock.post.mockResolvedValue({});
  const user = userEvent.setup();
  render(<WalletRampActivity token="session" />);
  await user.click(await screen.findByRole("button", { name: "Manage" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("This payment option is unavailable.")).toBeTruthy();
  expect(dialog.queryByRole("button", { name: "Continue" })).toBeNull();
  await user.click(dialog.getByRole("button", { name: "Cancel funding" }));
  expect(mock.post).toHaveBeenCalledWith("/ramps/saved/cancel", {}, "session");
});
