import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CashOutReview } from "./cash-out-review";
const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/http-client", () => ({ httpClient: mock }));
const transfer = { id: "attempt", quoteId: "quote", transactionHash: "hash", transaction: "exact-xdr", networkFeeStroops: "100", state: "prepared", expiresAt: "2099-01-01T00:00:00Z" };
const quote = { quote: { provider: "moonpay", providerTransactionId: "provider-order", network: "stellar:testnet", walletAddress: "GTESTWALLET", debitUnits: "10000000", receive: { currency: "GBP", units: "75", decimals: 2 }, destinationLabel: "Bank ending 1234", fees: [{ kind: "provider", amount: { currency: "GBP", units: "10", decimals: 2 }, includedInDebit: false }] }, expiresAt: "2099-01-01T00:00:00Z" };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("shows quote totals, keeps technical details disclosed, then checks status before signing", async () => {
  const user = userEvent.setup(), sign = vi.fn().mockResolvedValue("signed-xdr"), changed = vi.fn();
  mock.get.mockResolvedValueOnce({ transfer }).mockResolvedValueOnce(quote).mockResolvedValueOnce({ transfer }).mockResolvedValueOnce({ transfer: { ...transfer, transaction: null, state: "submitting" } });
  mock.post.mockResolvedValue({});
  render(<CashOutReview token="session" orderId="order" sign={sign} onClose={vi.fn()} onChanged={changed} />);
  expect(await screen.findByText("0.75 GBP")).toBeTruthy();
  expect(screen.getByText("Bank ending 1234")).toBeTruthy();
  expect(screen.getByText("0.10 GBP + 0.00001 XLM")).toBeTruthy();
  const technicalDetails = screen.getByText("Technical details").closest("details");
  expect(technicalDetails?.open).toBe(false);
  await user.click(screen.getByText("Technical details"));
  expect(await screen.findByText("Stellar Testnet")).toBeTruthy();
  expect(screen.getByText("provider-order")).toBeTruthy();
  expect(sign).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Confirm cash-out" }));
  expect(await screen.findByText("Checking your transfer.")).toBeTruthy();
  expect(sign).toHaveBeenCalledWith("exact-xdr");
  expect(mock.post).toHaveBeenCalledWith("/ramps/order/cashout/transfer/attempt/authorize", { signedXdr: "signed-xdr" }, "session");
  expect(changed).toHaveBeenCalled();
});
it("does not offer another signature when the authorization outcome cannot be checked", async () => {
  const user = userEvent.setup(), sign = vi.fn().mockResolvedValue("signed-xdr");
  mock.get.mockResolvedValueOnce({ transfer }).mockResolvedValueOnce(quote).mockResolvedValueOnce({ transfer }).mockRejectedValue(new Error("offline"));
  mock.post.mockRejectedValue(new Error("timeout"));
  render(<CashOutReview token="session" orderId="order" sign={sign} onClose={vi.fn()} onChanged={vi.fn()} />);
  await user.click(await screen.findByRole("button", { name: "Confirm cash-out" }));
  await screen.findByText("Could not check the transfer. Try again before taking another action.");
  expect(screen.queryByRole("button", { name: "Confirm cash-out" })).toBeNull();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  await waitFor(() => expect(sign).toHaveBeenCalledTimes(1));
});
it("cancels an unsigned transfer and checks the saved state", async () => {
  const user = userEvent.setup(), sign = vi.fn();
  mock.get.mockResolvedValueOnce({ transfer }).mockResolvedValueOnce(quote).mockResolvedValueOnce({ transfer: { ...transfer, transaction: null, state: "cancelled" } });
  mock.post.mockResolvedValue(undefined);
  render(<CashOutReview token="session" orderId="order" sign={sign} onClose={vi.fn()} onChanged={vi.fn()} />);
  await user.click(await screen.findByRole("button", { name: "Cancel cash-out" }));
  expect(await screen.findByText("Cash-out cancelled.")).toBeTruthy();
  expect(sign).not.toHaveBeenCalled();
  expect(mock.post).toHaveBeenCalledWith("/ramps/order/cashout/transfer/attempt/cancel", {}, "session");
});

it("does not prompt for a signature when the prepared transfer is unavailable", async () => {
  const sign = vi.fn();
  mock.get.mockResolvedValueOnce({ transfer: { ...transfer, transaction: null } }).mockResolvedValueOnce(quote);
  render(<CashOutReview token="session" orderId="order" sign={sign} onClose={vi.fn()} onChanged={vi.fn()} />);
  expect(await screen.findByText("This cash-out is no longer available.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Confirm cash-out" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Cancel cash-out" }).hasAttribute("disabled")).toBe(false);
  expect(sign).not.toHaveBeenCalled();
});

it("automatically follows an unresolved cash-out transfer until it is confirmed", async () => {
  const submitting = { ...transfer, transaction: null, state: "submitting" };
  const confirmed = { ...submitting, state: "confirmed" };
  const changed = vi.fn();
  mock.get.mockResolvedValueOnce({ transfer: submitting }).mockResolvedValueOnce({ transfer: confirmed });
  vi.useFakeTimers();
  try {
    render(<CashOutReview token="session" orderId="order" sign={vi.fn()} onClose={vi.fn()} onChanged={changed} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Checking your transfer.")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mock.get).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Transfer confirmed. Check your payout status in transactions.")).toBeTruthy();
    expect(changed).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});


it("refreshes a changed transfer without opening the wallet", async () => {
  const user = userEvent.setup(), sign = vi.fn();
  const unavailable = { ...transfer, transaction: null };
  mock.get.mockResolvedValueOnce({ transfer }).mockResolvedValueOnce(quote)
    .mockResolvedValueOnce({ transfer: unavailable }).mockResolvedValueOnce({ transfer: unavailable }).mockResolvedValueOnce(quote);
  render(<CashOutReview token="session" orderId="order" sign={sign} onClose={vi.fn()} onChanged={vi.fn()} />);
  await user.click(await screen.findByRole("button", { name: "Confirm cash-out" }));
  expect(await screen.findByText("Cash-out changed. Check its current status.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Confirm cash-out" }).hasAttribute("disabled")).toBe(true);
  expect(sign).not.toHaveBeenCalled();
  expect(mock.post).not.toHaveBeenCalled();
});

it("does not open the wallet if the pre-sign check is unavailable", async () => {
  const user = userEvent.setup(), sign = vi.fn();
  mock.get.mockResolvedValueOnce({ transfer }).mockResolvedValueOnce(quote).mockRejectedValue(new Error("offline"));
  render(<CashOutReview token="session" orderId="order" sign={sign} onClose={vi.fn()} onChanged={vi.fn()} />);
  await user.click(await screen.findByRole("button", { name: "Confirm cash-out" }));
  expect(await screen.findByText("Could not check the transfer. Try again before taking another action.")).toBeTruthy();
  expect(sign).not.toHaveBeenCalled();
  expect(mock.post).not.toHaveBeenCalled();
});


it("explains why a fresh balance check withheld the transfer", async () => {
  mock.get.mockResolvedValueOnce({ transfer: { ...transfer, transaction: null, unavailableReason: "Your wallet has insufficient spendable USDC." } }).mockResolvedValueOnce(quote);
  const sign = vi.fn();
  render(<CashOutReview token="session" orderId="order" sign={sign} onClose={vi.fn()} onChanged={vi.fn()} />);
  expect(await screen.findByText("Your wallet has insufficient spendable USDC.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Confirm cash-out" }).hasAttribute("disabled")).toBe(true);
  expect(sign).not.toHaveBeenCalled();
});
