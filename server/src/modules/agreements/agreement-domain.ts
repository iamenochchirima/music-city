import { createHash, randomUUID } from "node:crypto";
import { Account, BASE_FEE, Keypair, Operation, StrKey, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  agreementProposalSchema, agreementResponseRequestSchema, agreementTermsSchema,
  type AgreementAction, type AgreementProposal, type AgreementResponse, type AgreementVersion,
} from "@music-city/shared";
import { HttpError } from "../../utils/http-error.js";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const fail = (message: string): never => { throw new HttpError(409, message); };

export function canonicalProposal(input: AgreementProposal) {
  const parsed = agreementProposalSchema.parse(input);
  const terms = agreementTermsSchema.parse({ recipients: parsed.recipients, terms: parsed.terms });
  for (const wallet of [parsed.ownerWallet, ...terms.recipients.map(r => r.walletAddress)]) {
    if (!StrKey.isValidEd25519PublicKey(wallet)) throw new HttpError(400, "Invalid Stellar wallet");
  }
  // A fixed field order and sorted wallets are the version-one serialization contract.
  const proposal: AgreementProposal = {
    schemaVersion: 1,
    agreementId: parsed.agreementId,
    trackId: parsed.trackId,
    releaseId: parsed.releaseId,
    version: parsed.version,
    previousHash: parsed.previousHash,
    networkPassphrase: parsed.networkPassphrase,
    ownerWallet: parsed.ownerWallet,
    recipients: [...terms.recipients].sort((a,b) => a.walletAddress < b.walletAddress ? -1 : a.walletAddress > b.walletAddress ? 1 : 0)
      .map(r => ({ walletAddress: r.walletAddress, role: r.role, shareBps: r.shareBps })),
    terms: terms.terms,
  };
  const serialized = JSON.stringify({ application: "music-city:royalty-agreement", ...proposal });
  return { proposal, serialized, proposalHash: digest(serialized) };
}

