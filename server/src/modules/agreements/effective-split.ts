import { Networks } from "@stellar/stellar-sdk";
import { agreementVersionSchema, agreementFinalizationSchema, trackRoyaltySplitRecordSchema, type TrackRoyaltySplitRecord } from "@music-city/shared";
import { databaseService } from "../../services/database.service.js";
import { HttpError } from "../../utils/http-error.js";
import { canonicalProposal } from "./agreement-domain.js";
import { signedTreasuryTransaction } from "./treasury-signatures.js";

function project(row: { version_payload: unknown; finalization_payload: unknown; effective_version: number | null }): TrackRoyaltySplitRecord {
  const version = agreementVersionSchema.parse(row.version_payload);
  const evidence = agreementFinalizationSchema.parse(row.finalization_payload);
  const proposal = version.proposal;
  if (version.state !== "finalized" || evidence.status !== "confirmed" || evidence.agreementId !== proposal.agreementId || evidence.version !== proposal.version || evidence.proposalHash !== version.proposalHash || evidence.networkPassphrase !== proposal.networkPassphrase || canonicalProposal(proposal).proposalHash !== version.proposalHash || evidence.ledger == null) throw new HttpError(409,"Finalized agreement evidence is inconsistent");
  signedTreasuryTransaction(evidence);
  return trackRoyaltySplitRecordSchema.parse({
    id: `agreement:${proposal.agreementId}:${proposal.version}`,agreementId: proposal.agreementId,finalizationId: evidence.id,proposalHash: version.proposalHash,
    trackId: proposal.trackId,version: proposal.version,status: row.effective_version === proposal.version ? "active" : "superseded",historical: false,
    registryKind: "soroban",registryChain: "stellar",registryNetwork: proposal.networkPassphrase === Networks.TESTNET ? "stellar:testnet" : proposal.networkPassphrase === Networks.PUBLIC ? "stellar:public" : proposal.networkPassphrase,
    registryContractId: evidence.contractId,registryTxHash: evidence.transactionHash,registryPublishedAt: evidence.updatedAt,registryVerificationStatus: "match",registryVerifiedAt: evidence.updatedAt,
    registryVerificationMessage: "Contributor consent and threshold-authorized publication confirmed.",
    recipients: proposal.recipients.map(recipient => ({ ...recipient,chain: "stellar",payoutRail: "stellar" })),totalBps: 10000,notes: proposal.terms,createdAt: version.createdAt,updatedAt: version.updatedAt,
  });
}
const select = `SELECT a.effective_version,v.payload AS version_payload,f.payload AS finalization_payload
  FROM contributor_agreements a JOIN agreement_versions v ON v.agreement_id=a.id
  JOIN agreement_finalizations f ON f.agreement_id=v.agreement_id AND f.version=v.version AND f.status='confirmed'
  WHERE a.track_id=$1 AND v.state='finalized'`;
export const finalizedSplitsRepository = {
  async list(trackId: string) {
    return databaseService.transaction(async client => {
      const result = await client.query(select+" ORDER BY v.version DESC",[trackId]);
      return result.rows.map(project);
    });
  },
  async effective(trackId: string) {
    return databaseService.transaction(async client => {
      const result = await client.query(select+" AND v.version=a.effective_version",[trackId]);
      return result.rows[0] ? project(result.rows[0]) : null;
    });
  },
};
