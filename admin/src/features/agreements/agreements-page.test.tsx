import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  agreementVersionSchema,
  type AgreementVersion,
} from "@music-city/shared";
import evidence from "../../../../docs/contributor-agreements-evidence/stellar-testnet.json";
import { AdminAgreementsPage } from "./agreements-page";

const mocks = vi.hoisted(() => ({
  role: "super_admin",
  get: vi.fn(),
  post: vi.fn(),
}));
vi.mock("@/features/auth/providers/admin-auth-provider", () => ({
  useAdminAuth: () => ({
    session: { token: "admin-test-session", role: mocks.role },
  }),
}));
vi.mock("@/lib/api/http-client", () => ({
  httpClient: { get: mocks.get, post: mocks.post },
}));
let version: AgreementVersion;
let signedBy: string[];
let attemptStatus: string;
let hasAttempt: boolean;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = "super_admin";
  hasAttempt = true;
  version = agreementVersionSchema.parse(evidence.versionHistory[0]);
  version.state = "finalizing";
  signedBy = [evidence.signers[0]!];
  attemptStatus = "awaiting_signatures";
  const people = version.proposal.recipients.map((r, i) => ({
    profileId: String(i),
    walletAddress: r.walletAddress,
    name: i === 0 ? "Artist" : "Producer",
  }));
  const context = {
    track: { id: version.proposal.trackId, title: "Demo recording" },
    owner: people[0]!,
    people,
  };
  mocks.get.mockImplementation(async (path: string) =>
    path === "/agreements"
      ? {
          items: [
            {
              id: version.proposal.agreementId,
              effectiveVersion: null,
              current: version,
              context,
            },
          ],
        }
      : {
          id: version.proposal.agreementId,
          currentVersion: version.proposal.version,
          effectiveVersion: attemptStatus === "confirmed" ? 1 : null,
          versions: [version],
          context,
          events: [],
          finalizations: hasAttempt
            ? [
                {
                  id: "attempt",
                  version: 1,
                  status: attemptStatus,
                  transaction: "exact-prepared-transaction",
                  transactionHash: evidence.initialFinalization.transactionHash,
                  treasuryAddress: evidence.treasuryAddress,
                  contractId: evidence.contractId,
                  networkPassphrase: version.proposal.networkPassphrase,
                  signers: evidence.signers,
                  signedBy,
                  expiresAt: new Date(Date.now() + 600000).toISOString(),
                  explorerUrl: evidence.initialFinalization.explorerUrl,
                  ledger: evidence.initialFinalization.ledger,
                },
              ]
            : [],
        },
  );
  mocks.post.mockResolvedValue({});
});
afterEach(cleanup);
function open(path = "/console/agreements/" + version.proposal.agreementId) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/console/agreements" element={<AdminAgreementsPage />} />
        <Route
          path="/console/agreements/:agreementId"
          element={<AdminAgreementsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup();
}
describe("admin agreement lifecycle", () => {
  it("keeps submission disabled until two independent signatures are verified", async () => {
    const user = open();
    await screen.findByRole("heading", { name: "Demo recording" });
    expect(
      screen
        .getByRole("button", { name: "Submit finalization" })
        .hasAttribute("disabled"),
    ).toBe(true);
    await user.click(screen.getByText("Paste signed transaction"));
    await user.type(
      screen.getByLabelText("Signed transaction XDR"),
      "second-signed-envelope",
    );
    mocks.post.mockImplementation(async () => {
      signedBy = evidence.signers.slice(0, 2);
      return {};
    });
    await user.click(
      screen.getByRole("button", { name: "Add verified signature" }),
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Submit finalization" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    expect(mocks.post).toHaveBeenCalledWith(
      `/agreements/${version.proposal.agreementId}/finalizations/attempt/signatures`,
      { signedTransaction: "second-signed-envelope" },
      "admin-test-session",
    );
  });
  it("uses an active retry even when its UUID sorts before an expired attempt", async () => {
    const original = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation(async (path: string) => {
      const value = await original(path);
      if (value.finalizations)
        value.finalizations = [
          {
            ...value.finalizations[0],
            id: "a-new",
            createdAt: "2026-10-17T14:00:00Z",
          },
          {
            ...value.finalizations[0],
            id: "z-old",
            status: "expired",
            createdAt: "2026-10-17T13:00:00Z",
          },
        ];
      return value;
    });
    const user = open();
    await screen.findByRole("heading", { name: "Demo recording" });
    await user.click(screen.getByText("Paste signed transaction"));
    await user.type(
      screen.getByLabelText("Signed transaction XDR"),
      "retry-envelope",
    );
    await user.click(
      screen.getByRole("button", { name: "Add verified signature" }),
    );
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        `/agreements/${version.proposal.agreementId}/finalizations/a-new/signatures`,
        { signedTransaction: "retry-envelope" },
        "admin-test-session",
      ),
    );
  });
  it("requires the reviewed version and hash when preparing finalization", async () => {
    hasAttempt = false;
    version.state = "ready";
    const user = open();
    await user.click(
      await screen.findByRole("button", { name: "Prepare finalization" }),
    );
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        `/agreements/${version.proposal.agreementId}/finalizations`,
        { expectedVersion: 1, expectedHash: version.proposalHash },
        "admin-test-session",
      ),
    );
  });
  it("records a resolution as a revised draft request with exact version preconditions", async () => {
    hasAttempt = false;
    version.state = "disputed";
    const user = open();
    await user.click(
      await screen.findByRole("button", { name: "Record resolution" }),
    );
    const create = screen.getByRole("button", { name: "Create revised draft" });
    expect(create.hasAttribute("disabled")).toBe(true);
    await user.type(
      screen.getByLabelText("Resolution"),
      "Agreed attribution correction",
    );
    await user.click(create);
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        `/agreements/${version.proposal.agreementId}/resolutions`,
        {
          expectedVersion: 1,
          expectedHash: version.proposalHash,
          resolution: "Agreed attribution correction",
        },
        "admin-test-session",
      ),
    );
  });
  it("keeps an ordinary administrator read-only", async () => {
    mocks.role = "admin";
    const user = open();
    await screen.findByRole("heading", { name: "Demo recording" });
    expect(
      screen.queryByRole("button", { name: "Submit finalization" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Add verified signature" }),
    ).toBeNull();
    await user.click(screen.getByText("Verification details"));
    expect(screen.getByLabelText("Prepared transaction XDR")).toBeTruthy();
  });
  it("shows a pending submission without claiming activation or requiring an outcome button", async () => {
    attemptStatus = "submitted";
    open();
    await screen.findByRole("heading", { name: "Demo recording" });
    expect(screen.getByText("Waiting for network confirmation")).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: "View confirmed publication" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Check transaction outcome" }),
    ).toBeNull();
  });
  it("shows a confirmed explorer receipt only after confirmation", async () => {
    attemptStatus = "confirmed";
    version.state = "finalized";
    open();
    const receipt = await screen.findByRole("link", {
      name: "View confirmed publication",
    });
    expect(receipt.getAttribute("href")).toBe(
      evidence.initialFinalization.explorerUrl,
    );
  });
  it("uses recording titles and owner identities in the agreement list", async () => {
    open("/console/agreements");
    expect(
      await screen.findByRole("link", { name: /Demo recording/ }),
    ).toBeTruthy();
    expect(screen.queryByText("Track " + version.proposal.trackId)).toBeNull();
  });
});
