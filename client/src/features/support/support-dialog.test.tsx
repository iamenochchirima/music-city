import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SupportPayment, SupportRecipient } from "@music-city/shared";
import { SupportDialog } from "./support-dialog";
const m = vi.hoisted(() => ({
  prepare: vi.fn(),
  authorize: vi.fn(),
  submit: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
  sign: vi.fn(),
  walletAuth: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { token: "token", walletAddress: "GSENDER" },
    connectWallet: vi.fn(),
  }),
}));
vi.mock("@dynamic-labs/sdk-react-core", () => ({
  useDynamicContext: () => ({ primaryWallet: { address: "GSENDER" } }),
  useUserWallets: () => [],
}));
vi.mock("@/features/wallet/lib/resolve-stellar-wallet", () => ({
  resolveStellarWallet: () => ({ address: "GSENDER", signTransaction: m.sign }),
}));
vi.mock("@/features/wallet/lib/use-stellar-authorization", () => ({
  useStellarAuthorization: () => m.walletAuth,
}));
vi.mock("@/lib/config/env", () => ({
  clientEnv: { stellarNetworkPassphrase: "Test SDF Network ; September 2015" },
}));
vi.mock("./support-api", () => ({
  supportApi: {
    prepare: m.prepare,
    authorize: m.authorize,
    submit: m.submit,
    get: m.get,
    cancel: m.cancel,
  },
  supportAmount: (a: string) => a,
  supportReceiptUrl: () => "https://stellar.expert/explorer/testnet/tx/hash",
}));
const recipient: SupportRecipient = {
  name: "Artist",
  walletAddress: "GRECIPIENT",
  role: "Artist",
  target: { kind: "artist", profileId: "artist" },
};
const payment = {
  id: "payment",
  sender: "GSENDER",
  recipient,
  amount: "5.0000000",
  networkPassphrase: "Test SDF Network ; September 2015",
  transaction: "exact-xdr",
  transactionHash: "hash",
  status: "prepared",
} as SupportPayment;
beforeEach(() => {
  vi.clearAllMocks();
  m.prepare.mockResolvedValue(payment);
  m.sign.mockResolvedValue("signed-xdr");
  m.walletAuth.mockResolvedValue(undefined);
  m.authorize.mockResolvedValue({ ...payment, status: "submitting" });
  m.submit.mockResolvedValue({ ...payment, status: "confirmed" });
  m.get.mockResolvedValue(payment);
  m.cancel.mockResolvedValue({ ...payment, status: "cancelled" });
});
afterEach(cleanup);
it("reviews the server-resolved amount and destination before signing the exact transaction", async () => {
  const user = userEvent.setup();
  render(<SupportDialog recipient={recipient} onClose={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Sign and send" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Review support" }));
  expect(await screen.findByText("GRECIPIENT")).toBeTruthy();
  expect(m.sign).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Sign and send" }));
  await screen.findByText("Support sent");
  expect(m.sign).toHaveBeenCalledWith("exact-xdr");
  expect(m.authorize).toHaveBeenCalledWith("token", "payment", "signed-xdr");
  expect(m.submit).toHaveBeenCalledTimes(1);
});
it("wallet cancellation records no authorization or submission and permits retrying the same review", async () => {
  const user = userEvent.setup();
  m.walletAuth.mockRejectedValueOnce(
    new Error("Wallet authorization cancelled"),
  );
  render(
    <SupportDialog
      recipient={recipient}
      initialPayment={payment}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Sign and send" }));
  await screen.findByRole("alert");
  expect(m.sign).not.toHaveBeenCalled();
  expect(m.authorize).not.toHaveBeenCalled();
  expect(m.submit).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Sign and send" }));
  await screen.findByText("Support sent");
  expect(m.authorize).toHaveBeenCalledWith("token", "payment", "signed-xdr");
});
it("wrong network never opens wallet signing", async () => {
  const user = userEvent.setup();
  render(
    <SupportDialog
      recipient={recipient}
      initialPayment={{
        ...payment,
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      }}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Sign and send" }));
  await screen.findByRole("alert");
  expect(m.sign).not.toHaveBeenCalled();
  expect(m.authorize).not.toHaveBeenCalled();
});
it("explicit cancellation closes only after the prepared payment is cancelled", async () => {
  const user = userEvent.setup();
  const close = vi.fn();
  render(
    <SupportDialog
      recipient={recipient}
      initialPayment={payment}
      onClose={close}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(m.cancel).toHaveBeenCalledWith("token", "payment");
  expect(m.submit).not.toHaveBeenCalled();
});
it("a lost submission response recovers the original pending payment", async () => {
  const user = userEvent.setup();
  m.submit.mockRejectedValue(new Error("Failed to fetch"));
  m.get.mockResolvedValue({ ...payment, status: "submitting" });
  render(
    <SupportDialog
      recipient={recipient}
      initialPayment={payment}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Sign and send" }));
  await screen.findByText("Confirming payment");
  expect(screen.queryByRole("button", { name: "Sign and send" })).toBeNull();
  expect(m.prepare).not.toHaveBeenCalled();
  expect(m.submit).toHaveBeenCalledTimes(1);
});
