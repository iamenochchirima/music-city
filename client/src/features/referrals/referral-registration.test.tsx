import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ReferralJoin } from "./referral-join";
import { ReferralCodeInput } from "./referral-code-input";
import { ReferralsOverview } from "./referrals-overview";
import { pendingReferral, rememberReferral, bindReferralWallet, clearReferral } from "./referral-storage";
import { usersApi } from "@/features/users/lib/users-api";

const mocks = vi.hoisted(() => ({ get: vi.fn(),post: vi.fn(),put: vi.fn(),session: { token: "test-token" } }));
vi.mock("@/lib/api/http-client",()=>({ httpClient: { get: mocks.get,post: mocks.post,put: mocks.put } }));
vi.mock("@/hooks/use-auth",()=>({ useAuth: () => ({ session: mocks.session }) }));
const invitation = { receipt: "signed-invitation",inviterName: "Tendai",campaign: "registration-v1",expiresAt: new Date(Date.now()+30*86400000).toISOString() };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); mocks.post.mockResolvedValue(invitation); mocks.put.mockResolvedValue({ profile: { id: "new-profile" } }); });
afterEach(cleanup);

it("link capture survives refresh and wallet sign-in, reaches registration, and clears after success",async () => {
  const first = render(<MemoryRouter initialEntries={["/join?ref=MC0123456789ABCDEF"]}><ReferralJoin /></MemoryRouter>);
  await screen.findByText(/You were invited by Tendai/);
  expect(mocks.post).toHaveBeenCalledWith("/referrals/capture",{ code: "MC0123456789ABCDEF" });
  first.unmount();
  bindReferralWallet("wallet-one");
  render(<MemoryRouter initialEntries={["/join?ref=MCFEDCBA9876543210"]}><ReferralJoin /></MemoryRouter>);
  await screen.findByText(/You were invited by Tendai/);
  expect(mocks.post).toHaveBeenCalledTimes(1);
  await usersApi.saveOnboardingStep("test-token",{ step: "identity",displayName: "Artist" });
  expect(mocks.put).toHaveBeenCalledWith("/users/me/onboarding",expect.objectContaining({ referralReceipt: invitation.receipt }),"test-token");
  expect(pendingReferral()).toBeNull();
});
it("failed registration retains the invitation for a safe retry",async () => {
  rememberReferral(invitation); mocks.put.mockRejectedValueOnce(new Error("Database unavailable"));
  await expect(usersApi.saveOnboardingStep("token",{ step: "identity",displayName: "Artist" })).rejects.toThrow("Database unavailable");
  expect(pendingReferral()?.receipt).toBe(invitation.receipt);
});
it("expired and corrupt storage clears; switching wallets and logout clear attribution",() => {
  rememberReferral({ ...invitation,expiresAt: new Date(0).toISOString() }); expect(pendingReferral()).toBeNull();
  localStorage.setItem("music-city:pending-referral","broken"); expect(pendingReferral()).toBeNull();
  rememberReferral(invitation); bindReferralWallet("one"); bindReferralWallet("two"); expect(pendingReferral()).toBeNull();
  rememberReferral(invitation); clearReferral(); expect(pendingReferral()).toBeNull();
});
it("explicit correction replaces attribution and removal allows ordinary registration",async () => {
  const user = userEvent.setup(); rememberReferral(invitation); render(<ReferralCodeInput />);
  mocks.post.mockResolvedValue({ ...invitation,receipt: "replacement",inviterName: "Nomsa" });
  await user.type(screen.getByLabelText(/Invitation code/),"MCFEDCBA9876543210"); await user.click(screen.getByRole("button",{ name: "Apply code" }));
  await screen.findByText(/Invited by Nomsa/); expect(pendingReferral()?.receipt).toBe("replacement");
  await user.click(screen.getByRole("button",{ name: "Remove invitation" }));
  await usersApi.saveOnboardingStep("token",{ step: "identity",displayName: "Artist" });
  expect(mocks.put).toHaveBeenCalledWith("/users/me/onboarding",expect.objectContaining({ referralReceipt: undefined }),"token");
});
it("keeps an optional invitation code tucked away until the user chooses to add one", async () => {
  const user = userEvent.setup();
  render(<ReferralCodeInput />);
  expect(screen.queryByLabelText(/Invitation code/)).toBeNull();
  await user.click(screen.getByRole("button", { name: "Add code" }));
  expect(screen.getByLabelText(/Invitation code/)).toBeTruthy();
});
it("invalid link offers ordinary signup without retaining attribution",async () => {
  mocks.post.mockRejectedValue(new Error("Invitation code was not found."));
  render(<MemoryRouter initialEntries={["/join?ref=invalid"]}><ReferralJoin /></MemoryRouter>);
  await screen.findByText(/You can still register/); expect(screen.getByRole("link",{ name: "Continue to registration" }).getAttribute("href")).toBe("/auth"); expect(pendingReferral()).toBeNull();
});
it("dashboard shows progress and totals, retries a failed load and copies the shareable link",async () => {
  const user = userEvent.setup();
  mocks.get.mockRejectedValueOnce(new Error("Temporarily unavailable")).mockResolvedValue({ enabled: true,code: "MC0123456789ABCDEF",campaign: "registration-v1",rewardsEnabled: false,totals: { started: 1,completed: 1,artists: 1 },items: [{ id: "referral",label: "Artist invitation 1234",startedAt: new Date().toISOString(),completedAt: new Date().toISOString(),artistQualifiedAt: new Date().toISOString(),excluded: false }] });
  render(<MemoryRouter><ReferralsOverview /></MemoryRouter>);
  await screen.findByRole("alert"); await user.click(screen.getByRole("button",{ name: "Refresh" }));
  await screen.findByText("Artist registered");
  await user.click(screen.getByRole("button",{ name: "Copy link" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/copied/));
  expect(await navigator.clipboard.readText()).toContain("/join?ref=MC0123456789ABCDEF");
});
