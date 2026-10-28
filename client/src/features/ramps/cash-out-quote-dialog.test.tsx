import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { CashOutQuoteDialog } from "./cash-out-quote-dialog";
const mock = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api/http-client", () => ({ httpClient: mock }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("prepares the exact saved quote before opening review", async () => {
  const prepared = vi.fn(), changed = vi.fn();
  mock.post.mockResolvedValueOnce({ quote: { id: "quote" }, confirmationHash: "hash" }).mockResolvedValueOnce({ transfer: { state: "prepared" } });
  render(<CashOutQuoteDialog token="session" orderId="order" onClose={vi.fn()} onChanged={changed} onPrepared={prepared} />);
  await waitFor(() => expect(prepared).toHaveBeenCalledOnce());
  expect(mock.post).toHaveBeenNthCalledWith(1, "/ramps/order/cashout/quotes", {}, "session");
  expect(mock.post).toHaveBeenNthCalledWith(2, "/ramps/order/cashout/transfer", { quoteId: "quote", confirmationHash: "hash" }, "session");
  expect(prepared).toHaveBeenCalledOnce(); expect(changed).toHaveBeenCalledOnce();
});
it("lets the user retry when a quote is not available", async () => {
  const prepared = vi.fn();
  mock.post.mockRejectedValueOnce(new Error("not ready"));
  render(<CashOutQuoteDialog token="session" orderId="order" onClose={vi.fn()} onChanged={vi.fn()} onPrepared={prepared} />);
  expect((await screen.findByRole("alert")).textContent).toContain("Quote not available yet");
  expect(screen.getByRole("button", { name: "Try again" }).hasAttribute("disabled")).toBe(false);
  expect(prepared).not.toHaveBeenCalled();
});
it("does not repeat a transfer preparation after a lost response", async () => {
  const prepared = vi.fn(), changed = vi.fn();
  mock.post.mockResolvedValueOnce({ quote: { id: "quote" }, confirmationHash: "hash" }).mockRejectedValueOnce(new Error("timeout"));
  render(<CashOutQuoteDialog token="session" orderId="order" onClose={vi.fn()} onChanged={changed} onPrepared={prepared} />);
  expect((await screen.findByRole("alert")).textContent).toContain("Check this cash-out in transactions");
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  expect(prepared).not.toHaveBeenCalled(); expect(changed).toHaveBeenCalledOnce();
});

it("does not start duplicate quote requests under React strict mode", async () => {
  const { StrictMode } = await import("react");
  let rejectQuote!: (error: Error) => void;
  mock.post.mockImplementation(() => new Promise((_resolve, reject) => { rejectQuote = reject; }));
  render(<StrictMode><CashOutQuoteDialog token="session" orderId="order" onClose={vi.fn()} onChanged={vi.fn()} onPrepared={vi.fn()} /></StrictMode>);
  expect(mock.post).toHaveBeenCalledTimes(1);
  rejectQuote(new Error("not ready"));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(mock.post).toHaveBeenCalledTimes(1);
});


it("shows a definite insufficient-balance response without treating it as a lost request", async () => {
  const error = Object.assign(new Error("Your wallet has insufficient spendable USDC."), { status: 409 });
  mock.post.mockResolvedValueOnce({ quote: { id: "quote" }, confirmationHash: "hash" }).mockRejectedValueOnce(error);
  render(<CashOutQuoteDialog token="session" orderId="order" onClose={vi.fn()} onChanged={vi.fn()} onPrepared={vi.fn()} />);
  expect((await screen.findByRole("alert")).textContent).toBe("Your wallet has insufficient spendable USDC.");
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});
