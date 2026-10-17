import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  agreementVersionSchema,
  type AgreementDetail,
  type AgreementVersion,
} from "@music-city/shared";
import evidence from "../../../../docs/contributor-agreements-evidence/stellar-testnet.json";
import { AgreementsOverview } from "./agreements-overview";

const mocks = vi.hoisted(() => ({
  session: {
    token: "test-session",
    walletAddress: "",
    displayName: "Owner",
    artistAccess: true,
  },
  list: vi.fn(),
  detail: vi.fn(),
  contributors: vi.fn(),
  forTrack: vi.fn(),
  save: vi.fn(),
  act: vi.fn(),
  challenge: vi.fn(),
  respond: vi.fn(),
  sign: vi.fn(),
  tracks: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: mocks.session, connectWallet: vi.fn() }),
}));
vi.mock("@/features/music/lib/tracks-api", () => ({
  tracksApi: { listMyTracks: mocks.tracks },
}));
vi.mock("./agreement-api", async (original) => ({
  ...(await original<typeof import("./agreement-api")>()),
  agreementApi: {
    list: mocks.list,
    detail: mocks.detail,
    contributors: mocks.contributors,
    forTrack: mocks.forTrack,
    save: mocks.save,
    act: mocks.act,
    challenge: mocks.challenge,
    respond: mocks.respond,
  },
}));
vi.mock("@dynamic-labs/sdk-react-core", () => ({
  useStepUpAuthentication: () => ({
    isStepUpRequired: async () => false,
    promptStepUpAuth: async () => undefined,
  }),
  useDynamicContext: () => ({
    primaryWallet: {
      address: mocks.session.walletAddress,
      chain: "stellar",
      connector: {},
      signTransaction: mocks.sign,
    },
  }),
  useUserWallets: () => [
    {
      address: mocks.session.walletAddress,
      chain: "stellar",
      connector: {},
      signTransaction: mocks.sign,
    },
  ],
}));
vi.mock("@dynamic-labs/stellar", () => ({
  isStellarWallet: (wallet: { chain?: string }) => wallet?.chain === "stellar",
}));
vi.mock("@/lib/config/env", () => ({
  clientEnv: { stellarNetworkPassphrase: "Test SDF Network ; September 2015" },
}));
let version: AgreementVersion;
let detail: AgreementDetail;
function configurePermissions() {
  const owner = mocks.session.walletAddress === version.proposal.ownerWallet;
  const open = ["proposed", "ready"].includes(version.state);
  const response = version.responses.find(
    (r) => r.walletAddress === mocks.session.walletAddress,
  );
  detail.permissions = {
    edit: owner && version.state === "draft",
    submit: owner && version.state === "draft",
    cancel: owner && ["draft", "proposed", "ready"].includes(version.state),
    revise:
      owner && ["rejected", "disputed", "finalized"].includes(version.state),
    accept: open && !response,
    reject: open && !response,
    dispute: open && (!response || response.action === "accept"),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  version = {
    ...agreementVersionSchema.parse(evidence.versionHistory[0]),
    state: "proposed",
    responses: [],
  };
  mocks.session.walletAddress = version.proposal.ownerWallet;
  mocks.session.artistAccess = true;
  const people = version.proposal.recipients.map((r, i) => ({
    walletAddress: r.walletAddress,
    profileId: `profile-${i}`,
    name:
      r.walletAddress === version.proposal.ownerWallet ? "Owner" : "Producer",
  }));
  detail = {
    id: version.proposal.agreementId,
    currentVersion: version.proposal.version,
    effectiveVersion: null,
    versions: [version],
    finalizations: [],
    events: [],
    context: {
      track: { id: version.proposal.trackId, title: "Demo recording" },
      owner: people.find(
        (p) => p.walletAddress === version.proposal.ownerWallet,
      )!,
      people,
    },
    permissions: {} as AgreementDetail["permissions"],
  };
  configurePermissions();
  mocks.list.mockImplementation(async () => ({
    items: [
      {
        id: detail.id,
        current: version,
        effectiveVersion: null,
        context: detail.context,
      },
    ],
  }));
  mocks.detail.mockImplementation(async () => detail);
  mocks.tracks.mockResolvedValue([
    { id: version.proposal.trackId, title: "Demo recording" },
  ]);
  mocks.forTrack.mockResolvedValue({ id: null });
  mocks.contributors.mockResolvedValue({ items: [] });
  mocks.act.mockResolvedValue({ version });
  mocks.save.mockResolvedValue({ version });
  mocks.challenge.mockResolvedValue({
    id: "challenge",
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    transaction: "exact-challenge",
    proposalHash: version.proposalHash,
    networkPassphrase: version.proposal.networkPassphrase,
  });
  mocks.sign.mockResolvedValue("signed-envelope");
  mocks.respond.mockResolvedValue({ version });
});
afterEach(cleanup);
function open(path = `/account/agreements/${detail.id}`) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/account/agreements" element={<AgreementsOverview />} />
        <Route
          path="/account/agreements/new"
          element={<AgreementsOverview />}
        />
        <Route
          path="/account/agreements/:agreementId"
          element={<AgreementsOverview />}
        />
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup();
}
describe("agreement lifecycle UI", () => {
  it("shows recording and contributor identities with the complete split", async () => {
    open();
    await screen.findByRole("heading", { name: "Demo recording" });
    expect(screen.getAllByText("Producer").length).toBeGreaterThan(0);
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByText("30%")).toBeTruthy();
    expect(screen.queryByLabelText("What needs to be resolved?")).toBeNull();
  });
  it("allows a listener to open their inbox without requesting artist recordings", async () => {
    mocks.session.artistAccess = false;
    mocks.session.walletAddress = version.proposal.recipients.find(
      (r) => r.walletAddress !== version.proposal.ownerWallet,
    )!.walletAddress;
    configurePermissions();
    open("/account/agreements");
    expect(
      await screen.findByRole("link", { name: /Demo recording/ }),
    ).toBeTruthy();
    expect(mocks.tracks).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "New agreement" })).toBeNull();
  });
  it("requires a review and the exact draft hash before sending", async () => {
    version.state = "draft";
    configurePermissions();
    const user = open();
    await user.click(
      await screen.findByRole("button", { name: "Review proposal" }),
    );
    expect(
      screen.getByRole("region", { name: "Review proposal" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Send proposal" }));
    await waitFor(() =>
      expect(mocks.act).toHaveBeenCalledWith(
        "test-session",
        detail.id,
        "submit",
        version.proposal.version,
        version.proposalHash,
      ),
    );
  });
  it("uses the exact Dynamic wallet challenge for acceptance", async () => {
    const user = open();
    await user.click(
      await screen.findByRole("button", { name: "Accept and sign" }),
    );
    await waitFor(() =>
      expect(mocks.respond).toHaveBeenCalledWith("test-session", detail.id, {
        challengeId: "challenge",
        signedTransaction: "signed-envelope",
      }),
    );
    expect(mocks.sign).toHaveBeenCalledWith("exact-challenge");
  });
  it("records no response when signing is cancelled", async () => {
    mocks.sign.mockRejectedValueOnce(new Error("Signing cancelled"));
    const user = open();
    await user.click(
      await screen.findByRole("button", { name: "Accept and sign" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "No response recorded",
    );
    expect(mocks.respond).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("heading", {name: "Demo recording"}));
  });
  it.each(["reject", "dispute"] as const)(
    "asks for a reason only when choosing %s",
    async (action) => {
      const user = open();
      await user.click(
        await screen.findByRole("button", {
          name: action === "reject" ? "Reject" : "Raise dispute",
        }),
      );
      const submit = screen.getByRole("button", {
        name: action === "reject" ? "Reject and sign" : "Sign dispute",
      });
      expect(submit.hasAttribute("disabled")).toBe(true);
      await user.type(
        screen.getByLabelText(
          action === "reject"
            ? "Why are you rejecting this proposal?"
            : "What needs to be resolved?",
        ),
        "Correct attribution",
      );
      await user.click(submit);
      await waitFor(() =>
        expect(mocks.challenge).toHaveBeenCalledWith(
          "test-session",
          detail.id,
          { action, reason: "Correct attribution" },
        ),
      );
    },
  );
  it("refuses changed proposals before wallet authorization", async () => {
    mocks.challenge.mockResolvedValue({
      id: "challenge",
      transaction: "changed",
      proposalHash: "0".repeat(64),
      networkPassphrase: version.proposal.networkPassphrase,
    });
    const user = open();
    await user.click(
      await screen.findByRole("button", { name: "Accept and sign" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "proposal changed",
    );
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("refuses a different network before creating a challenge", async () => {
    version.proposal.networkPassphrase =
      "Public Global Stellar Network ; September 2015";
    const user = open();
    await user.click(
      await screen.findByRole("button", { name: "Accept and sign" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain("network");
    expect(mocks.challenge).not.toHaveBeenCalled();
  });
  it("recovers a recorded response when its HTTP response was lost", async () => {
    mocks.respond.mockImplementation(async () => {
      version.responses.push({
        walletAddress: mocks.session.walletAddress,
        action: "accept",
        challengeId: "challenge",
        proposalHash: version.proposalHash,
        signedTransaction: "signed-envelope",
        reason: "",
        respondedAt: new Date().toISOString(),
      });
      configurePermissions();
      throw new Error("Connection lost");
    });
    const user = open();
    await user.click(
      await screen.findByRole("button", { name: "Accept and sign" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Accept and sign" }),
      ).toBeNull(),
    );
    expect(mocks.sign).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("allows fresh signing after an expired response was confirmed unrecorded", async () => {
    mocks.challenge.mockResolvedValueOnce({
      id: "expired",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      transaction: "exact-challenge",
      proposalHash: version.proposalHash,
      networkPassphrase: version.proposal.networkPassphrase,
    });
    mocks.respond.mockRejectedValueOnce(
      new Error("Agreement response challenge expired"),
    );
    const user = open();
    await user.click(
      await screen.findByRole("button", { name: "Accept and sign" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain("expired");
    await user.click(screen.getByRole("button", { name: "Accept and sign" }));
    await waitFor(() => expect(mocks.challenge).toHaveBeenCalledTimes(2));
    expect(mocks.sign).toHaveBeenCalledTimes(2);
  });
  it("opens an existing agreement directly from its recording context", async () => {
    mocks.forTrack.mockResolvedValue({ id: detail.id });
    open(`/account/agreements/new?track=${version.proposal.trackId}`);
    expect(
      await screen.findByRole("heading", { name: "Demo recording" }),
    ).toBeTruthy();
    expect(screen.queryByRole("form", { name: "New agreement" })).toBeNull();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("preserves edited fields after a stale draft save is rejected", async () => {
    version.state = "draft";
    configurePermissions();
    const user = open();
    await user.click(await screen.findByRole("button", { name: "Edit draft" }));
    const terms = screen.getByLabelText("Additional terms (optional)");
    await user.clear(terms);
    await user.type(terms, "My revised terms");
    mocks.save.mockRejectedValue(
      new Error("The draft changed. Review latest details"),
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "draft changed",
    );
    expect((terms as HTMLTextAreaElement).value).toBe("My revised terms");
    expect(mocks.save.mock.calls[0]?.[3]).toMatchObject({
      expectedVersion: version.proposal.version,
      expectedHash: version.proposalHash,
    });
  });
});
