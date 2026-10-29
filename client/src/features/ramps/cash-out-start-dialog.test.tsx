import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CashOutStartDialog, type CashOutRoute } from "./cash-out-start-dialog";
const mock = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api/http-client", () => ({ httpClient: mock }));
const route: CashOutRoute = { provider: "moonpay", direction: "sell", assetCode: "USDC", assetIssuer: "issuer", market: { country: "GB", currency: "GBP", method: "bank" }, amountDecimals: 7, minUnits: "10000000", maxUnits: "100000000" };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("requires an amount within the verified limits and spendable balance", async () => {
  const user = userEvent.setup();
  render(<CashOutStartDialog token="session" routes={[route]} available="2.5" onClose={vi.fn()} onChanged={vi.fn()} />);
  const amount = screen.getByRole("textbox", { name: "Amount in USDC" }), button = screen.getByRole("button", { name: "Continue" });
  expect(screen.getByText(/2.5 USDC available/)).toBeTruthy();
  await user.type(amount, "0.5"); expect(button.hasAttribute("disabled")).toBe(true);
  await user.clear(amount); await user.type(amount, "2.5000001"); expect(button.hasAttribute("disabled")).toBe(true);
  await user.clear(amount); await user.type(amount, "1.5"); expect(button.hasAttribute("disabled")).toBe(false);
});
it("creates one saved order and offers a validated provider handoff", async () => {
  const user = userEvent.setup(), changed = vi.fn();
  mock.post.mockResolvedValueOnce({ order: { id: "saved" } }).mockResolvedValueOnce({ url: "https://sell-sandbox.moonpay.com/?test=1" });
  render(<CashOutStartDialog token="session" routes={[route]} available="3" onClose={vi.fn()} onChanged={changed} />);
  await user.type(screen.getByRole("textbox", { name: "Amount in USDC" }), "1.5");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("link", { name: "Continue to provider" })).toBeTruthy();
  expect(mock.post).toHaveBeenNthCalledWith(1, "/ramps", expect.objectContaining({ direction: "sell", assetCode: "USDC", amount: "1.5", market: route.market }), "session");
  expect(mock.post).toHaveBeenNthCalledWith(2, "/ramps/saved/launch", {}, "session");
  expect(changed).toHaveBeenCalled();
});
it("does not offer a handoff when the provider response is uncertain", async () => {
  const user = userEvent.setup();
  mock.post.mockResolvedValueOnce({ order: { id: "saved" } }).mockResolvedValueOnce({ url: "https://sell-sandbox.moonpay.com.evil.test/" });
  render(<CashOutStartDialog token="session" routes={[route]} available="3" onClose={vi.fn()} onChanged={vi.fn()} />);
  await user.type(screen.getByRole("textbox", { name: "Amount in USDC" }), "1");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Check this cash-out in transactions before trying again.");
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Continue" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("link", { name: "Continue to provider" })).toBeNull();
});
it("retries an uncertain cash-out creation with the same request ID and frozen terms", async () => {
  const user = userEvent.setup(), changed = vi.fn();
  mock.post
    .mockRejectedValueOnce(new TypeError("Network error"))
    .mockResolvedValueOnce({ order: { id: "saved" } })
    .mockResolvedValueOnce({ url: "https://sell-sandbox.moonpay.com/?test=1" });
  render(<CashOutStartDialog token="session" routes={[route]} available="3" onClose={vi.fn()} onChanged={changed} />);
  const amount = screen.getByRole("textbox", { name: "Amount in USDC" });
  await user.type(amount, "1.5");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect((await screen.findByRole("alert")).textContent).toContain("couldn't confirm whether this cash-out started");
  expect(amount.hasAttribute("disabled")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Retry safely" }));
  expect(await screen.findByRole("link", { name: "Continue to provider" })).toBeTruthy();
  const creates = mock.post.mock.calls.filter(([path]) => path === "/ramps");
  expect(creates).toHaveLength(2);
  expect(creates[0]?.[1]).toEqual(creates[1]?.[1]);
  expect(changed).toHaveBeenCalled();
});
it("unlocks cash-out terms after a safe retry is definitively rejected", async () => {
  const user = userEvent.setup();
  mock.post.mockRejectedValueOnce(new TypeError("Network error")).mockRejectedValueOnce({ status: 400 })
    .mockResolvedValueOnce({ order: { id: "saved" } }).mockResolvedValueOnce({ url: "https://sell-sandbox.moonpay.com/?test=1" });
  render(<CashOutStartDialog token="session" routes={[route]} available="3" onClose={vi.fn()} onChanged={vi.fn()} />);
  const amount = screen.getByRole("textbox", { name: "Amount in USDC" });
  await user.type(amount, "1.5");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  const firstRequestId = mock.post.mock.calls[0]?.[1]?.requestId;
  await user.click(screen.getByRole("button", { name: "Retry safely" }));
  expect(amount.hasAttribute("disabled")).toBe(false);
  await user.clear(amount);
  await user.type(amount, "2");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("link", { name: "Continue to provider" })).toBeTruthy();
  const creates = mock.post.mock.calls.filter(([path]) => path === "/ramps");
  expect(creates[0]?.[1]).toEqual(creates[1]?.[1]);
  expect(creates[2]?.[1]).toMatchObject({ amount: "2" });
  expect(creates[2]?.[1]?.requestId).not.toBe(firstRequestId);
});
