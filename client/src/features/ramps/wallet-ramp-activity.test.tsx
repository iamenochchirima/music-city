import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
  mock.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [] });
  render(<WalletRampActivity token="session" />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Try again" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(mock.get).toHaveBeenCalledTimes(2);
});
