import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddFundsDialog, type FundingRoute } from "./add-funds-dialog";
const mock = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api/http-client", () => ({ httpClient: mock }));
const route: FundingRoute = { provider: "moonpay", direction: "buy", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amountDecimals: 2, minUnits: "1000", maxUnits: "100000" };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("requires a supported amount and opens only the returned sandbox provider", async () => {
  const user = userEvent.setup();
  mock.post.mockResolvedValueOnce({ order: { id: "order" } }).mockResolvedValueOnce({ url: "https://buy-sandbox.moonpay.com/?signature=test" });
  render(<AddFundsDialog token="session" routes={[route]} onClose={vi.fn()} onChanged={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Continue" }).hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByLabelText("Amount in GBP"), "12.50");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  const link = await screen.findByRole("link", { name: "Continue to provider" });
  expect(link.getAttribute("href")).toBe("https://buy-sandbox.moonpay.com/?signature=test");
  expect(mock.post).toHaveBeenNthCalledWith(2, "/ramps/order/launch", {}, "session");
  expect(mock.post.mock.calls[0][1]).toMatchObject({ provider: "moonpay", direction: "buy", amount: "12.50", market: route.market });
});
it("blocks another launch when the provider response is uncertain", async () => {
  const user = userEvent.setup();
  mock.post.mockResolvedValueOnce({ order: { id: "order" } }).mockRejectedValueOnce(new Error("timeout"));
  render(<AddFundsDialog token="session" routes={[route]} onClose={vi.fn()} onChanged={vi.fn()} />);
  await user.type(screen.getByLabelText("Amount in GBP"), "12.50");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Check this transaction in your history");
  expect(screen.getByRole("button", { name: "Continue" }).hasAttribute("disabled")).toBe(true);
  expect(mock.post).toHaveBeenCalledTimes(2);
});
it("retries an uncertain order creation with the same request ID and frozen terms", async () => {
  const user = userEvent.setup(), changed = vi.fn();
  mock.post
    .mockRejectedValueOnce(new TypeError("Network error"))
    .mockResolvedValueOnce({ order: { id: "order" } })
    .mockResolvedValueOnce({ url: "https://buy-sandbox.moonpay.com/?signature=test" });
  render(<AddFundsDialog token="session" routes={[route]} onClose={vi.fn()} onChanged={changed} />);
  const amount = screen.getByRole("textbox", { name: "Amount in GBP" });
  await user.type(amount, "12.50");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect((await screen.findByRole("alert")).textContent).toContain("couldn't confirm whether this transaction started");
  expect(amount.hasAttribute("disabled")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Retry safely" }));
  expect(await screen.findByRole("link", { name: "Continue to provider" })).toBeTruthy();
  const creates = mock.post.mock.calls.filter(([path]) => path === "/ramps");
  expect(creates).toHaveLength(2);
  expect(creates[0]?.[1]).toEqual(creates[1]?.[1]);
  expect(changed).toHaveBeenCalled();
});
it("unlocks funding terms after a safe retry is definitively rejected", async () => {
  const user = userEvent.setup();
  mock.post.mockRejectedValueOnce(new TypeError("Network error")).mockRejectedValueOnce({ status: 400 })
    .mockResolvedValueOnce({ order: { id: "order" } }).mockResolvedValueOnce({ url: "https://buy-sandbox.moonpay.com/?signature=test" });
  render(<AddFundsDialog token="session" routes={[route]} onClose={vi.fn()} onChanged={vi.fn()} />);
  const amount = screen.getByRole("textbox", { name: "Amount in GBP" });
  await user.type(amount, "12.50");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  const firstRequestId = mock.post.mock.calls[0]?.[1]?.requestId;
  await user.click(screen.getByRole("button", { name: "Retry safely" }));
  expect(amount.hasAttribute("disabled")).toBe(false);
  await user.clear(amount);
  await user.type(amount, "13.00");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("link", { name: "Continue to provider" })).toBeTruthy();
  const creates = mock.post.mock.calls.filter(([path]) => path === "/ramps");
  expect(creates[0]?.[1]).toEqual(creates[1]?.[1]);
  expect(creates[2]?.[1]).toMatchObject({ amount: "13.00" });
  expect(creates[2]?.[1]?.requestId).not.toBe(firstRequestId);
});
