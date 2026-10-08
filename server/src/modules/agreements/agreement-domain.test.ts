import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import type { AgreementProposal, AgreementVersion } from "@music-city/shared";
import { amendVersion, applyResponse, cancelVersion, canonicalProposal, createResponseChallenge, createVersion, submitVersion } from "./agreement-domain.js";

const a = Keypair.random(), b = Keypair.random(), outsider = Keypair.random();
const now = new Date("2026-10-02T08:00:00Z");
const proposal = (): AgreementProposal => ({
  schemaVersion: 1, agreementId: "agreement-1", trackId: "track-1", releaseId: null,
  version: 1, previousHash: null, ownerWallet: a.publicKey(), networkPassphrase: Networks.TESTNET,
  recipients: [{ walletAddress: a.publicKey(), role: "artist", shareBps: 7000 }, { walletAddress: b.publicKey(), role: "producer", shareBps: 3000 }], terms: "70/30 master royalties",
});
const submitted = () => submitVersion(createVersion(proposal(), now), a.publicKey(), now);
function sign(transaction: string, key = a, network = Networks.TESTNET) {
  const tx = TransactionBuilder.fromXDR(transaction, network);
  tx.sign(key);
  return tx.toXDR();
}
function respond(v: AgreementVersion, key: Keypair, action = "accept", reason = "") {
  const challenge = createResponseChallenge(v, key.publicKey(), { action, reason }, now);
  return applyResponse(v, challenge, sign(challenge.transaction, key), key.publicKey(), now);
}

