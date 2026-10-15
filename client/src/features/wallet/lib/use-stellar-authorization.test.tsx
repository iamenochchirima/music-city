import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StellarWallet } from "@dynamic-labs/stellar";
import { useStellarAuthorization } from "./use-stellar-authorization";
const m = vi.hoisted(() => ({ required: vi.fn(), prompt: vi.fn(), active: vi.fn(), sign: vi.fn() }));
vi.mock("@dynamic-labs/sdk-react-core", () => ({ useStepUpAuthentication: () => ({ isStepUpRequired: m.required, promptStepUpAuth: m.prompt }) }));
vi.mock("./resolve-stellar-wallet", () => ({ ensureActiveStellarAccount: m.active }));
function Sign() { const authorize = useStellarAuthorization(); return <button onClick={() => void authorize({} as StellarWallet).then(() => m.sign("exact-xdr")).catch(() => {})}>Sign</button>; }
beforeEach(() => { vi.clearAllMocks(); m.required.mockResolvedValue(false); m.prompt.mockResolvedValue(undefined); });
afterEach(cleanup);
it("signs without extra prompts when the provider requires no step-up", async () => { render(<Sign/>); await userEvent.click(screen.getByRole("button")); expect(m.active).toHaveBeenCalled(); expect(m.required).toHaveBeenCalledWith({scope:"wallet:sign"}); expect(m.prompt).not.toHaveBeenCalled(); expect(m.sign).toHaveBeenCalledWith("exact-xdr"); });
it("requests the exact signing scope before the wallet can sign", async () => { m.required.mockResolvedValue(true); render(<Sign/>); await userEvent.click(screen.getByRole("button")); expect(m.prompt).toHaveBeenCalledWith({requestedScopes:["wallet:sign"]}); expect(m.prompt.mock.invocationCallOrder[0]).toBeLessThan(m.sign.mock.invocationCallOrder[0]); });
it.each(["Reauthentication flow closed", "User cancelled signing"])("never signs after cancelled provider verification: %s", async message => { m.required.mockResolvedValue(true); m.prompt.mockRejectedValue(new Error(message)); render(<Sign/>); await userEvent.click(screen.getByRole("button")); expect(m.sign).not.toHaveBeenCalled(); });
it("never signs when authorization fails", async () => { m.required.mockRejectedValue(new Error("Provider unavailable")); render(<Sign/>); await userEvent.click(screen.getByRole("button")); expect(m.sign).not.toHaveBeenCalled(); expect(m.prompt).not.toHaveBeenCalled(); });
