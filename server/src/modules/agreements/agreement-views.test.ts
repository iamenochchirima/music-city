import assert from "node:assert/strict";
import test from "node:test";
import {
  agreementPermissions,
  visibleAgreementVersions,
} from "./agreement-views.js";
import type { AgreementVersion } from "@music-city/shared";
function version(
  n: number,
  state: AgreementVersion["state"],
  wallets = ["owner", "member"],
): AgreementVersion {
  return {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    proposalHash: "a".repeat(64),
    proposal: {
      schemaVersion: 1,
      agreementId: "agreement",
      trackId: "track",
      releaseId: null,
      previousHash: null,
      networkPassphrase: "testnet",
      terms: "",
      version: n,
      ownerWallet: "owner",
      recipients: wallets.map((walletAddress) => ({
        walletAddress,
        role: "artist",
        shareBps: 5000,
      })),
    },
    state,
    responses: [],
  } as AgreementVersion;
}
test("version visibility excludes private drafts and future proposals from removed contributors", () => {
  const history = [
    version(1, "finalized"),
    version(2, "draft"),
    version(3, "proposed", ["owner", "other"]),
    version(4, "cancelled"),
  ];
  const submitted = new Set([1, 3]);
  assert.deepEqual(
    visibleAgreementVersions(history, "member", "owner", submitted).map(
      (v) => v.proposal.version,
    ),
    [1],
  );
  assert.deepEqual(
    visibleAgreementVersions(history, "owner", "owner", submitted),
    history,
  );
  assert.deepEqual(
    visibleAgreementVersions(history, "admin", "owner", submitted, true),
    history,
  );
  assert.deepEqual(
    visibleAgreementVersions(history, "outsider", "owner", submitted),
    [],
  );
});
test("only current eligible roles receive mutation permissions and disputes preserve accepted consent", () => {
  const proposed = version(1, "proposed");
  assert.equal(agreementPermissions(proposed, "member", true).accept, true);
  assert.equal(agreementPermissions(proposed, "member", false).accept, false);
  assert.equal(agreementPermissions(proposed, "outsider", true).dispute, false);
  proposed.responses = [
    { walletAddress: "member", action: "accept" },
  ] as AgreementVersion["responses"];
  assert.equal(agreementPermissions(proposed, "member", true).accept, false);
  assert.equal(agreementPermissions(proposed, "member", true).dispute, true);
  proposed.responses.push({
    walletAddress: "member",
    action: "dispute",
  } as AgreementVersion["responses"][number]);
  assert.equal(agreementPermissions(proposed, "member", true).dispute, false);
  assert.equal(
    agreementPermissions(version(2, "draft"), "owner", true).edit,
    true,
  );
  assert.equal(
    agreementPermissions(version(2, "finalized"), "owner", true).revise,
    true,
  );
});
