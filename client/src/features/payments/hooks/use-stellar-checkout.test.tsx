import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PaymentIntentRecord } from "@music-city/shared";
import { StellarCheckoutProvider, useStellarCheckout } from "./use-stellar-checkout";
const mocks = vi.hoisted(() => ({ send: vi.fn(), active: vi.fn(), resolve: vi.fn() }));
vi.mock("@dynamic-labs/sdk-react-core", () => ({ useDynamicContext: () => ({ primaryWallet: { address: "wallet" } }), useUserWallets: () => [] }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: { walletAddress: "wallet" } }) }));
vi.mock("@/features/wallet/lib/resolve-stellar-wallet", () => ({ resolveStellarWallet: mocks.resolve, ensureActiveStellarAccount: mocks.active }));
const intent = { amount: "10", destinationAddress: "treasury", assetCode: "XLM" } as PaymentIntentRecord;
beforeEach(() => { vi.clearAllMocks(); mocks.resolve.mockReturnValue({ address: "wallet", sendBalance: mocks.send }); mocks.send.mockResolvedValue("real-transaction-hash"); });
afterEach(cleanup);
function Pay() {
  const checkout = useStellarCheckout(); const [result, setResult] = useState("");
  return <><button onClick={() => void checkout(intent).then(setResult).catch(error => setResult(error.message))}>Pay</button><output aria-label="Checkout result">{result}</output></>;
}
it("renders tools without a wallet provider and explicitly rejects a payment attempt", async () => {
  const user = userEvent.setup(); render(<Pay />);
  await user.click(screen.getByRole("button", { name: "Pay" }));
  expect(screen.getByLabelText("Checkout result").textContent).toContain("require a configured Dynamic provider");
  expect(mocks.send).not.toHaveBeenCalled();
});
it("preserves configured wallet checkout and requires the actual transaction hash", async () => {
  const user = userEvent.setup(); render(<StellarCheckoutProvider><Pay /></StellarCheckoutProvider>);
  await user.click(screen.getByRole("button", { name: "Pay" }));
  expect(screen.getByLabelText("Checkout result").textContent).toBe("real-transaction-hash");
  expect(mocks.active).toHaveBeenCalled();
  expect(mocks.send).toHaveBeenCalledWith({ amount: "10", toAddress: "treasury", token: undefined });
  mocks.send.mockResolvedValue("");
  await user.click(screen.getByRole("button", { name: "Pay" }));
  expect(screen.getByLabelText("Checkout result").textContent).toContain("did not return a Stellar transaction hash");
});
