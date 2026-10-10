import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminReferralsPage } from "./referrals-page";
const mocks = vi.hoisted(() => ({ session: { token: "admin",role: "admin" },get: vi.fn(),post: vi.fn() }));
vi.mock("@/features/auth/providers/admin-auth-provider",()=>({ useAdminAuth: () => ({ session: mocks.session }) }));
vi.mock("@/lib/api/http-client",()=>({ httpClient: { get: mocks.get,post: mocks.post } }));
const row = { id: "referral",inviter_id: "one",invitee_id: "two",inviter_name: "Inviter",invitee_name: "Artist",campaign: "registration-v1",bound_at: new Date().toISOString(),completed_at: new Date().toISOString(),artist_qualified_at: new Date().toISOString(),excluded_at: null,exclusion_reason: null,events: [{ id: "event",action: "attributed",actor: "two",created_at: new Date().toISOString(),reason: null }] };
beforeEach(() => { vi.clearAllMocks(); mocks.session.role = "admin"; mocks.get.mockResolvedValue({ items: [row] }); mocks.post.mockResolvedValue({}); });
afterEach(cleanup);
it("read-only admin can inspect and filter referrals without exclusion controls",async () => {
  const user = userEvent.setup(); render(<AdminReferralsPage />);
  await screen.findByText("Inviter invited Artist");
  expect(screen.queryByRole("button",{ name: "Exclude referral" })).toBeNull();
  await user.selectOptions(screen.getByLabelText("Status"),"excluded"); await screen.findByText("No matching referrals.");
});
it("super admin exclusion requires a reason, updates progress and keeps audit evidence",async () => {
  mocks.session.role = "super_admin"; const user = userEvent.setup(); render(<AdminReferralsPage />);
  await screen.findByText("Inviter invited Artist");
  expect((screen.getByRole("button",{ name: "Exclude referral" }) as HTMLButtonElement).disabled).toBe(true);
  await user.type(screen.getByLabelText("Exclusion reason"),"Duplicate test account");
  mocks.get.mockResolvedValue({ items: [{ ...row,excluded_at: new Date().toISOString(),exclusion_reason: "Duplicate test account" }] });
  await user.click(screen.getByRole("button",{ name: "Exclude referral" }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("/referrals/referral/exclude",{ reason: "Duplicate test account" },"admin"));
  await screen.findByText("Exclusion reason: Duplicate test account"); expect(screen.getByText("Audit history")).toBeTruthy();
});
