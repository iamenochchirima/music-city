import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PaymentIntentRecord } from "@music-city/shared";
import { ArtistPaymentReviewDialog } from "./artist-payment-review-dialog";

const mocks = vi.hoisted(() => ({ account: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: { token: "token" } }) }));
vi.mock("@/features/wallet/lib/wallet-api", () => ({ walletApi: { getMe: mocks.account } }));
const intent = { assetCode: "XLM", amount: "2", walletAddress: "GACCOUNT", destinationAddress: "GTREASURY" } as PaymentIntentRecord;
beforeEach(() => { vi.clearAllMocks(); mocks.account.mockResolvedValue({ exists: true, balances: [{ assetKey: "native", assetCode: "XLM", availableAmount: "3" }] }); });
afterEach(cleanup);
it("keeps payment confirmation gated by balances and the explicit user action", async () => {
  const user = userEvent.setup(); const confirm = vi.fn();
  render(<ArtistPaymentReviewDialog intent={intent} isPaying={false} onConfirm={confirm} onCancel={vi.fn()} />);
  await screen.findAllByText("3 XLM");
  expect(confirm).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Confirm 2 XLM" }).hasAttribute("disabled")).toBe(false);
  await user.click(screen.getByRole("button", { name: "Confirm 2 XLM" }));
  expect(confirm).toHaveBeenCalledOnce();
});
it("prevents confirmation for insufficient balance", async () => {
  mocks.account.mockResolvedValue({ exists: true, balances: [] });
  render(<ArtistPaymentReviewDialog intent={intent} isPaying={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Confirm 2 XLM" }).hasAttribute("disabled")).toBe(true);
});
it("prevents dismissal while a payment is pending", () => {
  const cancel = vi.fn();
  render(<ArtistPaymentReviewDialog intent={intent} isPaying onConfirm={vi.fn()} onCancel={cancel} />);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(cancel).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(true);
});
