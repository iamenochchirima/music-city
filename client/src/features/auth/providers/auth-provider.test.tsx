import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  dynamicToken: "dynamic-jwt",
  user: null as null | {
    userId: string;
    email: string;
    verifiedCredentials: { chain: string; address: string }[];
  },
  setShowAuthFlow: vi.fn(),
  setShowLinkNewWalletModal: vi.fn(),
  handleLogOut: vi.fn(),
  createDynamicSession: vi.fn(),
  getMe: vi.fn(),
  getOnboardingState: vi.fn(),
  bindReferralWallet: vi.fn(),
  clearReferral: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@dynamic-labs/sdk-react-core", () => ({
  getAuthToken: () => mocks.dynamicToken,
  useDynamicContext: () => ({
    sdkHasLoaded: true,
    user: mocks.user,
    userWithMissingInfo: false,
    primaryWallet: mocks.user
      ? { address: mocks.user.verifiedCredentials[0]?.address, connector: {} }
      : null,
    showAuthFlow: false,
    setShowAuthFlow: mocks.setShowAuthFlow,
    handleLogOut: mocks.handleLogOut,
  }),
  useDynamicModals: () => ({
    setShowLinkNewWalletModal: mocks.setShowLinkNewWalletModal,
  }),
}));
vi.mock("@/features/auth/lib/auth-api", () => ({
  authApi: { createDynamicSession: mocks.createDynamicSession },
}));
vi.mock("@/features/users/lib/users-api", () => ({
  usersApi: {
    getMe: mocks.getMe,
    getOnboardingState: mocks.getOnboardingState,
  },
}));
vi.mock("@/features/referrals/referral-storage", () => ({
  bindReferralWallet: mocks.bindReferralWallet,
  clearReferral: mocks.clearReferral,
}));
vi.mock("@/lib/config/env", () => ({
  clientEnv: {
    isDynamicConfigured: true,
    dynamicEnvironmentId: "test-dynamic-environment",
  },
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toast } }));

import { AuthProvider, useAuthContext } from "./auth-provider";

const walletAddress = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const session = {
  walletAddress,
  email: "artist@example.com",
  displayName: "",
  primaryIntent: "listener" as const,
  artistAccess: false,
  onboardingStatus: "required" as const,
  onboardingStep: "identity" as const,
  onboardingVersion: 1,
  token: "music-city-session",
  profileCompletion: {
    percentage: 0,
    completed: [],
    missing: [],
    requiredComplete: false,
  },
};

function LoginControls() {
  const auth = useAuthContext();
  return (
    <>
      <button onClick={() => void auth.connectWallet()}>Sign in</button>
      {auth.session && <p role="status">Signed in as {auth.session.walletAddress}</p>}
      {auth.error && <p role="alert">{auth.error}</p>}
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.user = null;
  mocks.dynamicToken = "dynamic-jwt";
  mocks.createDynamicSession.mockResolvedValue(session);
  mocks.getMe.mockResolvedValue(null);
  mocks.getOnboardingState.mockResolvedValue(null);
});

afterEach(() => cleanup());

it("opens Dynamic's configured sign-in flow without requesting Freighter", async () => {
  render(
    <AuthProvider>
      <LoginControls />
    </AuthProvider>,
  );

  await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));

  expect(mocks.setShowAuthFlow).toHaveBeenCalledWith(true);
  expect(mocks.createDynamicSession).not.toHaveBeenCalled();
});

it("verifies a Dynamic login, creates the app session, and binds a referral to its Stellar wallet", async () => {
  mocks.user = {
    userId: "dynamic-user",
    email: "artist@example.com",
    verifiedCredentials: [{ chain: "stellar", address: walletAddress }],
  };

  render(
    <AuthProvider>
      <LoginControls />
    </AuthProvider>,
  );

  expect((await screen.findByRole("status")).textContent).toContain(walletAddress);
  expect(mocks.createDynamicSession).toHaveBeenCalledWith(
    { walletAddress },
    "dynamic-jwt",
  );
  expect(mocks.bindReferralWallet).toHaveBeenCalledWith(walletAddress);
  expect(JSON.parse(localStorage.getItem("music-city-auth-session") ?? "{}"))
    .toMatchObject({ walletAddress, token: session.token });
});
