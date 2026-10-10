import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { agreementFinalizationSchema, type AgreementFinalization, type AgreementVersion } from "@music-city/shared";
import { Api } from "@stellar/stellar-sdk/rpc";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { databaseService } from "../../services/database.service.js";
import { HttpError } from "../../utils/http-error.js";
import { agreementsRepository, readVersion, recordEvent, writeVersion } from "./agreements.repository.js";
import { applyResponse, canonicalProposal, createVersion, type ResponseChallenge } from "./agreement-domain.js";
import { agreementsChain, assertPublicationMatches, decodeFinalizedSplit } from "./agreements-chain.js";
import { collectTreasurySignatures, signedTreasuryTransaction, verifyTreasuryEnvelope } from "./treasury-signatures.js";

async function saveAttempt(client: PoolClient, attempt: AgreementFinalization, insert = false) {
  if (insert) await client.query("INSERT INTO agreement_finalizations(id,agreement_id,version,treasury_address,transaction_hash,status,payload) VALUES($1,$2,$3,$4,$5,$6,$7)",[attempt.id,attempt.agreementId,attempt.version,attempt.treasuryAddress,attempt.transactionHash,attempt.status,attempt]);
  else await client.query("UPDATE agreement_finalizations SET status=$2,payload=$3 WHERE id=$1",[attempt.id,attempt.status,attempt]);
}
async function loadAttempt(client: PoolClient, id: string) {
  const result = await client.query("SELECT payload FROM agreement_finalizations WHERE id=$1 FOR UPDATE",[id]);
  if (!result.rows[0]) throw new HttpError(404,"Finalization attempt not found");
  return agreementFinalizationSchema.parse(result.rows[0].payload);
}
function requireConfigMatches(attempt: AgreementFinalization) {
  const config = agreementsChain.config();
  if (config.contractId !== attempt.contractId || config.treasuryAddress !== attempt.treasuryAddress || config.networkPassphrase !== attempt.networkPassphrase) throw new HttpError(409,"Restore this attempt's exact treasury, contract and network configuration before reconciling it");
}
async function verifyConsent(client: PoolClient, version: AgreementVersion) {
  if (canonicalProposal(version.proposal).proposalHash !== version.proposalHash) throw new HttpError(409,"Proposal integrity failed");
  let verified: AgreementVersion = { ...version,state: "proposed",responses: [] };
  for (const response of version.responses) {
    const stored = await client.query("SELECT payload,consumed_at FROM agreement_challenges WHERE id=$1",[response.challengeId]);
    if (!stored.rows[0]?.consumed_at) throw new HttpError(409,"Contributor response lacks verified challenge evidence");
    verified = applyResponse(verified,stored.rows[0].payload as ResponseChallenge,response.signedTransaction,response.walletAddress,new Date(response.respondedAt)).version;
  }
  if (verified.state !== "ready") throw new HttpError(409,"Every required contributor must accept this exact undisputed proposal before finalization");
}
export const finalizationService = {
  async resolveDispute(id: string,actor: string,input: unknown) {
    const request = z.object({ resolution: z.string().trim().min(1).max(1000) }).strict().parse(input);
    return agreementsRepository.locked(id,actor,async (client,_root,current) => {
      if (!["disputed","rejected"].includes(current.state)) throw new HttpError(409,"Only disputed or rejected versions can be resolved");
      // Resolution creates an owner-controlled draft. It does not alter the blocked
      // version or authorize any acceptance, submission or effective-version change.
      const next = createVersion({ ...current.proposal,version: current.proposal.version+1,previousHash: current.proposalHash });
      await writeVersion(client,next,true);
      await client.query("UPDATE contributor_agreements SET current_version=$2 WHERE id=$1",[id,next.proposal.version]);
      await recordEvent(client,current,actor,"dispute_resolution_recorded",{ resolution: request.resolution,revisedVersion: next.proposal.version });
      await recordEvent(client,next,actor,"revision_created",{ resolution: request.resolution,previousVersion: current.proposal.version,initiatedBy: "admin" });
      return next;
    },true);
  },
  async list() {
    return databaseService.transaction(async client => {
      const rows = await client.query("SELECT a.id,a.effective_version,v.payload FROM contributor_agreements a JOIN agreement_versions v ON v.agreement_id=a.id AND v.version=a.current_version ORDER BY a.created_at DESC");
      return rows.rows.map(row => ({ id: row.id,effectiveVersion: row.effective_version,current: row.payload }));
    });
  },
  async detail(id: string, actor: string) {
    return agreementsRepository.locked(id,actor,async (client,root) => {
      const versions = await client.query("SELECT payload FROM agreement_versions WHERE agreement_id=$1 ORDER BY version",[id]);
      const attempts = await client.query("SELECT payload FROM agreement_finalizations WHERE agreement_id=$1 ORDER BY version,id",[id]);
      const events = await client.query("SELECT id,version,actor_wallet,action,payload,created_at FROM agreement_events WHERE agreement_id=$1 ORDER BY id",[id]);
      return { id,currentVersion: root.current_version,effectiveVersion: root.effective_version,versions: versions.rows.map(r => r.payload),finalizations: attempts.rows.map(r => agreementFinalizationSchema.parse(r.payload)),events: events.rows };
    },true);
  },
  async prepare(id: string,actor: string) {
    return agreementsRepository.locked(id,actor,async (client,root,current) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('music-city-agreement-treasury'))");
      const existing = await client.query("SELECT payload FROM agreement_finalizations WHERE agreement_id=$1 AND version=$2 AND status IN ('awaiting_signatures','submitting','submitted','confirmed')",[id,current.proposal.version]);
      if (existing.rows[0]) return agreementFinalizationSchema.parse(existing.rows[0].payload);
      if (current.state !== "ready") throw new HttpError(409,"Only a fully accepted, undisputed version can start finalization");
      await verifyConsent(client,current);
      const config = agreementsChain.config();
      const outstanding = await client.query("SELECT id FROM agreement_finalizations WHERE treasury_address=$1 AND status IN ('awaiting_signatures','submitting','submitted')",[config.treasuryAddress]);
      if (outstanding.rowCount) throw new HttpError(409,"Reconcile the treasury's outstanding finalization before preparing another transaction");
      const previous = root.effective_version ? await readVersion(client,id,root.effective_version) : null;
      const latest = await agreementsChain.getLatest(current.proposal.trackId);
      if ((previous === null && latest !== null) || (previous !== null && (latest?.version !== previous.proposal.version || latest?.proposalHash !== previous.proposalHash || latest.agreementId !== id))) throw new HttpError(409,"Effective agreement does not match Soroban; reconcile before preparing finalization");
      const previousHash = previous?.proposalHash ?? "0".repeat(64);
      const prepared = await agreementsChain.prepare(current,previousHash);
      const timestamp = new Date().toISOString();
      const attempt: AgreementFinalization = agreementFinalizationSchema.parse({ id: randomUUID(),agreementId: id,version: current.proposal.version,proposalHash: current.proposalHash,previousFinalizedHash: previousHash,...prepared,signatures: {},signedBy: [],status: "awaiting_signatures",createdAt: timestamp,updatedAt: timestamp });
      await saveAttempt(client,attempt,true);
      const version = { ...current,state: "finalizing" as const,updatedAt: timestamp };
      await writeVersion(client,version);
      await recordEvent(client,version,actor,"finalization_prepared",{ attemptId: attempt.id,transactionHash: attempt.transactionHash,treasuryAddress: attempt.treasuryAddress,signers: attempt.signers,threshold: 2 });
      return attempt;
    },true);
  },
  async addSignatures(id: string,attemptId: string,actor: string,input: unknown) {
    const request = z.object({ signedTransaction: z.string().min(1).max(200000) }).strict().parse(input);
    return agreementsRepository.locked(id,actor,async (client,_root,current) => {
      const attempt = await loadAttempt(client,attemptId);
      if (attempt.agreementId !== id || attempt.version !== current.proposal.version || current.state !== "finalizing") throw new HttpError(409,"Attempt does not match the version being finalized");
      requireConfigMatches(attempt);
      const next = collectTreasurySignatures(attempt,request.signedTransaction);
      if (next.signedBy.length !== attempt.signedBy.length) {
        await saveAttempt(client,next);
        await recordEvent(client,current,actor,"treasury_signature_recorded",{ attemptId,signedBy: next.signedBy });
      }
      return next;
    },true);
  },
  async submit(id: string,attemptId: string,actor: string) {
    // Commit intent and exact hash before the network call. Network failure leaves a reconcilable attempt.
    const attempt = await agreementsRepository.locked(id,actor,async (client,_root,current) => {
      const stored = await loadAttempt(client,attemptId);
      if (stored.agreementId !== id || stored.version !== current.proposal.version) throw new HttpError(409,"Attempt does not match this agreement");
      if (stored.status === "confirmed") return stored;
      if (!["awaiting_signatures","submitting","submitted"].includes(stored.status)) throw new HttpError(409,"Prepare a new attempt after this terminal result");
      requireConfigMatches(stored);
      await verifyConsent(client,current);
      signedTreasuryTransaction(stored);
      const evidence = await agreementsChain.treasuryEvidence();
      if (JSON.stringify(evidence.signers) !== JSON.stringify(stored.signers)) throw new HttpError(409,"Treasury signer configuration changed; reconcile and prepare a new attempt");
      if (new Date(stored.expiresAt).getTime() <= Date.now()) throw new HttpError(409,"Reconcile this expired transaction before retrying");
      const next = { ...stored,status: "submitting" as const,updatedAt: new Date().toISOString() };
      await saveAttempt(client,next);
      await recordEvent(client,current,actor,"finalization_submission_requested",{ attemptId,transactionHash: next.transactionHash });
      return next;
    },true);
    if (attempt.status === "confirmed") return attempt;
    try {
      await agreementsChain.send(signedTreasuryTransaction(attempt));
    } catch (error) {
      // Persist uncertainty without inventing a failure or a confirmed publication.
      await agreementsRepository.locked(id,actor,async (client) => {
        const latest = await loadAttempt(client,attemptId);
        if (latest.status === "submitting") await saveAttempt(client,{ ...latest,error: error instanceof Error ? error.message : "Submission outcome unknown",updatedAt: new Date().toISOString() });
      },true);
    }
    return this.reconcile(id,attemptId,actor);
  },
  async reconcile(id: string,attemptId: string,actor: string) {
    return agreementsRepository.locked(id,actor,async (client,root,current) => {
      const attempt = await loadAttempt(client,attemptId);
      if (attempt.agreementId !== id) throw new HttpError(404,"Attempt does not belong to this agreement");
      if (["confirmed","failed","expired"].includes(attempt.status)) return attempt;
      requireConfigMatches(attempt);
      const result = await agreementsChain.status(attempt.transactionHash);
      if (result.status !== Api.GetTransactionStatus.NOT_FOUND && result.txHash !== attempt.transactionHash) throw new HttpError(409,"Stellar returned evidence for another transaction");
      const version = attempt.version === current.proposal.version ? current : await readVersion(client,id,attempt.version);
      const timestamp = new Date().toISOString();
      if (result.status === Api.GetTransactionStatus.SUCCESS) {
        const envelope = TransactionBuilder.fromXDR(result.envelopeXdr,attempt.networkPassphrase);
        if (envelope.hash().toString("hex") !== attempt.transactionHash || !result.returnValue) throw new HttpError(409,"Finalization transaction evidence does not match the prepared transaction");
        const signatures = verifyTreasuryEnvelope(attempt,envelope.toXDR());
        if (Object.keys(signatures).length < 2) throw new HttpError(409,"Confirmed transaction lacks two independent treasury signatures");
        const returned = decodeFinalizedSplit(result.returnValue);
        const published = await agreementsChain.getVersion(version.proposal.trackId,attempt.version);
        if (!returned || !published) throw new HttpError(409,"Confirmed transaction has no verifiable agreement publication");
        assertPublicationMatches(version,returned,attempt.previousFinalizedHash);
        assertPublicationMatches(version,published,attempt.previousFinalizedHash);
        if (attempt.version !== root.current_version || version.state !== "finalizing") throw new HttpError(409,"Current version changed while finalization was in flight");
        const confirmed: AgreementFinalization = { ...attempt,signatures,signedBy: Object.keys(signatures).sort(),status: "confirmed",ledger: result.ledger,explorerUrl: `https://stellar.expert/explorer/${attempt.networkPassphrase.includes("Test SDF") ? "testnet" : "public"}/tx/${attempt.transactionHash}`,updatedAt: timestamp };
        delete confirmed.error;
        await saveAttempt(client,confirmed);
        const finalized = { ...version,state: "finalized" as const,updatedAt: timestamp };
        await writeVersion(client,finalized);
        await client.query("UPDATE contributor_agreements SET effective_version=$2 WHERE id=$1",[id,attempt.version]);
        await recordEvent(client,finalized,actor,"finalized",{ attemptId,transactionHash: attempt.transactionHash,ledger: result.ledger });
        return confirmed;
      }
      const expired = result.status === Api.GetTransactionStatus.NOT_FOUND && result.latestLedgerCloseTime > new Date(attempt.expiresAt).getTime()/1000 && result.oldestLedgerCloseTime <= new Date(attempt.createdAt).getTime()/1000;
      if (expired && await agreementsChain.getVersion(version.proposal.trackId,attempt.version)) throw new HttpError(409,"A publication exists but transaction history is unavailable; reconcile its original transaction evidence before retrying");
      if (result.status === Api.GetTransactionStatus.FAILED || expired) {
        const terminal: AgreementFinalization = { ...attempt,status: expired ? "expired" : "failed",error: expired ? "Transaction expired without chain inclusion" : "Stellar rejected the finalization transaction",updatedAt: timestamp };
        await saveAttempt(client,terminal);
        if (version.state === "finalizing" && attempt.version === root.current_version) await writeVersion(client,{ ...version,state: "ready",updatedAt: timestamp });
        await recordEvent(client,version,actor,expired ? "finalization_expired" : "finalization_failed",{ attemptId,transactionHash: attempt.transactionHash });
        return terminal;
      }
      const pending = { ...attempt,status: attempt.status === "awaiting_signatures" ? "awaiting_signatures" as const : "submitted" as const,updatedAt: timestamp };
      await saveAttempt(client,pending);
      return pending;
    },true);
  },
};