test("canonical hashing is order independent and binds all material proposal fields", () => {
  const p = proposal(), hash = canonicalProposal(p).proposalHash;
  assert.equal(canonicalProposal({ ...p, recipients: [...p.recipients].reverse() }).proposalHash, hash);
  for (const changed of [
    { ...p, terms: "Other terms" }, { ...p, trackId: "track-2" }, { ...p, releaseId: "release-1" },
    { ...p, version: 2 }, { ...p, networkPassphrase: Networks.PUBLIC },
    { ...p, agreementId: "agreement-2" }, { ...p, previousHash: "1".repeat(64) }, { ...p, ownerWallet: b.publicKey() },
    { ...p, recipients: p.recipients.map((r,i) => i ? { ...r,role: "writer" as const } : r) },
    { ...p, recipients: p.recipients.map((r,i) => ({ ...r, shareBps: i ? 4000 : 6000 })) },
  ]) assert.notEqual(canonicalProposal(changed).proposalHash, hash);
});
test("invalid shares, duplicate wallets, wallet checksum and unknown fields fail", () => {
  const p = proposal();
  for (const shareBps of [0, -1, 7000.5, 9999]) assert.throws(() => canonicalProposal({ ...p, recipients: [{ ...p.recipients[0]!, shareBps }, p.recipients[1]!] }));
  assert.throws(() => canonicalProposal({ ...p, recipients: p.recipients.map(r => ({ ...r, walletAddress: a.publicKey() })) }));
  assert.throws(() => canonicalProposal({ ...p, ownerWallet: "G".repeat(56) }));
  assert.throws(() => canonicalProposal({ ...p, recipients: [] }));
  assert.throws(() => canonicalProposal({ ...p, recipients: Array.from({ length: 21 },()=>({ walletAddress: Keypair.random().publicKey(),role: "artist" as const,shareBps: 10000 })) }));
  assert.throws(() => canonicalProposal({ ...p, activate: true } as AgreementProposal));
});
test("only owner submits a draft and its hash must match", () => {
  const v = createVersion(proposal(), now);
  assert.throws(() => submitVersion(v, outsider.publicKey(), now));
  assert.throws(() => submitVersion({ ...v, proposalHash: "0".repeat(64) }, a.publicKey(), now));
  assert.throws(() => submitVersion(submitted(), a.publicKey(), now));
});
test("real independent wallet signatures are required before readiness", () => {
  const v = submitted();
  const first = respond(v, a).version;
  assert.equal(first.state, "proposed");
  const second = respond(first, b).version;
  assert.equal(second.state, "ready");
  assert.equal(second.responses.length, 2);
  assert.equal(v.responses.length, 0);
});
test("outsiders and signatures from another wallet cannot consent", () => {
  const v = submitted();
  assert.throws(() => createResponseChallenge(v, outsider.publicKey(), { action: "accept" }, now));
  const c = createResponseChallenge(v, a.publicKey(), { action: "accept" }, now);
  assert.throws(() => applyResponse(v, c, sign(c.transaction, outsider), a.publicKey(), now));
  assert.throws(() => applyResponse(v, c, c.transaction, a.publicKey(), now));
  assert.throws(() => applyResponse(v, c, sign(c.transaction), b.publicKey(), now));
});
test("signatures cannot be replayed into another action, challenge, version or network", () => {
  const v = submitted();
  const accept = createResponseChallenge(v, a.publicKey(), { action: "accept" }, now);
  const reject = createResponseChallenge(v, a.publicKey(), { action: "reject", reason: "Wrong share" }, now);
  assert.throws(() => applyResponse(v, reject, sign(accept.transaction), a.publicKey(), now));
  assert.throws(() => applyResponse({ ...v, proposal: { ...v.proposal, version: 2 } }, accept, sign(accept.transaction), a.publicKey(), now));
  assert.throws(() => applyResponse({ ...v, proposal: { ...v.proposal, agreementId: "another-agreement" } }, accept, sign(accept.transaction), a.publicKey(), now));
  assert.throws(() => applyResponse(v, accept, sign(accept.transaction, a, Networks.PUBLIC), a.publicKey(), now));
  const another = createResponseChallenge(v, a.publicKey(), { action: "accept" }, now);
  assert.throws(() => applyResponse(v, another, sign(accept.transaction), a.publicKey(), now));
});
test("expiry blocks unused consent, exact retries return the recorded response", () => {
  const v = submitted(), c = createResponseChallenge(v, a.publicKey(), { action: "accept" }, now), signed = sign(c.transaction);
  const later = new Date(now.getTime() + 301_000);
  assert.throws(() => applyResponse(v, c, signed, a.publicKey(), later));
  const first = applyResponse(v, c, signed, a.publicKey(), now);
  const conflicting = createResponseChallenge(v,a.publicKey(),{ action: "reject",reason: "Different response" },now);
  assert.throws(() => applyResponse(first.version,conflicting,sign(conflicting.transaction),a.publicKey(),now));
  const retry = applyResponse(first.version, c, signed, a.publicKey(), later);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.version.responses.length, 1);
});
test("rejection or dispute blocks responses and requires a new version", () => {
  for (const action of ["reject", "dispute"]) {
    const result = respond(submitted(), b, action, "Please correct my share");
    assert.equal(result.version.state, action === "reject" ? "rejected" : "disputed");
    assert.throws(() => respond(result.version, a));
    assert.throws(() => amendVersion(result.version, outsider.publicKey(), proposal(), now));
    const next = amendVersion(result.version, a.publicKey(), { recipients: proposal().recipients, terms: "Revised terms" }, now);
    assert.equal(next.proposal.version, 2);
    assert.equal(next.proposal.previousHash, result.version.proposalHash);
    assert.equal(next.responses.length, 0);
    assert.equal(next.state, "draft");
  }
});
test("accepted contributor can dispute a ready version and acceptance evidence survives", () => {
  const ready = respond(respond(submitted(), a).version, b).version;
  const disputed = respond(ready, a, "dispute", "Metadata is incorrect").version;
  assert.equal(disputed.state, "disputed");
  assert.equal(disputed.responses.length, 3);
  assert.equal(disputed.responses[0]!.action, "accept");
});
test("reject and dispute require reasons; acceptance cannot hide a dispute reason", () => {
  for (const action of ["reject", "dispute"]) assert.throws(() => createResponseChallenge(submitted(), a.publicKey(), { action, reason: " " }, now));
  assert.throws(() => createResponseChallenge(submitted(), a.publicKey(), { action: "accept", reason: "but only if..." }, now));
});
test("finalized versions cannot be cancelled or receive more consent; amendments retain history", () => {
  const finalized = { ...respond(respond(submitted(), a).version, b).version, state: "finalized" as const };
  const before = JSON.stringify(finalized);
  assert.throws(() => cancelVersion(finalized, a.publicKey(), now));
  assert.throws(() => respond(finalized, a, "dispute", "Late dispute"));
  const amended = amendVersion(finalized, a.publicKey(), { recipients: proposal().recipients, terms: "Updated" }, now);
  assert.equal(amended.proposal.version, 2);
  assert.equal(JSON.stringify(finalized), before);
});
