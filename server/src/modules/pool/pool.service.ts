import {verifyAdminWalletProof} from "../admin/admin-wallet-proof.js";
import {logger} from "../../utils/logger.js";
import {randomUUID} from "node:crypto";
import {TransactionBuilder,scValToNative,nativeToScVal} from "@stellar/stellar-sdk";
import {Api} from "@stellar/stellar-sdk/rpc";
import {poolAttemptSchema,poolOrderSchema,type PoolAttempt,type PoolOrder,type PaymentIntentRecord} from "@music-city/shared";
import {databaseService as db} from "../../services/database.service.js";
import {env} from "../../config/env.js";
import {HttpError} from "../../utils/http-error.js";
import {poolChain,poolId,bytes} from "./pool-chain.js";
import {amountUnits,financialHash} from "../settlements/settlement-domain.js";
import {settlementChain,settlementConfig} from "../settlements/settlement-chain.js";
import {collectTreasurySignatures,verifyTreasuryEnvelope} from "../agreements/treasury-signatures.js";
import {signedFinancialTransaction} from "../settlements/settlement.service.js";
import {agreementsChain} from "../agreements/agreements-chain.js";
import {walletService} from "../wallet/wallet.service.js";
import type {PoolClient} from "pg";
async function load(c:PoolClient,id:string){const row=(await c.query("SELECT payload FROM pool_attempts WHERE id=$1 FOR UPDATE",[id])).rows[0];if(!row)throw new HttpError(404,"Pool transaction not found");const a=poolAttemptSchema.parse(row.payload);if(a.poolContractId!==poolId()||a.networkPassphrase!==env.STELLAR_NETWORK_PASSPHRASE)throw new HttpError(409,"Restore this pool transaction's original contract and network");return a;}
function authorize(a:PoolAttempt,actor:string,admin:boolean){if(admin?a.kind==="claim":a.kind!=="claim"||a.actor!==actor||a.treasuryAddress!==actor)throw new HttpError(403,"This pool action requires its authorized account");}
async function save(c:PoolClient,a:PoolAttempt){await c.query("UPDATE pool_attempts SET status=$2,payload=$3,checked_at=NOW() WHERE id=$1",[a.id,a.status,a]);}
async function persistOrder(order:PoolOrder){await db.transaction(c=>c.query("INSERT INTO pool_orders(contract_id,id,payload) VALUES($1,$2,$3) ON CONFLICT(contract_id,id) DO UPDATE SET payload=EXCLUDED.payload",[poolId(),order.id,poolOrderSchema.parse(order)]));}
async function validateOrder(order:PoolOrder){
 const config=await poolChain.verify(),split=await agreementsChain.getVersion(order.trackId,order.version);
 if(!split||split.proposalHash!==order.proposalHash||split.recipients.length!==order.claims.length)throw new HttpError(409,"Pool purchase has no matching finalized agreement");
 let assigned=0n;const gross=BigInt(order.grossUnits);
 for(const [i,r] of split.recipients.entries()){const a=order.claims[i]!;const share=i===split.recipients.length-1?gross-assigned:gross*BigInt(r.shareBps)/10000n;assigned+=share;const fee=share*BigInt(config.feeBps)/10000n;
  if(a.beneficiary!==r.walletAddress||BigInt(a.grossUnits)!==share||BigInt(a.feeUnits)!==fee||BigInt(a.amountUnits)!==share-fee)throw new HttpError(409,"Pool allocation differs from the captured split and fee");
 }
}
export const poolService={
 async verifyPurchase(intent:PaymentIntentRecord,hash:string){
  if(intent.poolContractId!==poolId()||!intent.poolOrderId||intent.networkPassphrase!==env.STELLAR_NETWORK_PASSPHRASE)throw new HttpError(409,"Purchase pool or network changed");
  const prepared=await db.transaction(async c=>(await c.query("SELECT payload FROM payment_checkouts WHERE intent_id=$1 AND transaction_hash=$2",[intent.id,hash])).rows[0]?.payload);
  if(!prepared||prepared.poolOrderId!==intent.poolOrderId)throw new HttpError(409,"Pool purchase must match its exact prepared checkout");
  const receipt=await poolChain.receipt(hash);if(receipt.status!==Api.GetTransactionStatus.SUCCESS)throw new HttpError(409,"Pool purchase is not confirmed yet");
  const tx=TransactionBuilder.fromXDR(receipt.envelopeXdr,intent.networkPassphrase!);
  if(tx.hash().toString("hex")!==hash||!("source" in tx)||tx.source!==intent.walletAddress)throw new HttpError(409,"Pool purchase receipt differs from the buyer's checkout");
  const order=await poolChain.order(intent.poolOrderId,hash);
  if(!order||order.buyer!==intent.walletAddress||order.trackId!==intent.trackId||order.grossUnits!==amountUnits(intent.amount).toString()||order.ledger!==receipt.ledger)throw new HttpError(409,"Pool purchase outcome differs from the paid order");
  const {finalizedSplitsRepository}=await import("../agreements/effective-split.js");
  const split=(await finalizedSplitsRepository.list(order.trackId)).find(s=>s.id===intent.royaltySplitId);
  if(!split||order.version!==split.version||order.proposalHash!==split.proposalHash)throw new HttpError(409,"Pool purchase changed the captured agreement");
  await validateOrder(order);await persistOrder(order);
  return {transaction:{created_at:new Date(Number(receipt.createdAt)*1000).toISOString()}};
 },
 async prepare(actor:string,input:{action:"top_up"|"return_surplus"|"claim";amount?:string;orderId?:string;index?:number}){
  const config=await poolChain.verify();let order:PoolOrder|null=null;
  if(input.action==="claim"){
   const stored=await db.transaction(async c=>(await c.query("SELECT payload FROM pool_orders WHERE contract_id=$1 AND id=$2",[poolId(),input.orderId])).rows[0]?.payload);
   if(!stored)throw new HttpError(404,"Pool earnings not found");order=await poolChain.order(input.orderId!,stored.transactionHash);if(!order)throw new HttpError(409,"Pool earnings cannot be verified");
   if(order.claims[input.index!]?.beneficiary!==actor)throw new HttpError(403,"This earning belongs to another wallet");
   await validateOrder(order);await persistOrder(order);
  }
  const source=input.action==="claim"?actor:config.treasuryAddress;
  return db.transaction(async c=>{
   await c.query("SELECT pg_advisory_xact_lock(hashtext('music-city-agreement-treasury'))");
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`checkout:${source}`]);
   if(input.action==="claim"){
    const existing=(await c.query("SELECT payload FROM pool_attempts WHERE contract_id=$1 AND payload->>'batchId'=$2 AND payload->>'claimIndex'=$3 AND status IN ('awaiting_signatures','submitting','submitted','confirmed') ORDER BY payload->>'createdAt' DESC LIMIT 1",[poolId(),input.orderId,String(input.index)])).rows[0];if(existing)return poolAttemptSchema.parse(existing.payload);
    if(order!.claims[input.index!]!.claimed)throw new HttpError(409,"These earnings have already been received");
   }
   const busy=await c.query("SELECT id FROM pool_attempts WHERE source_address=$1 AND status IN ('awaiting_signatures','submitting','submitted') UNION ALL SELECT id FROM financial_attempts WHERE source_address=$1 AND status IN ('awaiting_signatures','submitting','submitted') UNION ALL SELECT id FROM payment_checkouts WHERE wallet_address=$1 AND status IN ('prepared','submitting') UNION ALL SELECT id FROM agreement_finalizations WHERE treasury_address=$1 AND status IN ('awaiting_signatures','submitting','submitted')",[source]);
   if(busy.rowCount)throw new HttpError(409,"Finish this wallet's pending transaction before starting another");
   const units=input.action==="claim"?order!.claims[input.index!]!.amountUnits:amountUnits(input.amount??"0").toString();if(BigInt(units)<=0n)throw new HttpError(400,"Choose an amount greater than zero");
   const id=randomUUID(),movementId=input.action==="claim"?input.orderId!:financialHash({id,pool:poolId(),action:input.action});
   const args=input.action==="claim"?[bytes(movementId),nativeToScVal(input.index!,{type:"u32"})]:[bytes(movementId),nativeToScVal(BigInt(units),{type:"i128"})];
   if(input.action!=="return_surplus")await settlementChain.readiness(source,settlementConfig(),units,input.action==="claim");
   const prepared=await poolChain.prepare(source,input.action,args);
   const stamp=new Date().toISOString();const a=poolAttemptSchema.parse({id,batchId:movementId,kind:input.action==="claim"?"claim":"settle",claimIndex:input.index,actor,treasuryAddress:source,networkPassphrase:config.networkPassphrase,...prepared,poolContractId:poolId(),poolAction:input.action,amountUnits:units,signers:input.action==="claim"?[source]:await poolChain.signers(),signatures:{},signedBy:[],status:"awaiting_signatures",createdAt:stamp,updatedAt:stamp});
   await c.query("INSERT INTO pool_attempts(id,contract_id,source_address,transaction_hash,status,payload) VALUES($1,$2,$3,$4,$5,$6)",[a.id,poolId(),source,a.transactionHash,a.status,a]);return a;
  });
 },
 async addSignature(id:string,actor:string,signedTransaction:string,admin=false){return db.transaction(async c=>{const a=await load(c,id);authorize(a,actor,admin);if(a.status!=="awaiting_signatures")return a;if(admin&&actor.startsWith("admin:")){
    const linked=(await c.query("SELECT wallet_address,network_passphrase FROM admin_wallet_links WHERE admin_id=$1",[actor.slice(6)])).rows[0];
    if(!linked||linked.network_passphrase!==a.networkPassphrase)throw new HttpError(403,"Link your own wallet before signing treasury transactions");
    if(!a.signers.includes(linked.wallet_address)||!(await poolChain.signers()).includes(linked.wallet_address))throw new HttpError(403,"Your linked wallet is not an authorized signer for this transaction");
    verifyAdminWalletProof(a.transaction,signedTransaction,linked.wallet_address,a.networkPassphrase);
   }
   const next=poolAttemptSchema.parse({...a,...collectTreasurySignatures(a,signedTransaction)});
   if(admin){
    const account=actor.startsWith("admin:")?(await c.query("SELECT payload->>'name' AS name FROM admins WHERE id=$1",[actor.slice(6)])).rows[0]:undefined;
    for(const signer of next.signedBy.filter(s=>!a.signedBy.includes(s)))await c.query("INSERT INTO pool_signature_approvals(attempt_id,signer_wallet,actor,actor_name) VALUES($1,$2,$3,$4)",[a.id,signer,actor,account?.name??actor]);
   }
   await save(c,next);return next;});},
 async submit(id:string,actor:string,admin=false){
  const ready=await db.transaction(async c=>{const a=await load(c,id);authorize(a,actor,admin);if(["confirmed","failed","expired"].includes(a.status))return null;
   const tx=signedFinancialTransaction(a);if(Date.parse(a.expiresAt)<=Date.now())return null;
   if(a.submissionCount>=3||(a.lastSubmittedAt&&Date.now()-Date.parse(a.lastSubmittedAt)<30000))return null;
   if(a.kind!=="claim"&&JSON.stringify(await poolChain.signers())!==JSON.stringify(a.signers))throw new HttpError(409,"Treasury signers changed");
   const next={...a,status:"submitting" as const,submissionCount:a.submissionCount+1,lastSubmittedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await save(c,next);return tx.toXDR();});
  if(ready){try{await poolChain.send(ready);}catch{/* Keep the original signed envelope and reconcile its hash. */}}
  return this.reconcile(id);
 },
 async reconcile(id:string){return db.transaction(async c=>{
  const a=await load(c,id);if(["confirmed","failed","expired"].includes(a.status))return a;const r=await poolChain.receipt(a.transactionHash);
  if(r.status!==Api.GetTransactionStatus.NOT_FOUND&&r.txHash!==a.transactionHash)throw new HttpError(409,"RPC returned another pool transaction");
  if(r.status===Api.GetTransactionStatus.SUCCESS){
   const signatures=verifyTreasuryEnvelope(a,TransactionBuilder.fromXDR(r.envelopeXdr,a.networkPassphrase).toXDR());if(Object.keys(signatures).length<(a.kind==="claim"?1:2))throw new HttpError(409,"Pool transaction lacks the required signatures");
   if(a.kind==="claim"){
    const stored=(await c.query("SELECT payload FROM pool_orders WHERE contract_id=$1 AND id=$2",[poolId(),a.batchId])).rows[0]?.payload;
    const order=await poolChain.order(a.batchId,stored?.transactionHash);const claim=order?.claims[a.claimIndex!];
    if(!order||!claim?.claimed||claim.ledger!==r.ledger||claim.beneficiary!==a.treasuryAddress||claim.amountUnits!==a.amountUnits)throw new HttpError(409,"Pool claim receipt does not match the beneficiary outcome");
    await validateOrder(order);await c.query("UPDATE pool_orders SET payload=$3 WHERE contract_id=$1 AND id=$2",[poolId(),a.batchId,order]);
   }else{const movement=await poolChain.read(a.poolAction==="top_up"?"get_top_up":"get_return",[bytes(a.batchId)]);if(!movement||String(movement.amount)!==a.amountUnits||Number(movement.ledger)!==r.ledger)throw new HttpError(409,"Pool funding receipt has no matching movement");}
   const next={...a,status:"confirmed" as const,signatures,signedBy:Object.keys(signatures).sort(),ledger:r.ledger,feeCharged:r.resultXdr.feeCharged().toString(),updatedAt:new Date().toISOString()};await save(c,next);return next;
  }
  const expired=r.status===Api.GetTransactionStatus.NOT_FOUND&&r.latestLedgerCloseTime>Date.parse(a.expiresAt)/1000&&r.oldestLedgerCloseTime<=Date.parse(a.createdAt)/1000;
  if(r.status===Api.GetTransactionStatus.FAILED||expired){
   if(expired){const outcome=a.kind==="claim"?await poolChain.read("get_order",[bytes(a.batchId)]):await poolChain.read(a.poolAction==="top_up"?"get_top_up":"get_return",[bytes(a.batchId)]);if(a.kind==="claim"?outcome?.claims[a.claimIndex!]?.claimed:outcome)throw new HttpError(409,"Pool outcome exists but its original receipt is unresolved; do not prepare another transaction");}
   const next={...a,status:expired?"expired" as const:"failed" as const,error:expired?"Transaction expired without inclusion. Prepare a new transaction.":"Stellar rejected the pool transaction. No transfer completed.",...(r.status===Api.GetTransactionStatus.FAILED?{ledger:r.ledger,feeCharged:r.resultXdr.feeCharged().toString()}:{}),updatedAt:new Date().toISOString()};await save(c,next);return next;
  }
  await c.query("UPDATE pool_attempts SET checked_at=NOW() WHERE id=$1",[id]);return a;
 });},
 async mine(wallet:string){const rows=await db.transaction(async c=>({orders:(await c.query("SELECT o.payload,t.payload->>'title' AS title FROM pool_orders o LEFT JOIN tracks t ON t.id=o.payload->>'trackId' WHERE o.contract_id=$1 AND EXISTS(SELECT 1 FROM jsonb_array_elements(o.payload->'claims') a WHERE a->>'beneficiary'=$2) ORDER BY o.payload->>'ledger' DESC",[poolId(),wallet])).rows,attempts:(await c.query("SELECT payload FROM pool_attempts WHERE contract_id=$1 AND source_address=$2 ORDER BY payload->>'createdAt' DESC",[poolId(),wallet])).rows}));return {orders:rows.orders.map(r=>({...poolOrderSchema.parse(r.payload),trackTitle:r.title})),attempts:rows.attempts.map(r=>poolAttemptSchema.parse(r.payload))};},
 async syncEvents(){
  const current=await db.transaction(async c=>(await c.query("SELECT cursor FROM pool_cursors WHERE contract_id=$1",[poolId()])).rows[0]?.cursor);
  const result=await poolChain.events(current);const receipts=new Map<string,Awaited<ReturnType<typeof poolChain.receipt>>>();
  for(const event of result.events){let receipt=receipts.get(event.txHash);if(!receipt){receipt=await poolChain.receipt(event.txHash);receipts.set(event.txHash,receipt);}
   if(receipt.status!==Api.GetTransactionStatus.SUCCESS||receipt.txHash!==event.txHash||receipt.ledger!==event.ledger||TransactionBuilder.fromXDR(receipt.envelopeXdr,env.STELLAR_NETWORK_PASSPHRASE).hash().toString("hex")!==event.txHash)throw new HttpError(409,"Pool event has no matching successful receipt");
   const topics=event.topic.map(scValToNative),name=String(topics[1]);
   if(name==="pool_purchase"||name==="pool_claim"){
    const id=Buffer.from(topics[2]).toString("hex");let hash=event.txHash;
    if(name==="pool_claim"){const existing=await db.transaction(async c=>(await c.query("SELECT payload FROM pool_orders WHERE contract_id=$1 AND id=$2",[poolId(),id])).rows[0]);if(!existing)throw new HttpError(409,"Pool claim is missing its indexed purchase; history needs backfill");hash=existing.payload.transactionHash;}
    const order=await poolChain.order(id,hash);if(!order)throw new HttpError(409,"Pool purchase state is unavailable");await validateOrder(order);await persistOrder(order);
   }
   await db.transaction(c=>c.query("INSERT INTO pool_events(contract_id,event_id,transaction_hash,ledger,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",[poolId(),event.id,event.txHash,event.ledger,{name,topics:topics.map(v=>Buffer.isBuffer(v)?v.toString("hex"):v),value:event.value.toXDR("base64"),feeCharged:receipt.resultXdr.feeCharged().toString()}]));
  }
  await db.transaction(c=>c.query("INSERT INTO pool_cursors(contract_id,cursor,caught_up) VALUES($1,$2,$3) ON CONFLICT(contract_id) DO UPDATE SET cursor=EXCLUDED.cursor,caught_up=EXCLUDED.caught_up,updated_at=NOW()",[poolId(),result.cursor,result.events.length<1000]));
 },
 async treasuryBalance(){
  const config=settlementConfig();
  const account=await walletService.getWalletAccount(config.treasuryAddress);
  if(!account.exists)throw new HttpError(502,"Treasury account is unavailable");
  const balance=account.balances.find(b=>b.assetCode===config.assetCode&&b.assetIssuer===config.assetIssuer);
  return {walletAddress:config.treasuryAddress,balanceUnits:String(amountUnits(balance?.amount??"0")),availableUnits:String(amountUnits(balance?.availableAmount??"0"))};
 },
 async report(){const config=await poolChain.verify(),totals=await poolChain.read("totals"),balance=BigInt(await poolChain.read("balance"));
  const data=await db.transaction(async c=>({orders:(await c.query("SELECT payload FROM pool_orders WHERE contract_id=$1",[poolId()])).rows.map(r=>poolOrderSchema.parse(r.payload)),events:(await c.query("SELECT payload FROM pool_events WHERE contract_id=$1",[poolId()])).rows,unresolved:(await c.query("SELECT id FROM pool_attempts WHERE contract_id=$1 AND status IN ('submitting','submitted') AND (payload->>'expiresAt')::timestamptz<NOW()",[poolId()])).rows,cursor:(await c.query("SELECT * FROM pool_cursors WHERE contract_id=$1",[poolId()])).rows[0]}));
  let gross=0n,fees=0n,claimed=0n,outstanding=0n;for(const o of data.orders){gross+=BigInt(o.grossUnits);for(const a of o.claims){fees+=BigInt(a.feeUnits);if(a.claimed)claimed+=BigInt(a.amountUnits);else outstanding+=BigInt(a.amountUnits);}}
  let topped=0n,returned=0n;for(const e of data.events){const value=scValToNative((await import("@stellar/stellar-sdk")).xdr.ScVal.fromXDR(e.payload.value,"base64"));if(e.payload.name==="pool_top_up")topped+=BigInt(value.amount);if(e.payload.name==="pool_return")returned+=BigInt(value.amount);}
  const errors:string[]=[];if(data.unresolved.length)errors.push("An expired pool transaction still has an unresolved outcome");if(!data.cursor?.caught_up||Date.now()-new Date(data.cursor.updated_at).getTime()>120000)errors.push("Pool event indexing is incomplete or stale");
  if(gross!==BigInt(totals.purchased)||fees!==BigInt(totals.fees)||claimed!==BigInt(totals.claimed)||outstanding!==BigInt(totals.outstanding)||topped!==BigInt(totals.topped_up)||returned!==BigInt(totals.returned))errors.push("Indexed earnings or pool movements differ from on-chain totals");
  if(balance<outstanding)errors.push("Pool balance is below contributor obligations");const expected=topped-returned+gross-fees-claimed;if(balance!==expected)errors.push("Pool token balance includes unexplained movements");
  return {enabled:env.EARNINGS_MODE==="pool",contractId:poolId(),feeBps:config.feeBps,balanceUnits:String(balance),outstandingUnits:String(totals.outstanding),surplusUnits:String(balance-BigInt(totals.outstanding)),purchasedUnits:String(totals.purchased),feeUnits:String(totals.fees),claimedUnits:String(totals.claimed),toppedUpUnits:String(totals.topped_up),returnedUnits:String(totals.returned),ok:errors.length===0,errors,checkedAt:new Date().toISOString()};
 },
 async attempts(){return db.transaction(async c=>{
  const rows=(await c.query("SELECT payload FROM pool_attempts WHERE contract_id=$1 ORDER BY payload->>'createdAt' DESC LIMIT 100",[poolId()])).rows;
  const approvals=(await c.query("SELECT a.* FROM pool_signature_approvals a JOIN pool_attempts p ON p.id=a.attempt_id WHERE p.contract_id=$1 ORDER BY a.created_at,a.signer_wallet",[poolId()])).rows;
  return rows.map(r=>poolAttemptSchema.parse({...r.payload,signatureApprovals:approvals.filter(a=>a.attempt_id===r.payload.id).map(a=>({signerWallet:a.signer_wallet,actor:a.actor,actorName:a.actor_name,createdAt:new Date(a.created_at).toISOString()}))}));
 })},
 async cycle(){if(!env.EARNINGS_POOL_CONTRACT_ID)return;
  await db.transaction(async c=>{const lock=(await c.query("SELECT pg_try_advisory_xact_lock(hashtext('music-city-pool-worker')) AS acquired")).rows[0];if(!lock.acquired)return;
   const pending=(await c.query("SELECT id,payload FROM pool_attempts WHERE status IN ('awaiting_signatures','submitting','submitted') ORDER BY checked_at NULLS FIRST LIMIT 20")).rows;
   for(const row of pending){try{const a=await this.reconcile(row.id);if(["submitting","submitted"].includes(a.status))await this.submit(a.id,a.actor,a.kind!=="claim");}catch(error){logger.error("Pool transaction reconciliation needs attention",{attemptId:row.id,error:error instanceof Error?error.message:String(error)});}}
   await this.syncEvents();
  });
 },
};
