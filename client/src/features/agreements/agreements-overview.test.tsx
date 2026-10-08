import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agreementVersionSchema, type AgreementVersion } from "@music-city/shared";
import evidence from "../../../../docs/contributor-agreements-evidence/stellar-testnet.json";
import { AgreementsOverview } from "./agreements-overview";

const mocks = vi.hoisted(() => ({ session: { token: "test-session",walletAddress: "" },get: vi.fn(),post: vi.fn(),put: vi.fn(),tracks: vi.fn(),sign: vi.fn() }));
vi.mock("@/hooks/use-auth",()=>({ useAuth: ()=>({ session: mocks.session }) }));
vi.mock("@/lib/api/http-client",()=>({ httpClient: { get: mocks.get,post: mocks.post,put: mocks.put } }));
vi.mock("@/features/music/lib/tracks-api",()=>({ tracksApi: { listMyTracks: mocks.tracks } }));
vi.mock("@/features/wallet/lib/freighter",()=>({ signWithFreighter: mocks.sign }));
vi.mock("@/lib/config/env",()=>({ clientEnv: { stellarNetworkPassphrase: "Test SDF Network ; September 2015" } }));

// These are component integration tests: HTTP and wallet transports are mocked.
// Real consent verification and chain authorization are covered separately.
let version: AgreementVersion;
beforeEach(()=>{
  vi.clearAllMocks();
  version = agreementVersionSchema.parse(evidence.versionHistory[0]);
  version = { ...version,state: "proposed",responses: [] };
  mocks.session.walletAddress = version.proposal.ownerWallet;
  mocks.tracks.mockResolvedValue([{ id: version.proposal.trackId,title: "Demo track" }]);
  mocks.get.mockImplementation(async(path: string)=>path === "/agreements" ? { items: [{ id: version.proposal.agreementId,effectiveVersion: null,current: version }] } : { id: version.proposal.agreementId,currentVersion: version.proposal.version,effectiveVersion: null,versions: [version],finalizations: [],events: [] });
  mocks.sign.mockResolvedValue("signed-envelope");
  mocks.post.mockImplementation(async(path: string)=>path.endsWith("/challenges") ? { transaction: "exact-challenge",id: "challenge-id",proposalHash: version.proposalHash,networkPassphrase: version.proposal.networkPassphrase } : {});
});
afterEach(cleanup);
async function open() {
  const user = userEvent.setup(); render(<AgreementsOverview />);
  await user.click(await screen.findByRole("button",{ name: /Demo track/ }));
  await screen.findAllByText("70.00% · artist"); return user;
}
describe("contributor agreement UI",()=>{
  it("shows the full split and requires review before fixing a draft",async()=>{
    version.state = "draft";
    const user = await open();
    expect(screen.getByText("30.00% · producer")).toBeTruthy();
    expect(screen.queryByRole("button",{ name: "Submit for contributor approval" })).toBeNull();
    await user.click(screen.getByRole("button",{ name: "Review for contributor approval" }));
    expect(screen.getByRole("region",{ name: "Review proposal" }).textContent).toContain("fresh contributor signatures");
    await user.click(screen.getByRole("button",{ name: "Submit for contributor approval" }));
    await waitFor(()=>expect(mocks.post).toHaveBeenCalledWith(`/agreements/${version.proposal.agreementId}/submit`,{},"test-session"));
  });
  it("signs the exact challenge only after reviewing the proposal",async()=>{
    const user = await open();
    await user.click(screen.getByRole("button",{ name: "Accept and sign with wallet" }));
    await waitFor(()=>expect(mocks.post).toHaveBeenCalledWith(`/agreements/${version.proposal.agreementId}/responses`,{ challengeId: "challenge-id",signedTransaction: "signed-envelope" },"test-session"));
    expect(mocks.sign).toHaveBeenCalledWith("exact-challenge",version.proposal.ownerWallet);
  });
  it("keeps consent unrecorded when the wallet cancels signing",async()=>{
    mocks.sign.mockRejectedValueOnce(new Error("Signing cancelled by wallet"));
    const user = await open(); await user.click(screen.getByRole("button",{ name: "Accept and sign with wallet" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Signing cancelled");
    expect(mocks.post.mock.calls.some(([path])=>String(path).endsWith("/responses"))).toBe(false);
    expect(screen.getByRole("button",{ name: "Accept and sign with wallet" }).hasAttribute("disabled")).toBe(false);
  });
  it.each(["reject","dispute"] as const)("requires and binds a reason for %s",async action=>{
    const user = await open(); const label = action === "reject" ? "Reject and sign" : "Dispute and sign";
    expect(screen.getByRole("button",{ name: label }).hasAttribute("disabled")).toBe(true);
    await user.type(screen.getByLabelText("Reason for rejection or dispute"),"Please correct attribution");
    await user.click(screen.getByRole("button",{ name: label }));
    await waitFor(()=>expect(mocks.post).toHaveBeenCalledWith(`/agreements/${version.proposal.agreementId}/challenges`,{ action,reason: "Please correct attribution" },"test-session"));
  });
  it("refuses a changed proposal hash before wallet signing",async()=>{
    mocks.post.mockResolvedValue({ transaction: "wrong-challenge",id: "challenge-id",proposalHash: "0".repeat(64),networkPassphrase: version.proposal.networkPassphrase });
    const user = await open(); await user.click(screen.getByRole("button",{ name: "Accept and sign with wallet" }));
    expect((await screen.findByRole("alert")).textContent).toContain("proposal changed");
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("refuses a mismatched network before requesting a wallet signature",async()=>{
    version.proposal.networkPassphrase = "Public Global Stellar Network ; September 2015";
    const user = await open(); await user.click(screen.getByRole("button",{ name: "Accept and sign with wallet" }));
    expect((await screen.findByRole("alert")).textContent).toContain("network does not match");
    expect(mocks.sign).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled();
  });
  it("shows finalized evidence and retains amendment history without offering old acceptance",async()=>{
    const versions = evidence.versionHistory.map(v=>agreementVersionSchema.parse(v)); version = versions[2]!;
    mocks.get.mockImplementation(async(path: string)=>path === "/agreements" ? { items: [{ id: version.proposal.agreementId,effectiveVersion: 3,current: version }] } : { id: version.proposal.agreementId,currentVersion: 3,effectiveVersion: 3,versions,events: evidence.events,finalizations: [{ id: "confirmed",version: 3,status: "confirmed",transactionHash: evidence.amendmentFinalization.transactionHash,signedBy: evidence.amendmentFinalization.signedBy,ledger: evidence.amendmentFinalization.ledger,explorerUrl: evidence.amendmentFinalization.explorerUrl }] });
    const user = await open();
    expect(screen.getByText("Effective finalized version: 3")).toBeTruthy();
    expect(screen.getByRole("link",{ name: /View confirmed publication/ }).getAttribute("href")).toBe(evidence.amendmentFinalization.explorerUrl);
    expect(screen.queryByRole("button",{ name: "Accept and sign with wallet" })).toBeNull();
    await user.click(screen.getByText("Version and action history"));
    expect(screen.getByText("Version 2: disputed")).toBeTruthy();
    expect(screen.getAllByText(/Review the revised attribution/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button",{ name: "Create revised version" })).toBeTruthy();
  });
});
