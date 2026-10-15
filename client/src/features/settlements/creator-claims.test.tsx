import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FinancialAttempt, SettlementBatch } from "@music-city/shared";
import { CreatorClaims } from "./creator-claims";
const m = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  sign: vi.fn(),
  wallet: `G${"A".repeat(55)}`,
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { token: "creator-session", walletAddress: m.wallet },
  }),
}));
vi.mock("@/lib/api/http-client", () => ({
  httpClient: { get: m.get, post: m.post },
}));
vi.mock("@dynamic-labs/sdk-react-core", () => ({
  useStepUpAuthentication: () => ({ isStepUpRequired: async () => false, promptStepUpAuth: async () => undefined }),
  useDynamicContext: () => ({
    primaryWallet: {
      address: m.wallet,
      chain: "stellar",
      connector: {},
      signTransaction: m.sign,
    },
  }),
  useUserWallets: () => [],
}));
vi.mock("@dynamic-labs/stellar", () => ({
  isStellarWallet: (w: { chain: string }) => w.chain === "stellar",
}));
vi.mock("@/lib/config/env", () => ({
  clientEnv: {
    stellarNetworkPassphrase: "Test SDF Network ; September 2015",
    stellarHorizonUrl: "https://horizon-testnet.stellar.org",
  },
}));
let batch: SettlementBatch, attempts: FinancialAttempt[];
beforeEach(() => {
  vi.clearAllMocks();
  attempts = [];
  batch = {
    id: "1".repeat(64),
    sourceKey: "2".repeat(64),
    trackId: "track",
    sourceType: "track_purchase",
    sourceId: "source",
    agreementId: "agreement",
    version: 1,
    proposalHash: "3".repeat(64),
    grossUnits: "1000000000",
    feeBps: 0,
    fundedUnits: "1000000000",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    config: {
      contractId: "contract",
      registryId: "registry",
      assetContractId: "asset",
      treasuryAddress: `G${"B".repeat(55)}`,
      networkPassphrase: "Test SDF Network ; September 2015",
      assetCode: "USDC",
      assetIssuer: `G${"C".repeat(55)}`,
    },
    allocations: [
      {
        index: 0,
        beneficiary: m.wallet,
        grossUnits: "700000000",
        feeUnits: "0",
        amountUnits: "700000000",
        ledgerEntryIds: ["entry"],
        status: "available",
      },
    ],
    state: "funded",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  m.get.mockImplementation(async (p: string) =>
    p === "/settlements/balances"
      ? { pendingUnits: "0" }
      : p === "/settlements"
        ? { items: [batch] }
        : { batch, attempts },
  );
  m.sign.mockResolvedValue("exact-signed-transaction");
  m.post.mockImplementation(async (p: string) =>
    p.endsWith("/prepare")
      ? {
          attempt: {
            id: "claim-attempt",
            status: "awaiting_signatures",
            transaction: "exact-prepared-transaction",
            networkPassphrase: batch.config.networkPassphrase,
            treasuryAddress: m.wallet,
          },
        }
      : {},
  );
});
afterEach(cleanup);
it("requires review, then signs and submits the bound beneficiary claim", async () => {
  const user = userEvent.setup();
  render(<CreatorClaims />);
  await user.click(await screen.findByRole("button", { name: "Claim USDC" }));
  expect(m.post).not.toHaveBeenCalled();
  expect(
    screen.getByRole("region", { name: "Review withdrawal" }).textContent,
  ).toContain(m.wallet);
  await user.click(screen.getByRole("button", { name: "Sign and claim" }));
  await waitFor(() =>
    expect(m.post).toHaveBeenCalledWith(
      "/settlements/attempts/claim-attempt/submit",
      {},
      "creator-session",
    ),
  );
  expect(m.sign).toHaveBeenCalledWith("exact-prepared-transaction");
});
it("wallet cancellation keeps the claim available without submitting a withdrawal", async () => {
  m.sign.mockRejectedValueOnce(new Error("Signing cancelled"));
  const user = userEvent.setup();
  render(<CreatorClaims />);
  await user.click(await screen.findByRole("button", { name: "Claim USDC" }));
  await user.click(screen.getByRole("button", { name: "Sign and claim" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Signing cancelled",
  );
  expect(m.post.mock.calls.some(([p]) => String(p).endsWith("/submit"))).toBe(
    false,
  );
  expect(
    screen.getByRole("button", { name: "Claim USDC" }).hasAttribute("disabled"),
  ).toBe(false);
});
it("shows confirming progress and blocks a second claim during uncertain submission", async () => {
  attempts = [
    {
      batchId: batch.id,
      claimIndex: 0,
      status: "submitted",
    } as FinancialAttempt,
  ];
  render(<CreatorClaims />);
  expect(await screen.findByText("Confirming withdrawal")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Claim USDC" })).toBeNull();
});
it("expired claims cannot be submitted and confirmed claims show their receipt", async () => {
  batch.expiresAt = new Date(Date.now() - 1000).toISOString();
  const view = render(<CreatorClaims />);
  expect(await screen.findByText("Claim expired")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Claim USDC" })).toBeNull();
  view.unmount();
  batch.allocations[0]!.status = "claimed";
  batch.allocations[0]!.transactionHash = "4".repeat(64);
  render(<CreatorClaims />);
  expect(
    (await screen.findByRole("link", { name: "View receipt" })).getAttribute(
      "href",
    ),
  ).toContain("4".repeat(64));
});
it("wrong network or beneficiary stops signing before funds can move", async () => {
  m.post.mockResolvedValue({
    attempt: {
      id: "claim-attempt",
      status: "awaiting_signatures",
      networkPassphrase: "wrong-network",
      treasuryAddress: m.wallet,
    },
  });
  const user = userEvent.setup();
  render(<CreatorClaims />);
  await user.click(await screen.findByRole("button", { name: "Claim USDC" }));
  await user.click(screen.getByRole("button", { name: "Sign and claim" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "network changed",
  );
  expect(m.sign).not.toHaveBeenCalled();
});
