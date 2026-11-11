import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {Asset,BASE_FEE,Keypair,Networks,Operation,TransactionBuilder} from "@stellar/stellar-sdk";
import {Api,Server} from "@stellar/stellar-sdk/rpc";
import {env} from "../config/env.js";
import {databaseService as db} from "../services/database.service.js";
import {finalizedSplitsRepository} from "../modules/agreements/effective-split.js";
import {royaltiesRepository} from "../modules/royalties/royalties.repository.js";
import {settlementService as settlements} from "../modules/settlements/settlement.service.js";
import {indexSettlementEvents} from "../modules/settlements/chain-events.js";
import type {FinancialAttempt} from "@music-city/shared";
assert.equal(env.STELLAR_NETWORK_PASSPHRASE,Networks.TESTNET);
assert.equal(new URL(env.DATABASE_URL).pathname,"/music_city_contributor_rehearsal_test");
const path=process.env.PAYOUT_RUN_VERIFICATION_STATE;
assert(path&&!resolve(path).startsWith(resolve(import.meta.dirname,"../../..")+"/"));
const original=JSON.parse(await readFile(process.env.CONTRIBUTOR_VERIFICATION_STATE!,"utf8"));
const deploy=JSON.parse(await readFile(process.env.CONTRIBUTOR_REHEARSAL_STATE!,"utf8"));
const [owner,partner,buyer]=original.secrets.map((s:string)=>Keypair.fromSecret(s)) as [Keypair,Keypair,Keypair];
const signers=deploy.secrets.slice(0,2).map((s:string)=>Keypair.fromSecret(s));
assert.equal(deploy.contractId,env.SETTLEMENT_CONTRACT_ID);
assert.equal(signers[0]!.publicKey(),env.AGREEMENT_TREASURY_ADDRESS);
const trackId=original.ids[3] as string;
type State={sourceIds:string[];ledgerIds:string[][];expiresAt:string;transactions:Record<string,{xdr:string;hash:string}>;runId?:string;evidence:Record<string,unknown>};
let state:State;try{state=JSON.parse(await readFile(path,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;state={sourceIds:[randomUUID(),randomUUID()],ledgerIds:[[randomUUID(),randomUUID()],[randomUUID()]],expiresAt:new Date(Math.floor((Date.now()+86400000)/1000)*1000).toISOString(),transactions:{},evidence:{}};}
async function save(){await writeFile(path!,JSON.stringify(state,null,2),{mode:0o600});}await save();
const rpc=new Server(env.STELLAR_SOROBAN_RPC_URL,{timeout:20000});
function sign(xdr:string,key:Keypair){const tx=TransactionBuilder.fromXDR(xdr,Networks.TESTNET);tx.sign(key);return tx.toXDR();}
async function wait(hash:string){for(let i=0;i<40;i++){const r=await rpc.getTransaction(hash);if(r.status===Api.GetTransactionStatus.SUCCESS)return r;assert.notEqual(r.status,Api.GetTransactionStatus.FAILED);await new Promise(r=>setTimeout(r,1000));}throw Error(`Outcome pending ${hash}; resume the same state`);}
async function finish(a:FinancialAttempt){for(let i=0;i<35&&a.status!=="confirmed";i++){assert(!["failed","expired"].includes(a.status),a.status);await new Promise(r=>setTimeout(r,1000));a=await settlements.reconcile(a.id);}assert.equal(a.status,"confirmed");return a;}
try {
 await db.initialize({repair:false});
 let deposit=state.transactions.deposit;
 if(!deposit){const tx=new TransactionBuilder(await rpc.getAccount(buyer.publicKey()),{fee:BASE_FEE,networkPassphrase:Networks.TESTNET}).addOperation(Operation.payment({destination:signers[0]!.publicKey(),asset:new Asset("USDC",env.STELLAR_SETTLEMENT_ASSET_ISSUER),amount:"0.0200000"})).setTimeout(600).build();tx.sign(buyer);deposit={xdr:tx.toXDR(),hash:tx.hash().toString("hex")};state.transactions.deposit=deposit;await save();}
 if((await rpc.getTransaction(deposit.hash)).status===Api.GetTransactionStatus.NOT_FOUND){const r=await rpc.sendTransaction(TransactionBuilder.fromXDR(deposit.xdr,Networks.TESTNET));assert.notEqual(r.status,"ERROR");}await wait(deposit.hash);
 const splits=await finalizedSplitsRepository.list(trackId);
 for(const [i,version,feeBps] of [[0,1,500],[1,4,0]] as const) {
  const split=splits.find(s=>s.version===version);assert(split);
  for(const [j,recipient] of split.recipients.entries()){
   const gross=100000n*BigInt(recipient.shareBps)/10000n;const fee=gross*BigInt(feeBps)/10000n;
   const amount=(n:bigint)=>`0.${n.toString().padStart(7,"0")}`;
   const id=state.ledgerIds[i]![j]!;
   const exists=await db.transaction(async c=>(await c.query("SELECT 1 FROM royalty_ledger WHERE id=$1",[id])).rowCount);
   if(exists && !state.runId) await db.transaction(c=>c.query("UPDATE royalty_ledger SET payload=(payload-'feeAmount') || $2::jsonb WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM settlement_reservations r WHERE r.ledger_id=royalty_ledger.id)",[id,JSON.stringify({grossAmount:amount(gross),netAmount:amount(gross-fee),...(fee>0n?{feeAmount:amount(fee)}:{})})]));
   if(!exists)await royaltiesRepository.upsertLedgerEntry({id,trackId,splitId:split.id,sourceType:"manual_adjustment",sourceId:state.sourceIds[i]!,recipientWalletAddress:recipient.walletAddress,recipientRole:recipient.role,recipientChain:"stellar",status:"approved",grossAmount:amount(gross),netAmount:amount(gross-fee),...(fee>0n?{feeAmount:amount(fee)}:{}),feeBps,assetCode:"USDC",assetIssuer:env.STELLAR_SETTLEMENT_ASSET_ISSUER,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  }
 }
 const input={sources:state.sourceIds.map(sourceId=>({trackId,sourceType:"manual_adjustment",sourceId})),expiresAt:state.expiresAt};
 if(!state.runId){const preview=await settlements.previewRun(input);assert.equal(preview.fundedUnits,"195000");const run=await settlements.reserveRun(input,preview.id,"verification:payout-run");state.runId=run.id;await save();}
 const run=(await settlements.listRuns()).find(r=>r.id===state.runId);assert(run);
 let a=await settlements.prepareRun(run.id,"verification:payout-run");
 assert.equal(a.fundingBatchIds?.length,2);
 if(a.status==="awaiting_signatures"){
  if(!a.signedBy.includes(signers[0]!.publicKey()))a=await settlements.addSignature(a.id,"verification:payout-run",{signedTransaction:sign(a.transaction,signers[0]!)},true);
  if(a.signedBy.length===1)await assert.rejects(settlements.submit(a.id,"verification:payout-run",true));
  if(!a.signedBy.includes(signers[1]!.publicKey()))a=await settlements.addSignature(a.id,"verification:payout-run",{signedTransaction:sign(a.transaction,signers[1]!)},true);
  a=await settlements.submit(a.id,"verification:payout-run",true);
 }
 a=await finish(a);state.evidence.funding={runId:run.id,batchIds:a.fundingBatchIds,hash:a.transactionHash,ledger:a.ledger,signedBy:a.signedBy,totalUnits:run.fundedUnits};await save();
 for(const batch of run.batches){await settlements.reconcileBatch(batch.id);assert.equal((await settlements.detail(batch.id)).batch.fundingHash,a.transactionHash);}
 assert.equal((await settlements.prepareRun(run.id,"verification:payout-run")).id,a.id);
 console.log("Two sources with different agreement versions and fees funded atomically with one pair of signatures");
 for(const batch of run.batches)for(const allocation of batch.allocations){const key=[owner,partner].find(k=>k.publicKey()===allocation.beneficiary)!;assert(key);let claim=await settlements.prepare(batch.id,"claim",key.publicKey(),allocation.index);
  if(claim.status==="awaiting_signatures"){await settlements.addSignature(claim.id,key.publicKey(),{signedTransaction:sign(claim.transaction,key)});claim=await settlements.submit(claim.id,key.publicKey());}
  claim=await finish(claim);state.evidence[`claim-${batch.id}-${allocation.index}`]={hash:claim.transactionHash,ledger:claim.ledger,amountUnits:allocation.amountUnits,signedBy:claim.signedBy};await save();
 }
 await indexSettlementEvents();for(const b of run.batches){await settlements.reconcileBatch(b.id);assert.equal((await settlements.detail(b.id)).batch.state,"closed");}
 const report=await settlements.refreshReconciliation();assert.equal(report.ok,true);
 state.evidence.reconciliation=report;state.evidence.verificationKind="Real Testnet service verification with generated fixture keys and synthetic manual earnings. Existing personal-account claims remain separate.";await save();await writeFile(path+".public.json",JSON.stringify(state.evidence,null,2));console.log(JSON.stringify(state.evidence));
} finally {await db.close();}