export function createVersion(input: AgreementProposal, now = new Date()): AgreementVersion {
  const canonical = canonicalProposal(input);
  return { proposal: canonical.proposal, proposalHash: canonical.proposalHash, state: "draft", responses: [], createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

export function submitVersion(version: AgreementVersion, actor: string, now = new Date()): AgreementVersion {
  if (actor !== version.proposal.ownerWallet) throw new HttpError(403, "Only the proposal owner can submit it");
  if (version.state !== "draft") fail("Only a draft can be submitted");
  if (canonicalProposal(version.proposal).proposalHash !== version.proposalHash) fail("Proposal integrity check failed");
  return { ...version, state: "proposed", updatedAt: now.toISOString() };
}

export type ResponseChallenge = {
  id: string; walletAddress: string; action: AgreementAction; reason: string;
  agreementId: string; version: number; proposalHash: string;
  expiresAt: string; transaction: string;
};

function requireContributor(version: AgreementVersion, wallet: string) {
  if (!version.proposal.recipients.some(r => r.walletAddress === wallet)) throw new HttpError(403, "Only a contributor can respond");
}

export function createResponseChallenge(version: AgreementVersion, wallet: string, input: unknown, now = new Date()): ResponseChallenge {
  requireContributor(version, wallet);
  const request = agreementResponseRequestSchema.parse(input);
  if (!["proposed", "ready"].includes(version.state)) fail("This version is not open for responses");
  const previous = version.responses.find(r => r.walletAddress === wallet);
  if (previous && !(previous.action === "accept" && request.action === "dispute")) fail("A contributor already responded to this version");
  const expires = Math.floor(now.getTime() / 1000) + 300;
  const challenge = {
    id: randomUUID(), walletAddress: wallet, action: request.action, reason: request.reason,
    agreementId: version.proposal.agreementId, version: version.proposal.version,
    proposalHash: version.proposalHash, expiresAt: new Date(expires * 1000).toISOString(),
  };
  const actionHash = digest(JSON.stringify({ application: "music-city:agreement-response:v1", network: version.proposal.networkPassphrase, ...challenge }));
  // Sequence zero is an off-chain signing challenge, never submitted to Horizon.
  const transaction = new TransactionBuilder(new Account(wallet, "-1"), {
    fee: BASE_FEE, networkPassphrase: version.proposal.networkPassphrase,
    timebounds: { minTime: 0, maxTime: expires },
  }).addOperation(Operation.manageData({ name: "Music City agreement response", value: Buffer.from(actionHash, "hex"), source: wallet })).build();
  return { ...challenge, transaction: transaction.toXDR() };
}

export function applyResponse(version: AgreementVersion, challenge: ResponseChallenge, signedTransaction: string, actor: string, now = new Date()): { version: AgreementVersion; response: AgreementResponse; duplicate: boolean } {
  requireContributor(version, actor);
  if (challenge.walletAddress !== actor || challenge.agreementId !== version.proposal.agreementId || challenge.version !== version.proposal.version || challenge.proposalHash !== version.proposalHash) {
    throw new HttpError(403, "Challenge does not match this contributor and proposal");
  }
  let signed: Transaction;
  try {
    const decoded = TransactionBuilder.fromXDR(signedTransaction, version.proposal.networkPassphrase);
    if (!(decoded instanceof Transaction)) throw new Error("Invalid envelope");
    signed = decoded;
    const expected = TransactionBuilder.fromXDR(challenge.transaction, version.proposal.networkPassphrase);
    if (!signed.hash().equals(expected.hash())) throw new Error("Changed transaction");
    const wallet = Keypair.fromPublicKey(actor);
    if (!signed.signatures.some(s => wallet.verify(signed.hash(), s.signature()))) throw new Error("Invalid signature");
  } catch {
    throw new HttpError(401, "Wallet signature does not authorize the exact agreement response");
  }
  const existing = version.responses.find(r => r.challengeId === challenge.id);
  if (existing) return { version, response: existing, duplicate: true };
  if (new Date(challenge.expiresAt).getTime() <= now.getTime()) fail("Agreement response challenge expired");
  if (!["proposed", "ready"].includes(version.state)) fail("This version is not open for responses");
  const previous = version.responses.find(r => r.walletAddress === actor);
  if (previous && !(previous.action === "accept" && challenge.action === "dispute")) fail("A contributor already responded to this version");
  const response: AgreementResponse = {
    walletAddress: actor, action: challenge.action, reason: challenge.reason,
    challengeId: challenge.id, proposalHash: challenge.proposalHash, signedTransaction,
    respondedAt: now.toISOString(),
  };
  // Preserve acceptance evidence if its contributor subsequently opens a dispute.
  const responses = [...version.responses, response];
  const state = challenge.action === "reject" ? "rejected" : challenge.action === "dispute" ? "disputed" :
    version.proposal.recipients.every(r => responses.some(v => v.walletAddress === r.walletAddress && v.action === "accept")) ? "ready" : "proposed";
  return { version: { ...version, responses, state, updatedAt: now.toISOString() }, response, duplicate: false };
}

export function amendVersion(previous: AgreementVersion, actor: string, terms: unknown, now = new Date()): AgreementVersion {
  if (actor !== previous.proposal.ownerWallet) throw new HttpError(403, "Only the owner can revise the agreement");
  if (!["finalized", "rejected", "disputed", "cancelled"].includes(previous.state)) fail("Resolve or cancel the current proposal before revising it");
  const parsed = agreementTermsSchema.parse(terms);
  return createVersion({ ...previous.proposal, ...parsed, version: previous.proposal.version + 1, previousHash: previous.proposalHash }, now);
}

export function cancelVersion(version: AgreementVersion, actor: string, now = new Date()): AgreementVersion {
  if (actor !== version.proposal.ownerWallet) throw new HttpError(403, "Only the owner can cancel the proposal");
  if (!["draft", "proposed", "ready"].includes(version.state)) fail("This version cannot be cancelled");
  return { ...version, state: "cancelled", updatedAt: now.toISOString() };
}
