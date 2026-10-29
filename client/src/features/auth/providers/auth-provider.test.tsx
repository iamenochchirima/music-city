import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  dynamicToken: "dynamic-jwt",
  user: null as null | {
    userId: string;
    email: string;
    verifiedCredentials: { chain: string; address: string }[];
  },
  userWithMissingInfo: false,
  primaryWalletAddress: null as string | null,
  showAuthFlow: false,
  setShowAuthFlow: vi.fn(),
  setShowLinkNewWalletModal: vi.fn(),
  handleLogOut: vi.fn(),
  createDynamicSession: vi.fn(),
  getMe: vi.fn(),
  getOnboardingState: vi.fn(),
  bindReferralWallet: vi.fn(),
  clearReferral: vi.fn(),
  toast: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("@dynamic-labs/sdk-react-core", () => ({
  getAuthToken: () => mocks.dynamicToken,
  useDynamicContext: () => ({
    sdkHasLoaded: true,
    user: mocks.user,
    userWithMissingInfo: mocks.userWithMissingInfo,
    primaryWallet: mocks.user
      ? {
          address:
            mocks.primaryWalletAddress ?? mocks.user.verifiedCredentials[0]?.address,
          connector: {},
        }
      : null,
    showAuthFlow: mocks.showAuthFlow,
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.routerPush }) }));

import {
  AuthProvider,
  DYNAMIC_AUTH_CANCEL_EVENT,
  useAuthContext,
} from "./auth-provider";
import { AuthPanel } from "../components/auth-panel";

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
      {auth.walletLinkRequired && <p role="status">Link your Stellar wallet to finish signing in.</p>}
      <button onClick={() => void auth.connectWallet()}>
        {auth.walletLinkRequired ? "Connect Stellar wallet" : "Sign in"}
      </button>
      {auth.session && <p role="status">Signed in as {auth.session.walletAddress}</p>}
      {auth.error && <p role="alert">{auth.error}</p>}
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.user = null;
  mocks.userWithMissingInfo = false;
  mocks.primaryWalletAddress = null;
  mocks.showAuthFlow = false;
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

it("offers wallet linking when Dynamic login arrives before its Stellar credential", async () => {
  mocks.user = {
    userId: "dynamic-user-without-stellar",
    email: "artist@example.com",
    verifiedCredentials: [],
  };
  mocks.userWithMissingInfo = true;

  const view = render(
    <AuthProvider>
      <LoginControls />
    </AuthProvider>,
  );

  expect((await screen.findByRole("status")).textContent).toContain(
    "Link your Stellar wallet to finish signing in.",
  );
  expect(mocks.createDynamicSession).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: "Connect Stellar wallet" }));
  expect(mocks.setShowLinkNewWalletModal).toHaveBeenCalledWith(true);
  act(() => window.dispatchEvent(new Event(DYNAMIC_AUTH_CANCEL_EVENT)));
  expect(screen.getByRole("button", { name: "Connect Stellar wallet" })).toBeTruthy();

  mocks.userWithMissingInfo = false;
  mocks.user = {
    userId: "dynamic-user-with-stellar",
    email: "artist@example.com",
    verifiedCredentials: [{ chain: "stellar", address: walletAddress }],
  };
  view.rerender(
    <AuthProvider>
      <LoginControls />
    </AuthProvider>,
  );

  expect(await screen.findByText(`Signed in as ${walletAddress}`)).toBeTruthy();
  expect(mocks.createDynamicSession).toHaveBeenCalledWith(
    { walletAddress },
    "dynamic-jwt",
  );
});

it("shows a clear connect-wallet action instead of a raw missing-credential error", async () => {
  mocks.user = {
    userId: "dynamic-user-without-stellar",
    email: "artist@example.com",
    verifiedCredentials: [],
  };
  mocks.userWithMissingInfo = true;

  render(
    <AuthProvider>
      <AuthPanel />
    </AuthProvider>,
  );

  expect(await screen.findByText("Link your Stellar wallet to finish signing in.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Connect Stellar wallet" }));
  expect(mocks.setShowLinkNewWalletModal).toHaveBeenCalledWith(true);
  expect(screen.getByText("Link your Stellar wallet to finish signing in.")).toBeTruthy();
});

it("retries a rejected first session after the user links the matching Stellar wallet", async () => {
  mocks.user = {
    userId: "dynamic-user-with-stellar-pending",
    email: "artist@example.com",
    verifiedCredentials: [],
  };
  mocks.primaryWalletAddress = walletAddress;
  mocks.createDynamicSession.mockRejectedValueOnce(
    new Error("Requested Stellar wallet is not linked to this Dynamic user"),
  );

  const view = render(
    <AuthProvider>
      <AuthPanel />
    </AuthProvider>,
  );

  expect(await screen.findByText("Link your Stellar wallet to finish signing in.")).toBeTruthy();
  expect(mocks.createDynamicSession).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole("button", { name: "Connect Stellar wallet" }));
  expect(mocks.setShowLinkNewWalletModal).toHaveBeenCalledWith(true);

  mocks.user = {
    userId: "dynamic-user-with-stellar-pending",
    email: "artist@example.com",
    verifiedCredentials: [{ chain: "stellar", address: walletAddress }],
  };
  view.rerender(
    <AuthProvider>
      <AuthPanel />
    </AuthProvider>,
  );

  expect(await screen.findByText("Connected. Redirecting you now.")).toBeTruthy();
  expect(mocks.createDynamicSession).toHaveBeenCalledTimes(2);
});

it("preserves provider reauthentication prompts for an existing user", async () => {
  mocks.user = { userId: "dynamic-user", email: session.email, verifiedCredentials: [{ chain: "stellar", address: walletAddress }] };
  mocks.showAuthFlow = true;
  render(<AuthProvider><LoginControls /></AuthProvider>);
  await waitFor(() => expect(mocks.createDynamicSession).toHaveBeenCalled());
  expect(mocks.setShowAuthFlow).not.toHaveBeenCalledWith(false);
});
