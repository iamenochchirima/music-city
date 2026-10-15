import { scValToNative, xdr } from "@stellar/stellar-sdk";
import type { PoolClient } from "pg";
import type { SettlementBatch } from "@music-city/shared";
import { HttpError } from "../../utils/http-error.js";
import type { ChainBatch } from "./settlement-chain.js";

export async function indexedBatchReceipts(client:PoolClient,batch:SettlementBatch,actual:ChainBatch) {
  const rows=await client.query("SELECT transaction_hash,ledger,event_type,payload FROM settlement_chain_events WHERE network_passphrase=$1 AND contract_id=$2 AND batch_id=$3 ORDER BY ledger,event_id",[batch.config.networkPassphrase,batch.config.contractId,batch.id]);
  let fundingHash:string|undefined;
  const claims=new Map<number,string>();
  for(const row of rows.rows) {
    const stored=row.payload.payload as {topics:string[];value:string};
    const data=scValToNative(xdr.ScVal.fromXDR(stored.value,"base64"));
    if(row.event_type==="settlement_funded") {
      if(Number(row.ledger)!==actual.funded_ledger || BigInt(data.amount)!==actual.funded || Buffer.from(data.source_id).toString("hex")!==batch.sourceKey || Buffer.from(data.proposal_hash).toString("hex")!==batch.proposalHash || BigInt(data.expires_at)!==actual.request.expires_at)throw new HttpError(409,"Indexed funding event differs from the settlement");
      if(fundingHash && fundingHash!==row.transaction_hash) throw new HttpError(409,"Multiple funding receipts exist for one settlement");
      fundingHash=row.transaction_hash as string;
    } else if(row.event_type==="claim_consumed") {
      const index=Number(scValToNative(xdr.ScVal.fromXDR(stored.topics[3]!,"base64")));
      const claim=actual.claims[index];
      if(!claim || Number(row.ledger)!==claim.updated_ledger || data.beneficiary!==claim.beneficiary || BigInt(data.amount)!==claim.amount || JSON.stringify(data.status)!==JSON.stringify(claim.status) || claim.status[0]==="Available") throw new HttpError(409,"Indexed withdrawal event differs from its beneficiary claim");
      if(claims.has(index) && claims.get(index)!==row.transaction_hash)throw new HttpError(409,"Multiple receipts consume one beneficiary claim");
      claims.set(index,row.transaction_hash as string);
    }
  }
  return {fundingHash,claims};
}
