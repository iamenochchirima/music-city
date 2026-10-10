import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agreementVersionSchema, type AgreementVersion } from "@music-city/shared";
import evidence from "../../../../docs/contributor-agreements-evidence/stellar-testnet.json";
import { AdminAgreementsPage } from "./agreements-page";

const mocks = vi.hoisted(()=>({ role: "super_admin",get: vi.fn(),post: vi.fn() }));
vi.mock("@/features/auth/providers/admin-auth-provider",()=>({ useAdminAuth: ()=>({ session: { token: "admin-test-session",role: mocks.role } }) }));
vi.mock("@/lib/api/http-client",()=>({ httpClient: { get: mocks.get,post: mocks.post } }));
let version: AgreementVersion;
let signedBy: string[];
let attemptStatus: string;
beforeEach(()=>{
  vi.clearAllMocks(); mocks.role = "super_admin";
  version = agreementVersionSchema.parse(evidence.versionHistory[0]); version.state = "finalizing";
  signedBy = [evidence.signers[0]!]; attemptStatus = "awaiting_signatures";
  mocks.get.mockImplementation(async(path: string)=>path === "/agreements" ? { items: [{ id: version.proposal.agreementId,effectiveVersion: null,current: version }] } : {
    id: version.proposal.agreementId,currentVersion: version.proposal.version,effectiveVersion: null,versions: [version],events: [],finalizations: [{ id: "attempt",version: 1,status: attemptStatus,transaction: "exact-prepared-transaction",transactionHash: evidence.initialFinalization.transactionHash,treasuryAddress: evidence.treasuryAddress,contractId: evidence.contractId,signers: evidence.signers,signedBy,expiresAt: new Date(Date.now()+600000).toISOString(),explorerUrl: evidence.initialFinalization.explorerUrl,ledger: evidence.initialFinalization.ledger }],
  }); mocks.post.mockResolvedValue({});
});
afterEach(cleanup);
async function open() {
  const user = userEvent.setup(); render(<AdminAgreementsPage />);
  await user.click(await screen.findByRole("button",{ name: /Track/ }));
  await screen.findByText(/Review version/); return user;
}
describe("admin agreement UI",()=>{
  it("keeps submission disabled until two independent signatures are recorded",async()=>{
    const user = await open();
    expect(screen.getByRole("button",{ name: "Submit with 1 signatures" }).hasAttribute("disabled")).toBe(true);
    await user.type(screen.getByLabelText("Signed transaction XDR"),"second-signed-envelope");
    mocks.post.mockImplementation(async()=>{ signedBy = evidence.signers.slice(0,2); return {}; });
    await user.click(screen.getByRole("button",{ name: "Add verified signature" }));
    await waitFor(()=>expect(screen.getByRole("button",{ name: "Submit with 2 signatures" }).hasAttribute("disabled")).toBe(false));
    expect(mocks.post).toHaveBeenCalledWith(`/agreements/${version.proposal.agreementId}/finalizations/attempt/signatures`,{ signedTransaction: "second-signed-envelope" },"admin-test-session");
    await user.click(screen.getByRole("button",{ name: "Submit with 2 signatures" }));
    expect(mocks.post).toHaveBeenLastCalledWith(`/agreements/${version.proposal.agreementId}/finalizations/attempt/submit`,{},"admin-test-session");
  });
  it("shows a verification failure and never enables submission for one signer",async()=>{
    mocks.post.mockRejectedValueOnce(new Error("Signature belongs to another transaction"));
    const user = await open(); await user.type(screen.getByLabelText("Signed transaction XDR"),"altered-envelope");
    await user.click(screen.getByRole("button",{ name: "Add verified signature" }));
    expect((await screen.findByRole("alert")).textContent).toContain("another transaction");
    expect(screen.getByRole("button",{ name: "Submit with 1 signatures" }).hasAttribute("disabled")).toBe(true);
  });
  it("reconciles an uncertain submission without preparing a replacement",async()=>{
    attemptStatus = "submitting";
    const user = await open();
    expect(screen.queryByRole("button",{ name: "Prepare treasury finalization" })).toBeNull();
    expect(screen.queryByLabelText("Signed transaction XDR")).toBeNull();
    await user.click(screen.getByRole("button",{ name: "Check transaction outcome" }));
    expect(mocks.post).toHaveBeenCalledWith(`/agreements/${version.proposal.agreementId}/finalizations/attempt/reconcile`,{},"admin-test-session");
  });
  it("lets read-only admins review evidence without signature or submission controls",async()=>{
    mocks.role = "admin";
    await open();
    expect(screen.getByText("70.00% · artist")).toBeTruthy();
    expect(screen.queryByRole("button",{ name: "Add verified signature" })).toBeNull();
    expect(screen.queryByRole("button",{ name: /Submit with/ })).toBeNull();
    expect(screen.getByText(/Super admin access/)).toBeTruthy();
  });
  it("shows the confirmed ledger and explorer link after publication",async()=>{
    attemptStatus = "confirmed"; signedBy = evidence.signers.slice(0,2); version.state = "finalized";
    await open();
    expect(screen.getByRole("link",{ name: /View confirmed publication/ }).getAttribute("href")).toBe(evidence.initialFinalization.explorerUrl);
    expect(screen.queryByRole("button",{ name: "Add verified signature" })).toBeNull();
    expect(screen.queryByRole("button",{ name: "Check transaction outcome" })).toBeNull();
  });
  it("records resolution into a fresh draft and preserves the disputed version",async()=>{
    const disputed = agreementVersionSchema.parse(evidence.versionHistory[1]); version = disputed;
    mocks.get.mockImplementation(async(path: string)=>path === "/agreements" ? { items: [{ id: version.proposal.agreementId,effectiveVersion: 1,current: version }] } : { id: version.proposal.agreementId,currentVersion: version.proposal.version,effectiveVersion: 1,versions: version === disputed ? [disputed] : [disputed,version],events: [],finalizations: [] });
    mocks.post.mockImplementation(async()=>{ version = { ...agreementVersionSchema.parse(evidence.versionHistory[2]),state: "draft",responses: [] }; return {}; });
    const user = await open();
    expect(screen.queryByRole("button",{ name: "Prepare treasury finalization" })).toBeNull();
    await user.type(screen.getByLabelText("Resolution explanation"),"Attribution reviewed; fresh consent required");
    await user.click(screen.getByRole("button",{ name: "Record resolution and create revised draft" }));
    await screen.findByText("Review version 3 · draft");
    expect(screen.getAllByText("Awaiting response").length).toBeGreaterThanOrEqual(2);
    await user.click(screen.getByText("Version, transaction and action history"));
    expect(screen.getByText("Version 2 · disputed")).toBeTruthy();
    expect(screen.getAllByText(/Review the revised attribution/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button",{ name: "Prepare treasury finalization" })).toBeNull();
  });
});
