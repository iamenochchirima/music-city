import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/features/wallet/lib/freighter", () => ({
  signInWithFreighter: mocks.signIn,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toast } }));

import { AuthProvider, useAuthContext } from "./auth-provider";

const session = {
  walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  displayName: "",
  primaryIntent: "listener" as const,
  artistAccess: false,
  onboardingStatus: "required" as const,
  onboardingStep: "identity" as const,
  onboardingVersion: 1,
  token: "session-token",
  profileCompletion: {
    percentage: 0,
    completed: [],
    missing: [],
    requiredComplete: false,
  },
};

function Login() {
  const auth = useAuthContext();
  return (
    <>
      <button
        disabled={auth.isLoading}
        onClick={() =>
          auth.walletSignInTimedOut
            ? window.location.reload()
            : void auth.connectWallet()
        }
      >
        {auth.walletSignInTimedOut
          ? "Reload to retry"
          : auth.isLoading
            ? "Waiting for wallet…"
            : "Connect wallet"}
      </button>
      {auth.session && <p role="status">Signed in as {auth.session.walletAddress}</p>}
      {auth.error && <p role="alert">{auth.error}</p>}
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.signIn.mockResolvedValue(session);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("creates the app session from a Freighter wallet signature", async () => {
  render(
    <AuthProvider>
      <Login />
    </AuthProvider>,
  );

  await userEvent.click(await screen.findByRole("button", { name: "Connect wallet" }));

  expect(mocks.signIn).toHaveBeenCalledOnce();
  expect((await screen.findByRole("status")).textContent).toContain(session.walletAddress);
  expect(JSON.parse(localStorage.getItem("music-city-auth-session") ?? "{}"))
    .toMatchObject({ walletAddress: session.walletAddress, token: session.token });
});

it("shows wallet errors without blocking another attempt", async () => {
  mocks.signIn.mockRejectedValueOnce(new Error("Freighter is not installed"));
  render(
    <AuthProvider>
      <Login />
    </AuthProvider>,
  );

  await userEvent.click(await screen.findByRole("button", { name: "Connect wallet" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Freighter is not installed");
  expect((screen.getByRole("button", { name: "Connect wallet" }) as HTMLButtonElement).disabled).toBe(false);
  expect(mocks.toast).toHaveBeenCalledWith("Freighter is not installed");
});

it("stops waiting when Freighter does not respond and requires a page reload", async () => {
  vi.useFakeTimers();
  mocks.signIn.mockImplementation(
    (signal: AbortSignal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
  );

  render(
    <AuthProvider>
      <Login />
    </AuthProvider>,
  );

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    await vi.advanceTimersByTimeAsync(30_000);
  });

  const message = screen.getByRole("alert").textContent ?? "";
  expect(message).toContain("Freighter did not respond in time");
  expect(message).toContain("reload this page");
  expect(
    (screen.getByRole("button", { name: "Reload to retry" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  expect(mocks.signIn).toHaveBeenCalledOnce();
});
