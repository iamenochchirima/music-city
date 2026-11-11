import {createHash} from "node:crypto";
import {Account,BASE_FEE,Contract,TransactionBuilder,Transaction,nativeToScVal,scValToNative,xdr} from "@stellar/stellar-sdk";
import {Api,Server} from "@stellar/stellar-sdk/rpc";
import {env} from "../../config/env.js";
import {HttpError} from "../../utils/http-error.js";
import {settlementChain,settlementConfig} from "../settlements/settlement-chain.js";
import {amountUnits,financialHash} from "../settlements/settlement-domain.js";
import {finalizedSplitsRepository} from "../agreements/effective-split.js";
import type {PaymentIntentRecord,PoolOrder} from "@music-city/shared";
const rpc=()=>new Server(env.STELLAR_SOROBAN_RPC_URL,{timeout:20000});
export const poolId=()=>{if(!env.EARNINGS_POOL_CONTRACT_ID)throw new HttpError(503,"Earnings pool is not configured");return env.EARNINGS_POOL_CONTRACT_ID;};
export const bytes=(id:string)=>nativeToScVal(Buffer.from(id,"hex"));
export const poolChain={
 async read(method:string,args:xdr.ScVal[]=[]) {
  const c=settlementConfig();const tx=new TransactionBuilder(new Account(c.treasuryAddress,"0"),{fee:BASE_FEE,networkPassphrase:c.networkPassphrase}).addOperation(new Contract(poolId()).call(method,...args)).setTimeout(30).build();
  const result=await rpc().simulateTransaction(tx);
  if(!Api.isSimulationSuccess(result)||!result.result)throw new HttpError(502,"Cannot verify pool state. Archived records must be restored before continuing");
  return scValToNative(result.result.retval);
 },
 async verify(){const c=settlementConfig(),actual=await this.read("configuration");if(actual.treasury!==c.treasuryAddress||actual.registry!==c.registryId||actual.asset!==c.assetContractId||Buffer.from(actual.network).toString("hex")!==createHash("sha256").update(c.networkPassphrase).digest("hex"))throw new HttpError(409,"Pool configuration differs from the configured treasury, registry or USDC asset");return {...c,contractId:poolId(),feeBps:Number(actual.fee_bps)};},
 async prepare(source:string,method:string,args:xdr.ScVal[],expiresAt?:string){
  const config=await this.verify();const tx=new TransactionBuilder(await rpc().getAccount(source),{fee:BASE_FEE,networkPassphrase:config.networkPassphrase}).addOperation(new Contract(poolId()).call(method,...args)).setTimeout(expiresAt?Math.max(1,Math.min(300,Math.floor((Date.parse(expiresAt)-Date.now())/1000))):600).build();
  const prepared=await rpc().prepareTransaction(tx);const readiness=await settlementChain.readiness(source,config,"0",false);
  if(readiness.nativeAvailableUnits<BigInt(prepared.fee))throw new HttpError(409,"Add XLM to cover the network fee above your wallet reserve");
  return {transaction:prepared.toXDR(),transactionHash:prepared.hash().toString("hex"),expiresAt:new Date(Number(prepared.timeBounds!.maxTime)*1000).toISOString()};
 },
 async preparePurchase(intent:PaymentIntentRecord){
  if(intent.poolContractId!==poolId()||!intent.poolOrderId||!intent.trackId)throw new HttpError(409,"Restore this purchase's pool configuration before continuing");
  const split=(await finalizedSplitsRepository.list(intent.trackId)).find(s=>s.id===intent.royaltySplitId);if(!split?.version||!split.proposalHash)throw new HttpError(409,"This purchase has no verified agreement");
  const request=nativeToScVal({order_id:Buffer.from(intent.poolOrderId,"hex"),track_id:intent.trackId,version:split.version,proposal_hash:Buffer.from(split.proposalHash,"hex"),buyer:intent.walletAddress,gross:amountUnits(intent.amount)},
   {type:{order_id:["symbol","bytes"],track_id:["symbol","string"],version:["symbol","u32"],proposal_hash:["symbol","bytes"],buyer:["symbol","address"],gross:["symbol","i128"]}});
  return this.prepare(intent.walletAddress,"buy",[request],intent.expiresAt);
 },
 async order(id:string,hash:string):Promise<PoolOrder|null>{const native=await this.read("get_order",[bytes(id)]);if(!native)return null;
  const r=native.request;return {id:Buffer.from(r.order_id).toString("hex"),contractId:poolId(),trackId:r.track_id,version:r.version,proposalHash:Buffer.from(r.proposal_hash).toString("hex"),buyer:r.buyer,grossUnits:String(r.gross),transactionHash:hash,ledger:Number(native.ledger),claims:native.claims.map((a:any,index:number)=>({index,beneficiary:a.beneficiary,grossUnits:String(a.gross),feeUnits:String(a.fee),amountUnits:String(a.amount),claimed:a.claimed,ledger:Number(a.ledger)}))};
 },
 async receipt(hash:string){return rpc().getTransaction(hash);},
 async send(xdr:string){return rpc().sendTransaction(TransactionBuilder.fromXDR(xdr,env.STELLAR_NETWORK_PASSPHRASE) as Transaction);},
 async signers(){return settlementChain.treasurySigners(settlementConfig());},
 async events(cursor?:string){const start=env.EARNINGS_POOL_DEPLOYMENT_LEDGER;if(!start)throw new HttpError(503,"Set the pool deployment ledger before indexing");const server=rpc();const health=await server.getHealth();
  if(!cursor&&start<health.oldestLedger)throw new HttpError(409,"Pool event history requires an archive backfill; reconciliation cannot be marked complete");
  return server.getEvents({...cursor?{cursor}:{startLedger:start},filters:[{type:"contract",contractIds:[poolId()]}],limit:1000});
 },
};
export function poolOrderId(intentId:string){return financialHash({kind:"pool-purchase",intentId});}
