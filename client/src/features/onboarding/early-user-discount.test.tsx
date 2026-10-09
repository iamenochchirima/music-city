import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ArtistActivationQuote } from "@music-city/shared";

import { ArtistActivationSummary } from "../sponsorships/artist-activation-summary";
import { useArtistOnboardingPayment } from "./hooks/use-artist-onboarding-payment";

const mocks = vi.hoisted(() => ({
  getActivation: vi.fn(),
  createIntent: vi.fn(),
  confirm: vi.fn(),
  runCheckout: vi.fn(),
  refreshSessionProfile: vi.fn(),
}));

vi.mock("@dynamic-labs/sdk-react-core", () => ({
  useDynamicContext: () => ({ primaryWallet: null }),
  useUserWallets: () => [],
}));
vi.mock("@dynamic-labs/stellar", () => ({ isStellarWallet: () => false }));

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({
  session: { token: "test-token",walletAddress: "GTEST",primaryIntent: "listener",displayName: "",email: "",artistAccess: false,onboardingStatus: "required",onboardingStep: "identity" },
  refreshSessionProfile: mocks.refreshSessionProfile,
}) }));
vi.mock("@/features/payments/lib/payments-api", () => ({ paymentsApi: {
  getArtistOnboardingFeeStatus: mocks.getActivation,
  createArtistOnboardingFeeIntent: mocks.createIntent,
  confirm: mocks.confirm,
} }));
vi.mock("@/features/onboarding/hooks/use-stellar-checkout", () => ({ useStellarCheckout: () => mocks.runCheckout }));

const eligibleQuote: ArtistActivationQuote = {
  currency: "USD",originalAmountMinor: 2000,discountAmountMinor: 2000,discountPercent: 100,
  amountDueMinor: 0,campaignCode: "EARLYUSER",termsRevision: "v1",status: "eligible",artistAccess: false,activatedAt: null,
  profileExists: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActivation.mockResolvedValue(eligibleQuote);
  mocks.refreshSessionProfile.mockResolvedValue(undefined);
});
afterEach(cleanup);

it("shows the $20 price and automatic 100% discount in the activation summary", () => {
  render(<ArtistActivationSummary quote={eligibleQuote} />);
  const summary = screen.getByLabelText("Artist activation");
  expect(summary.textContent).toContain("$20.00");
  expect(summary.textContent).toContain("100% early-user discount");
  expect(summary.textContent).toContain("Amount due");
  expect(summary.textContent).toContain("No payment or transaction is needed");
});

it("does not prepare or sign a payment when the server says activation is sponsored", async () => {
  mocks.getActivation.mockResolvedValue(eligibleQuote);
  const { result } = renderHook(() => useArtistOnboardingPayment());
  await waitFor(() => expect(result.current.isChecking).toBe(false));
  await expect(result.current.prepare()).rejects.toThrow("Music City has covered your artist activation fee");
  expect(mocks.createIntent).not.toHaveBeenCalled();
  expect(mocks.runCheckout).not.toHaveBeenCalled();
});
