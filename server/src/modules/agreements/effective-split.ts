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
      const versions = await client.query("SELECT v.version FROM contributor_agreements a JOIN agreement_versions v ON v.agreement_id=a.id WHERE a.track_id=$1 AND v.state='finalized' AND v.payload->>'publicationMode'='contributors' ORDER BY v.version DESC",[trackId]);
      const contributors: TrackRoyaltySplitRecord[] = [];
      for (const row of versions.rows) { const split=await contributorSplit(client,trackId,row.version); if(split)contributors.push(split); }
      if (contributors.length) return contributors;
      const result = await client.query(select+" ORDER BY v.version DESC",[trackId]);
      return result.rows.map(project);
    });
  },
  async effective(trackId: string) {
    return databaseService.transaction(async client => {
      const contributor = await contributorSplit(client, trackId);
      if (contributor) return contributor;
      const result = await client.query(select+" AND v.version=a.effective_version",[trackId]);
      return result.rows[0] ? project(result.rows[0]) : null;
    });
  },
};

async function contributorSplit(client: import("pg").PoolClient, trackId: string, requestedVersion?: number): Promise<TrackRoyaltySplitRecord | null> {
  const row=(await client.query("SELECT a.effective_version,v.payload FROM contributor_agreements a JOIN agreement_versions v ON v.agreement_id=a.id AND v.version=COALESCE($2::integer,a.effective_version) WHERE a.track_id=$1",[trackId,requestedVersion??null])).rows[0];
  if(!row || row.payload.publicationMode!=="contributors")return null;
  const version=agreementVersionSchema.parse(row.payload), publication=version.publication;
  if(version.state!=="finalized" || !publication || canonicalProposal(version.proposal).proposalHash!==version.proposalHash)throw new HttpError(409,"Confirmed contributor publication evidence is missing");
  const { agreementsChain, assertPublicationMatches } = await import("./agreements-chain.js");
  const config=agreementsChain.config();
  if(publication.contractId!==config.contractId || publication.networkPassphrase!==config.networkPassphrase)throw new HttpError(409,"Contributor agreement registry configuration does not match");
  const receipt=(await client.query("SELECT receipt FROM contributor_chain_attempts WHERE agreement_id=$1 AND version=$2 AND transaction_hash=$3 AND status='confirmed'",[version.proposal.agreementId,version.proposal.version,publication.transactionHash])).rows[0]?.receipt;
  if(!receipt || receipt.ledger!==publication.ledger || receipt.contractId!==publication.contractId)throw new HttpError(409,"Contributor publication receipt does not match");
  const actual=await agreementsChain.getVersion(trackId,version.proposal.version);
  if(!actual || actual.finalizedLedger!==publication.ledger)throw new HttpError(409,"Contributor split is not confirmed in the registry");
  assertPublicationMatches(version,actual,publication.previousFinalizedHash);
  const p=version.proposal;
  return trackRoyaltySplitRecordSchema.parse({ id:`agreement:${p.agreementId}:${p.version}`,agreementId:p.agreementId,finalizationId:publication.transactionHash,proposalHash:version.proposalHash,trackId,version:p.version,status:p.version===row.effective_version?"active":"superseded",historical:false,registryKind:"soroban",registryChain:"stellar",registryNetwork:p.networkPassphrase===Networks.TESTNET?"stellar:testnet":"stellar:public",registryContractId:publication.contractId,registryTxHash:publication.transactionHash,registryPublishedAt:version.updatedAt,registryVerificationStatus:"match",registryVerifiedAt:version.updatedAt,registryVerificationMessage:"Every required contributor approved; finalization confirmed on-chain.",recipients:p.recipients.map(r=>({...r,chain:"stellar",payoutRail:"stellar"})),totalBps:10000,notes:p.terms,createdAt:version.createdAt,updatedAt:version.updatedAt });
}
