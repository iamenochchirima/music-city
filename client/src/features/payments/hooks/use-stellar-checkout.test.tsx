import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PaymentIntentRecord } from "@music-city/shared";
import {
  StellarCheckoutProvider,
  useStellarCheckout,
} from "./use-stellar-checkout";
const mocks = vi.hoisted(() => ({
  sign: vi.fn(),
  active: vi.fn(),
  resolve: vi.fn(),
  prepare: vi.fn(),
  authorize: vi.fn(),
  submit: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@dynamic-labs/sdk-react-core", () => ({
  useStepUpAuthentication: () => ({
    isStepUpRequired: async () => false,
    promptStepUpAuth: async () => undefined,
  }),
  useDynamicContext: () => ({ primaryWallet: { address: "wallet" } }),
  useUserWallets: () => [],
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: { walletAddress: "wallet", token: "token" } }),
}));
vi.mock("@/features/wallet/lib/resolve-stellar-wallet", () => ({
  resolveStellarWallet: mocks.resolve,
  ensureActiveStellarAccount: mocks.active,
}));
vi.mock("../lib/payments-api", () => ({
  paymentsApi: {
    prepareCheckout: mocks.prepare,
    authorizeCheckout: mocks.authorize,
    submitCheckout: mocks.submit,
    getCheckout: mocks.get,
  },
}));
const intent = {
  id: "intent",
  walletAddress: "wallet",
  amount: "10.0000000",
  destinationAddress: "treasury",
  assetCode: "USDC",
  networkPassphrase: "Test SDF Network ; September 2015",
} as PaymentIntentRecord;
const attempt = {
  id: "checkout",
  intentId: "intent",
  walletAddress: "wallet",
  transaction: "exact-xdr",
  transactionHash: "hash",
  status: "prepared",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockReturnValue({
    address: "wallet",
    signTransaction: mocks.sign,
  });
  mocks.sign.mockResolvedValue("signed-xdr");
  mocks.prepare.mockResolvedValue(attempt);
  mocks.authorize.mockResolvedValue({ ...attempt, status: "submitting" });
  mocks.submit.mockResolvedValue({ ...attempt, status: "confirmed" });
  mocks.get.mockResolvedValue({ ...attempt, status: "submitting" });
});
afterEach(cleanup);
function Pay() {
  const checkout = useStellarCheckout();
  const [result, setResult] = useState("");
  return (
    <>
      <button
        onClick={() =>
          void checkout(intent)
            .then(setResult)
            .catch((error) => setResult(error.message))
        }
      >
        Pay
      </button>
      <output aria-label="Checkout result">{result}</output>
    </>
  );
}
it("explicitly rejects checkout without a wallet provider", async () => {
  const user = userEvent.setup();
  render(<Pay />);
  await user.click(screen.getByRole("button", { name: "Pay" }));
  expect(screen.getByLabelText("Checkout result").textContent).toContain(
    "require a configured Dynamic provider",
  );
  expect(mocks.sign).not.toHaveBeenCalled();
});
it("reviews the exact amount and authorizes the persisted envelope before submission", async () => {
  const user = userEvent.setup();
  render(
    <StellarCheckoutProvider>
      <Pay />
    </StellarCheckoutProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Pay" }));
  await screen.findByRole("dialog", { name: "Review payment" });
  expect(screen.getByText("10.0000000 USDC")).toBeTruthy();
  expect(mocks.sign).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Confirm and pay" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Checkout result").textContent).toBe("hash"),
  );
  expect(mocks.sign).toHaveBeenCalledWith("exact-xdr");
  expect(mocks.authorize).toHaveBeenCalledWith(
    "token",
    "checkout",
    "signed-xdr",
  );
  expect(mocks.authorize.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.submit.mock.invocationCallOrder[0]!,
  );
});
it("cancelling review requests no signature and submits nothing", async () => {
  const user = userEvent.setup();
  render(
    <StellarCheckoutProvider>
      <Pay />
    </StellarCheckoutProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Pay" }));
  await user.click(await screen.findByRole("button", { name: "Cancel" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Checkout result").textContent).toBe(
      "Payment cancelled",
    ),
  );
  expect(mocks.sign).not.toHaveBeenCalled();
  expect(mocks.submit).not.toHaveBeenCalled();
});
it("an already submitted checkout resumes confirmation without signing again", async () => {
  mocks.prepare.mockResolvedValue({ ...attempt, status: "submitting" });
  mocks.get.mockResolvedValue({ ...attempt, status: "confirmed" });
  const user = userEvent.setup();
  render(
    <StellarCheckoutProvider>
      <Pay />
    </StellarCheckoutProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Pay" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Checkout result").textContent).toBe("hash"),
  );
  expect(mocks.sign).not.toHaveBeenCalled();
  expect(mocks.authorize).not.toHaveBeenCalled();
});
it("lost authorization response recovers the server state without another signature", async () => {
  mocks.authorize.mockRejectedValue(new Error("Connection interrupted"));
  mocks.get.mockResolvedValue({ ...attempt, status: "confirmed" });
  const user = userEvent.setup();
  render(
    <StellarCheckoutProvider>
      <Pay />
    </StellarCheckoutProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Pay" }));
  await user.click(
    await screen.findByRole("button", { name: "Confirm and pay" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Checkout result").textContent).toBe("hash"),
  );
  expect(mocks.sign).toHaveBeenCalledOnce();
  expect(mocks.submit).not.toHaveBeenCalled();
});

it("an unavailable authorization response and status check cannot trigger a second signature", async () => {
  mocks.authorize.mockRejectedValue(new Error("Connection interrupted"));
  mocks.get.mockRejectedValue(new Error("API unavailable"));
  const user = userEvent.setup();
  render(
    <StellarCheckoutProvider>
      <Pay />
    </StellarCheckoutProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Pay" }));
  await user.click(
    await screen.findByRole("button", { name: "Confirm and pay" }),
  );
  await screen.findByRole("dialog", { name: "Checking payment" });
  expect(screen.queryByRole("button", { name: "Confirm and pay" })).toBeNull();
  expect(mocks.sign).toHaveBeenCalledOnce();
  expect(mocks.submit).not.toHaveBeenCalled();
});
