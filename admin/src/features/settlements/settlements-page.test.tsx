import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FinancialAttempt, SettlementBatch } from "@music-city/shared";
import { AdminSettlementsPage } from "./settlements-page";
const m = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  role: "super_admin",
}));
vi.mock("@/features/auth/providers/admin-auth-provider", () => ({
  useAdminAuth: () => ({ session: { token: "admin-session", role: m.role } }),
}));
vi.mock("@/lib/api/http-client", () => ({
  httpClient: { get: m.get, post: m.post },
}));
let batch: SettlementBatch, attempt: FinancialAttempt;
beforeEach(() => {
  vi.clearAllMocks();
  m.role = "super_admin";
  batch = {
    id: "1".repeat(64),
    state: "reserved",
    fundedUnits: "1000000000",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    allocations: [
      {
        index: 0,
        amountUnits: "1000000000",
        status: "pending",
        beneficiary: "contributor",
      },
    ],
    config: {
      networkPassphrase: "Test SDF Network ; September 2015",
      contractId: "contract",
      assetIssuer: "issuer",
    },
    version: 1,
  } as SettlementBatch;
  attempt = {
    id: "attempt",
    batchId: batch.id,
    kind: "settle",
    status: "awaiting_signatures",
    signedBy: ["signer-a"],
    signers: ["signer-a", "signer-b", "signer-c"],
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    transactionHash: "2".repeat(64),
  } as FinancialAttempt;
  m.get.mockImplementation(async (p: string) =>
    p === "/settlements/reconciliation" ? {snapshot:{ok:true,checkedAt:new Date().toISOString(),fundedUnits:"0",claimedUnits:"0",reclaimedUnits:"0",openUnits:"0",escrowBalanceUnits:"0",networkFeeXlmUnits:"0",discrepancies:[]},stale:false,error:null} : p === "/settlements"
      ? { items: [batch] }
      : p === "/settlements/sources"
        ? { items: [] }
        : { batch, attempts: [attempt], events: [] },
  );
  m.post.mockResolvedValue({});
});
afterEach(cleanup);
async function open() {
  const user = userEvent.setup();
  render(<AdminSettlementsPage />);
  await user.click(
    await screen.findByRole("button", { name: /100.0000000 USDC/ }),
  );
  return user;
}
it("keeps funding disabled until two independent verified signatures are present", async () => {
  const user = await open();
  expect(
    screen
      .getByRole("button", { name: "Submit authorized transaction" })
      .hasAttribute("disabled"),
  ).toBe(true);
  await user.type(
    screen.getByLabelText("Signed transaction XDR"),
    "exact-signed-envelope",
  );
  m.post.mockImplementation(async () => {
    attempt = { ...attempt, signedBy: ["signer-a", "signer-b"] };
    return {};
  });
  await user.click(
    screen.getByRole("button", { name: "Add verified signature" }),
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Submit authorized transaction" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(m.post).toHaveBeenCalledWith(
    "/settlements/attempts/attempt/signatures",
    { signedTransaction: "exact-signed-envelope" },
    "admin-session",
  );
});
it("shows pending submission without a duplicate funding control", async () => {
  attempt.status = "submitted";
  await open();
  expect(screen.getAllByRole("status").some(e=>e.textContent==="submitted")).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Submit authorized transaction" }),
  ).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Prepare treasury funding" })
      .hasAttribute("disabled"),
  ).toBe(true);
});
it("read-only admins can inspect allocations without signing or funding", async () => {
  m.role = "admin";
  await open();
  expect(screen.getByText("contributor")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Add verified signature" }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Prepare treasury funding" }),
  ).toBeNull();
});
it("surfaces reconciliation discrepancies and exposes protected maintenance", async () => {
  batch.discrepancy = "Archived settlement records need restoration";
  const user = await open();
  expect(screen.getByRole("alert").textContent).toContain("restoration");
  await user.click(screen.getByText("Agreement and source evidence"));
  await user.click(
    screen.getByRole("button", { name: "Maintain contract records" }),
  );
  expect(m.post).toHaveBeenCalledWith(
    `/settlements/${batch.id}/maintenance`,
    {},
    "admin-session",
  );
});

it("shows the cached independent reconciliation without client-triggered mutations",async()=>{
 render(<AdminSettlementsPage/>);expect(await screen.findByText("Reconciled",{exact:true})).toBeTruthy();expect(m.get).toHaveBeenCalledWith("/settlements/reconciliation","admin-session");expect(m.post).not.toHaveBeenCalled();
});
it("does not show a stale or failed reconciliation as verified",async()=>{
 const get=m.get.getMockImplementation()!;m.get.mockImplementation(async(p:string)=>p==="/settlements/reconciliation"?{snapshot:null,stale:true,error:"Financial event history needs attention"}:get(p));render(<AdminSettlementsPage/>);expect((await screen.findByRole("alert")).textContent).toContain("history needs attention");expect(screen.queryByText("Reconciled",{exact:true})).toBeNull();
});
