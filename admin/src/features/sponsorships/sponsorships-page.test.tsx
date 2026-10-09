import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdminSponsorshipsPage } from "./sponsorships-page";

const mocks = vi.hoisted(() => ({ session: { token: "admin-token",role: "admin" },get: vi.fn(),put: vi.fn(),post: vi.fn() }));
vi.mock("@/features/auth/providers/admin-auth-provider",() => ({ useAdminAuth: () => ({ session: mocks.session }) }));
vi.mock("@/lib/api/http-client",() => ({ httpClient: { get: mocks.get,put: mocks.put,post: mocks.post } }));

const campaign = {
  code: "EARLYUSER",termsRevision: "v1",currency: "USD",originalAmountMinor: 2000,discountAmountMinor: 2000,
  amountDueMinor: 0,discountPercent: 100,active: true,eligibleAccounts: 2,activatedArtists: 1,pendingEligibility: 1,totalFeesWaivedMinor: 2000,
};
const report = { campaign,items: [{ id: "artist-id",walletAddress: "GTEST",displayName: "Early Artist",capturedAt: new Date().toISOString(),activatedAt: null,status: "eligible",inviterName: "Inviter" }],events: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.role = "admin";
  mocks.get.mockResolvedValue(report);
  mocks.put.mockResolvedValue({ active: false });
  mocks.post.mockResolvedValue({ checked: 1,activated: 0 });
});
afterEach(cleanup);

it("shows waived face value separately from revenue and keeps ordinary admins read only", async () => {
  render(<AdminSponsorshipsPage />);
  await screen.findByText("Early Artist");
  expect(screen.getByText(/Fees waived at face value: \$20.00/)).toBeTruthy();
  expect(screen.getByText(/not sales revenue or money paid out/)).toBeTruthy();
  expect(screen.queryByRole("button",{ name: "Pause new eligibility" })).toBeNull();
});

it("requires a reason before a super admin pauses future eligibility", async () => {
  mocks.session.role = "super_admin";
  mocks.get.mockResolvedValueOnce(report).mockResolvedValueOnce({ ...report,campaign: { ...campaign,active: false } });
  const user = userEvent.setup();
  render(<AdminSponsorshipsPage />);
  await screen.findByText("Early Artist");
  const pause = screen.getByRole("button",{ name: "Pause new eligibility" });
  expect((pause as HTMLButtonElement).disabled).toBe(true);
  await user.type(screen.getByLabelText("Reason for pausing"),"Limit pilot registrations");
  await user.click(pause);
  await waitFor(() => expect(mocks.put).toHaveBeenCalledWith("/sponsorships/campaign",{ active: false,reason: "Limit pilot registrations" },"admin-token"));
  await screen.findByText("Paused");
});
