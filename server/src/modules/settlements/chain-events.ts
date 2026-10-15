import { databaseService } from "../../services/database.service.js";
import { HttpError } from "../../utils/http-error.js";
import { settlementChain } from "./settlement-chain.js";

export async function indexSettlementEvents() {
  const config=settlementChain.config(),start=settlementChain.eventStartLedger();
  try {
    return await databaseService.transaction(async client=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtext('music-city-settlement-event-index'))");
      await client.query("INSERT INTO settlement_chain_cursors(network_passphrase,contract_id,deployment_ledger) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[config.networkPassphrase,config.contractId,start]);
      const stored=(await client.query("SELECT * FROM settlement_chain_cursors WHERE network_passphrase=$1 AND contract_id=$2 FOR UPDATE",[config.networkPassphrase,config.contractId])).rows[0]!;
      if(Number(stored.deployment_ledger)!==start)throw new HttpError(409,"The financial event index deployment ledger is immutable");
      const result=await settlementChain.events(stored.cursor??undefined);
      if(!result.cursor || result.latestLedger<Number(stored.indexed_ledger??0))throw new HttpError(409,"The financial event index cannot regress");
      for(const event of result.events){
        const payload={...event,networkPassphrase:config.networkPassphrase,contractId:config.contractId};
        await client.query("INSERT INTO settlement_chain_events(network_passphrase,contract_id,event_id,transaction_hash,ledger,batch_id,event_type,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",[config.networkPassphrase,config.contractId,event.id,event.transactionHash,event.ledger,event.batchId,event.type,payload]);
        const previous=(await client.query("SELECT payload=$4::jsonb AS matches FROM settlement_chain_events WHERE network_passphrase=$1 AND contract_id=$2 AND event_id=$3",[config.networkPassphrase,config.contractId,event.id,payload])).rows[0];
        if(!previous?.matches)throw new HttpError(409,"A previously indexed financial event changed");
      }
      await client.query("UPDATE settlement_chain_cursors SET cursor=$3,indexed_ledger=$4,caught_up=$5,checked_at=NOW(),error=NULL WHERE network_passphrase=$1 AND contract_id=$2",[config.networkPassphrase,config.contractId,result.cursor,result.latestLedger,result.caughtUp]);
      return result;
    });
  } catch(error) {
    await databaseService.transaction(client=>client.query("UPDATE settlement_chain_cursors SET error=$3,checked_at=NOW(),caught_up=FALSE WHERE network_passphrase=$1 AND contract_id=$2",[config.networkPassphrase,config.contractId,error instanceof Error?error.message:"Financial event indexing failed"]));
    throw error;
  }
}
