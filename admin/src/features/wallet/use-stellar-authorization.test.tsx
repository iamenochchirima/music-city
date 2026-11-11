import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StellarWallet } from "@dynamic-labs/stellar";
import { useStellarAuthorization } from "./use-stellar-authorization";
const m = vi.hoisted(() => ({ required: vi.fn(), prompt: vi.fn(), active: vi.fn(), sign: vi.fn(), showAuth: vi.fn() }));
vi.mock("@dynamic-labs/sdk-react-core", () => ({ useDynamicContext: () => ({ setShowAuthFlow: m.showAuth }), useStepUpAuthentication: () => ({ isStepUpRequired: m.required, promptStepUpAuth: m.prompt }) }));
vi.mock("./resolve-stellar-wallet", () => ({ ensureActiveStellarAccount: m.active }));
function Sign() { const authorize = useStellarAuthorization(); return <button onClick={() => void authorize({} as StellarWallet).then(() => m.sign("exact-xdr")).catch(() => {})}>Sign</button>; }
beforeEach(() => { vi.resetAllMocks(); m.required.mockResolvedValue(false); m.prompt.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("signs without extra prompts when the provider requires no step-up", async () => { render(<Sign/>); await userEvent.click(screen.getByRole("button")); expect(m.active).toHaveBeenCalled(); expect(m.required).toHaveBeenCalledWith({scope:"wallet:sign"}); expect(m.prompt).not.toHaveBeenCalled(); expect(m.sign).toHaveBeenCalledWith("exact-xdr"); });
it("requests the exact signing scope before the wallet can sign", async () => { m.required.mockResolvedValueOnce(true).mockResolvedValue(false); render(<Sign/>); await userEvent.click(screen.getByRole("button")); expect(m.prompt).toHaveBeenCalledWith({requestedScopes:["wallet:sign"]}); expect(m.prompt.mock.invocationCallOrder[0]).toBeLessThan(m.sign.mock.invocationCallOrder[0]); });
it.each(["Reauthentication flow closed", "User cancelled signing"])("never signs after cancelled provider verification: %s", async message => { m.required.mockResolvedValue(true); m.prompt.mockRejectedValue(new Error(message)); render(<Sign/>); await userEvent.click(screen.getByRole("button")); expect(m.sign).not.toHaveBeenCalled(); });
it("never signs when authorization fails", async () => { m.required.mockRejectedValue(new Error("Provider unavailable")); render(<Sign/>); await userEvent.click(screen.getByRole("button")); expect(m.sign).not.toHaveBeenCalled(); expect(m.prompt).not.toHaveBeenCalled(); });

it("continues the original signing request when Google grants the scope but the prompt promise stays pending", async () => {
  m.required.mockResolvedValueOnce(true).mockResolvedValue(false);
  m.prompt.mockImplementation(() => new Promise(() => {}));
  render(<Sign />);
  await userEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(m.sign).toHaveBeenCalledWith("exact-xdr"), { timeout: 1600 });
  expect(m.showAuth).toHaveBeenCalledWith(false);
});

it("never resumes a pending prompt while wallet authorization is still required", async () => {
  vi.useFakeTimers();
  m.required.mockResolvedValue(true);
  m.prompt.mockImplementation(() => new Promise(() => {}));
  const { result, unmount } = renderHook(() => useStellarAuthorization());
  const done = result.current({} as StellarWallet).then(m.sign, () => {});
  await act(() => vi.advanceTimersByTimeAsync(3_000));
  expect(m.sign).not.toHaveBeenCalled();
  expect(m.showAuth).not.toHaveBeenCalled();
  unmount();
  await done;
});

it("never resumes signing after navigation even if authorization later succeeds", async () => {
  vi.useFakeTimers();
  m.required.mockResolvedValue(true);
  let completePrompt!: () => void;
  m.prompt.mockImplementation(() => new Promise<void>(resolve => { completePrompt = resolve; }));
  const { result, unmount } = renderHook(() => useStellarAuthorization());
  const done = result.current({} as StellarWallet).then(m.sign, () => {});
  await act(() => vi.advanceTimersByTimeAsync(0));
  unmount();
  m.required.mockResolvedValue(false);
  completePrompt();
  await act(() => vi.advanceTimersByTimeAsync(2_000));
  await done;
  expect(m.sign).not.toHaveBeenCalled();
  expect(m.showAuth).not.toHaveBeenCalled();
});

it("honors cancellation while an authorization readiness check is in flight", async () => {
  vi.useFakeTimers();
  let completeCheck!: (required: boolean) => void;
  let cancelPrompt!: (reason: Error) => void;
  m.required.mockResolvedValueOnce(true).mockImplementation(() => new Promise<boolean>(resolve => { completeCheck = resolve; }));
  m.prompt.mockImplementation(() => new Promise<void>((_resolve, reject) => { cancelPrompt = reject; }));
  const { result } = renderHook(() => useStellarAuthorization());
  const done = result.current({} as StellarWallet).then(m.sign, () => {});
  await act(() => vi.advanceTimersByTimeAsync(1_000));
  cancelPrompt(new Error("Reauthentication flow closed"));
  await done;
  completeCheck(false);
  await act(() => vi.advanceTimersByTimeAsync(2_000));
  expect(m.sign).not.toHaveBeenCalled();
  expect(m.showAuth).not.toHaveBeenCalled();
});

it("stops waiting with an error when provider authorization never completes", async () => {
  vi.useFakeTimers();
  m.required.mockResolvedValue(true);
  m.prompt.mockImplementation(() => new Promise(() => {}));
  const failed = vi.fn();
  const { result } = renderHook(() => useStellarAuthorization());
  const done = result.current({} as StellarWallet).then(m.sign, failed);
  await act(() => vi.advanceTimersByTimeAsync(120_000));
  await done;
  expect(failed).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("timed out") }));
  expect(m.sign).not.toHaveBeenCalled();
  expect(m.showAuth).toHaveBeenCalledWith(false);
  expect(vi.getTimerCount()).toBe(0);
});

it("does not authorize after navigation while wallet activation is still pending", async () => {
  let completeActivation!: () => void;
  m.active.mockImplementation(() => new Promise<void>(resolve => { completeActivation = resolve; }));
  const { result, unmount } = renderHook(() => useStellarAuthorization());
  const done = result.current({} as StellarWallet).then(m.sign, () => {});
  unmount();
  completeActivation();
  await done;
  expect(m.required).not.toHaveBeenCalled();
  expect(m.sign).not.toHaveBeenCalled();
});
