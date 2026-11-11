import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile,writeFile} from "node:fs/promises";
import {Account,Asset,BASE_FEE,Keypair,Networks,Operation,TransactionBuilder,Transaction} from "@stellar/stellar-sdk";
import {Api,Server} from "@stellar/stellar-sdk/rpc";
import {userProfileSchema,type FinancialAttempt} from "@music-city/shared";
import {env} from "../config/env.js";
import {databaseService as db} from "../services/database.service.js";
import {agreementsService as agreements} from "../modules/agreements/agreements.service.js";
import {contributorChain} from "../modules/agreements/contributor-chain.js";
import {paymentsService as payments} from "../modules/payments/payments.service.js";
import {checkoutService as checkout} from "../modules/payments/checkout.service.js";
import {royaltiesService as royalties} from "../modules/royalties/royalties.service.js";
import {settlementService as settlements} from "../modules/settlements/settlement.service.js";
import {indexSettlementEvents} from "../modules/settlements/chain-events.js";
assert.equal(env.AGREEMENT_PUBLICATION_MODE,"contributors");assert.equal(env.STELLAR_NETWORK_PASSPHRASE,Networks.TESTNET);assert(new URL(env.DATABASE_URL).pathname.endsWith("_test"));
const path=process.env.CONTRIBUTOR_VERIFICATION_STATE;assert(path&&!path.startsWith(process.cwd()),"Use private resumable state outside the repository");
const deploy=JSON.parse(await readFile(process.env.CONTRIBUTOR_REHEARSAL_STATE!,"utf8"));
const treasuryKeys=deploy.secrets.slice(0,3).map((s:string)=>Keypair.fromSecret(s));
type State={secrets:string[];ids:string[];transactions:Record<string,{xdr:string;hash:string}>;agreementId?:string;challengeIds?:Record<string,string>;intentId?:string;checkoutId?:string;batchId?:string;evidence:Record<string,unknown>};
let state:State;try{state=JSON.parse(await readFile(path!,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;state={secrets:Array.from({length:3},()=>Keypair.random().secret()),ids:Array.from({length:5},()=>randomUUID()),transactions:{},evidence:{}};}
async function save(){await writeFile(path!,JSON.stringify(state,null,2),{mode:0o600});}
await save();
const [owner,partner,buyer]=state.secrets.map(s=>Keypair.fromSecret(s)) as [Keypair,Keypair,Keypair];
const [ownerId,partnerId,buyerId,trackId,releaseId]=state.ids as [string,string,string,string,string];
const rpc=new Server(env.STELLAR_SOROBAN_RPC_URL,{timeout:20000}),asset=new Asset("USDC",env.STELLAR_SETTLEMENT_ASSET_ISSUER);
async function wait(hash:string){for(let i=0;i<40;i++){const result=await rpc.getTransaction(hash);if(result.status===Api.GetTransactionStatus.SUCCESS)return result;if(result.status===Api.GetTransactionStatus.FAILED)throw new Error(`Testnet transaction failed ${hash}`);await new Promise(r=>setTimeout(r,1000));}throw new Error(`Outcome pending ${hash}; resume original state`);}
function sign(xdr:string,key:Keypair){const tx=TransactionBuilder.fromXDR(xdr,Networks.TESTNET);tx.sign(key);return tx.toXDR();}
async function classic(name:string,key:Keypair,operations:Parameters<TransactionBuilder["addOperation"]>[0][]){let saved=state.transactions[name];if(!saved){let b=new TransactionBuilder(await rpc.getAccount(key.publicKey()),{fee:BASE_FEE,networkPassphrase:Networks.TESTNET});for(const op of operations)b=b.addOperation(op);const tx=b.setTimeout(600).build();tx.sign(key);saved={xdr:tx.toXDR(),hash:tx.hash().toString("hex")};state.transactions[name]=saved;await save();}const existing=await rpc.getTransaction(saved.hash);if(existing.status===Api.GetTransactionStatus.NOT_FOUND){const sent=await rpc.sendTransaction(TransactionBuilder.fromXDR(saved.xdr,Networks.TESTNET));assert.notEqual(sent.status,"ERROR");}const receipt=await wait(saved.hash);state.evidence[name]={hash:saved.hash,ledger:receipt.ledger};await save();}
async function respond(key:Keypair,action:"accept"|"reject"|"dispute",label:string){
 const id=state.agreementId!;const current=(await agreements.get(id,key.publicKey())).versions.at(-1)!;
 if(current.responses.some(r=>r.walletAddress===key.publicKey()&&r.action===action))return;
 state.challengeIds??={};
 let challengeId=state.challengeIds[label];
 if(!challengeId){const challenge=await agreements.challenge(id,key.publicKey(),{action,reason:action==="accept"?"":"Verification case"});challengeId=challenge.id;state.challengeIds[label]=challengeId;state.transactions[label]={xdr:sign(challenge.transaction,key),hash:TransactionBuilder.fromXDR(challenge.transaction,Networks.TESTNET).hash().toString("hex")};await save();}
 await agreements.respond(id,key.publicKey(),{challengeId,signedTransaction:state.transactions[label]!.xdr});
 await wait(state.transactions[label]!.hash);await contributorChain.reconcile(challengeId);state.evidence[label]={hash:state.transactions[label]!.hash};await save();
}
async function finish(attempt:FinancialAttempt){for(let i=0;i<30;i++){const a=await settlements.reconcile(attempt.id);if(a.status==="confirmed")return a;if(["failed","expired"].includes(a.status))throw new Error(`Financial attempt ${a.status}`);await new Promise(r=>setTimeout(r,1000));}throw new Error("Financial attempt pending; resume state");}
try{
 await db.initialize({repair:false});
 for(const key of [owner,partner,buyer]){const response=await fetch(`${env.STELLAR_HORIZON_URL}/accounts/${key.publicKey()}`,{signal:AbortSignal.timeout(15000)});if(response.status===404){const f=await fetch(`https://friendbot.stellar.org?addr=${key.publicKey()}`,{signal:AbortSignal.timeout(30000)});assert(f.ok);}else assert(response.ok);await classic(`trustline-${key.publicKey()}`,key,[Operation.changeTrust({asset})]);}
 if(!state.transactions.buyerUSDC){const url=new URL(`${env.STELLAR_HORIZON_URL}/paths/strict-receive`);url.search=new URLSearchParams({source_assets:"native",destination_asset_type:"credit_alphanum4",destination_asset_code:"USDC",destination_asset_issuer:asset.getIssuer(),destination_amount:"20"}).toString();const result=await (await fetch(url)).json() as {_embedded:{records:{path:unknown[];source_amount:string}[]}};const route=result._embedded.records.find(r=>r.path.length===0);assert(route,"Testnet USDC route unavailable");await classic("buyerUSDC",buyer,[Operation.pathPaymentStrictReceive({sendAsset:Asset.native(),sendMax:(Math.ceil(Number(route.source_amount)*1.1*1e7)/1e7).toFixed(7),destination:buyer.publicKey(),destAsset:asset,destAmount:"20",path:[]})]);}
 await db.transaction(async client=>{
  const stamp=new Date().toISOString();
  for(const [key,id,name] of [[owner,ownerId,"Verification artist"],[partner,partnerId,"Verification producer"],[buyer,buyerId,"Verification buyer"]] as const){const p=userProfileSchema.parse({id,walletAddress:key.publicKey(),displayName:name,primaryIntent:"artist",artistAccess:true,onboardingStatus:"complete",onboardingStep:"complete",onboardingVersion:1,notificationPreferences:{},socialLinks:{},createdAt:stamp,updatedAt:stamp});await client.query("INSERT INTO users(id,wallet_address,primary_intent,onboarding_status,onboarding_step,payload) VALUES($1,$2,'artist','complete','complete',$3) ON CONFLICT(id) DO NOTHING",[id,key.publicKey(),p]);}
  if((await client.query("SELECT 1 FROM tracks WHERE id=$1",[trackId])).rowCount)return;
  const original=(await client.query("SELECT * FROM tracks WHERE id='trk_da757bca79134a44'")).rows[0];
  const release=(await client.query("SELECT r.* FROM releases r JOIN release_tracks rt ON rt.release_id=r.id WHERE rt.track_id=$1",[original.id])).rows[0];
  const replace=(v:unknown):unknown=>typeof v==="string"?v===original.id?trackId:v===release.id?releaseId:v===original.artist_id?ownerId:v:Array.isArray(v)?v.map(replace):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,replace(x)])):v;
  const track={...(replace(original.payload) as object),id:trackId,artistId:ownerId,artistName:"Verification artist",title:"Contributor payout verification",purchaseEnabled:true,purchasePrice:"3.0000000",purchaseAssetCode:"USDC",purchaseAssetIssuer:asset.getIssuer()};
  const rel={...(replace(release.payload) as object),id:releaseId,artistId:ownerId,artistName:"Verification artist",title:"Contributor payout verification"};
  await client.query("INSERT INTO tracks(id,artist_id,status,visibility,media_provider,payload) VALUES($1,$2,$3,$4,$5,$6)",[trackId,ownerId,original.status,original.visibility,original.media_provider,track]);
  await client.query("INSERT INTO releases(id,artist_id,type,status,release_date,payload) VALUES($1,$2,$3,$4,$5,$6)",[releaseId,ownerId,release.type,release.status,release.release_date,rel]);await client.query("INSERT INTO release_tracks(release_id,track_id,track_number,disc_number,is_focus_track) VALUES($1,$2,1,1,false)",[releaseId,trackId]);
 });
 if(!state.agreementId){const v=await agreements.create(owner.publicKey(),{trackId,submitForApproval:true,recipients:[{walletAddress:owner.publicKey(),role:"artist",shareBps:7000},{walletAddress:partner.publicKey(),role:"producer",shareBps:3000}],terms:"Synthetic Testnet verification only"});state.agreementId=v.proposal.agreementId;await save();}
 await respond(owner,"accept","ownerConsent");
 if ((await agreements.get(state.agreementId!,owner.publicKey())).versions.at(-1)!.state !== "finalized") await assert.rejects(payments.createTrackPurchaseIntent(buyer.publicKey(),trackId),/confirmed royalty agreement/);
 await respond(partner,"accept","partnerConsent");
 assert.equal((await agreements.get(state.agreementId,owner.publicKey())).versions.at(-1)!.state,"finalized");
 console.log("Contributor approvals finalized on Testnet without a treasury signature");
 if(!state.intentId){const intent=await payments.createTrackPurchaseIntent(buyer.publicKey(),trackId);state.intentId=intent.id;await save();}
 let checkoutAttempt=state.checkoutId?await checkout.get(buyer.publicKey(),state.checkoutId):await checkout.prepare(buyer.publicKey(),state.intentId);state.checkoutId=checkoutAttempt.id;await save();
 if(checkoutAttempt.status==="prepared")await checkout.authorize(buyer.publicKey(),checkoutAttempt.id,sign(checkoutAttempt.transaction,buyer));
 await checkout.submit(buyer.publicKey(),checkoutAttempt.id);await wait(checkoutAttempt.transactionHash);checkoutAttempt=await checkout.get(buyer.publicKey(),checkoutAttempt.id);assert.equal(checkoutAttempt.status,"confirmed");
 await payments.confirm(buyer.publicKey(),{intentId:state.intentId,txHash:checkoutAttempt.transactionHash});
 const entries=await royalties.listTrackLedgerEntries(trackId);assert.equal(entries.length,2);assert.deepEqual(entries.map(e=>e.netAmount).sort(),["0.9000000","2.1000000"]);const pendingEntries=entries.filter(e=>e.status==="pending");if(pendingEntries.length)await royalties.approveLedgerEntries({entryIds:pendingEntries.map(e=>e.id)});
 state.evidence.purchase={hash:checkoutAttempt.transactionHash,ledger:checkoutAttempt.ledger,gross:"3",claims:entries.map(e=>({wallet:e.recipientWalletAddress,net:e.netAmount,fee:e.feeAmount??"0"}))};await save();
 if(!state.batchId){const input={trackId,sourceType:entries[0]!.sourceType,sourceId:entries[0]!.sourceId,expiresAt:new Date(Math.floor((Date.now()+3600000)/1000)*1000).toISOString()};const preview=await settlements.preview(input);const reserved=await settlements.reserve(input,preview.id,"verification:admin");state.batchId=reserved.id;await save();}
 let funding=await settlements.prepare(state.batchId,"settle","verification:admin");
 if(funding.status==="awaiting_signatures"){
  await settlements.addSignature(funding.id,"verification:admin",{signedTransaction:sign(funding.transaction,treasuryKeys[0]!)},true);
  await assert.rejects(settlements.submit(funding.id,"verification:admin",true));
  await settlements.addSignature(funding.id,"verification:admin",{signedTransaction:sign(funding.transaction,treasuryKeys[1]!)},true);
  funding=await settlements.submit(funding.id,"verification:admin",true);
 }
 funding=await finish(funding);state.evidence.funding={hash:funding.transactionHash,ledger:funding.ledger,signedBy:funding.signedBy};await save();
 await indexSettlementEvents();await settlements.reconcileBatch(state.batchId);
 const batch=(await settlements.detail(state.batchId)).batch;
 for(const key of [owner,partner]){
  const index=batch.allocations.findIndex(a=>a.beneficiary===key.publicKey());let claim=await settlements.prepare(batch.id,"claim",key.publicKey(),index);
  if(claim.status==="awaiting_signatures"){await settlements.addSignature(claim.id,key.publicKey(),{signedTransaction:sign(claim.transaction,key)});claim=await settlements.submit(claim.id,key.publicKey());}
  claim=await finish(claim);state.evidence[`claim-${index}`]={hash:claim.transactionHash,ledger:claim.ledger,signedBy:claim.signedBy};await save();
 }
 await indexSettlementEvents();await settlements.reconcileBatch(batch.id);const final=(await settlements.detail(batch.id)).batch;assert.equal(final.state,"closed");assert(final.allocations.every(a=>a.status==="claimed"));

 // Separate future agreement versions demonstrate blocking and removed-holder consent.
 let current=(await agreements.get(state.agreementId!,owner.publicKey())).versions.at(-1)!;
 const solo={recipients:[{walletAddress:owner.publicKey(),role:"artist" as const,shareBps:10000}],terms:"Synthetic future earnings amendment"};
 if(current.proposal.version===1)current=await agreements.revise(state.agreementId!,owner.publicKey(),{...solo,resolution:"Verify rejection"},current.proposal.version,current.proposalHash);
 if(current.proposal.version===2){
   if(current.state==="draft")await agreements.submit(state.agreementId!,owner.publicKey(),2,current.proposalHash);
   if(!["rejected","disputed"].includes(current.state)){await respond(owner,"accept","rejectedOwner");await respond(partner,"reject","partnerRejection");}
   current=(await agreements.get(state.agreementId!,owner.publicKey())).versions.at(-1)!;assert.equal(current.state,"rejected");state.evidence.rejection={version:2,state:current.state};await save();
   current=await agreements.revise(state.agreementId!,owner.publicKey(),{...solo,resolution:"Verify dispute"},current.proposal.version,current.proposalHash);
 }
 if(current.proposal.version===3){
   if(current.state==="draft")await agreements.submit(state.agreementId!,owner.publicKey(),3,current.proposalHash);
   if(current.state!=="disputed"){await respond(owner,"accept","disputedOwner");await respond(partner,"dispute","partnerDispute");}
   current=(await agreements.get(state.agreementId!,owner.publicKey())).versions.at(-1)!;assert.equal(current.state,"disputed");state.evidence.dispute={version:3,state:current.state};await save();
   current=await agreements.revise(state.agreementId!,owner.publicKey(),{...solo,resolution:"Fresh consent from removed rights holder"},current.proposal.version,current.proposalHash);
 }
 if(current.proposal.version===4){
   if(current.state==="draft")await agreements.submit(state.agreementId!,owner.publicKey(),4,current.proposalHash);
   if(current.state!=="finalized"){
     await respond(owner,"accept","amendmentOwner");
     current=(await agreements.get(state.agreementId!,owner.publicKey())).versions.at(-1)!;
     assert.equal(current.state,"proposed");assert(current.requiredApprovers?.includes(partner.publicKey()));
     await respond(partner,"accept","removedPartnerConsent");
   }
   current=(await agreements.get(state.agreementId!,owner.publicKey())).versions.at(-1)!;assert.equal(current.state,"finalized");state.evidence.amendment={version:4,state:current.state,requiredApprovers:current.requiredApprovers,recipients:current.proposal.recipients,transactionHash:current.publication?.transactionHash};
 }
 const {finalizedSplitsRepository}=await import("../modules/agreements/effective-split.js");
 const history=await finalizedSplitsRepository.list(trackId);assert(history.some(s=>s.version===1));assert(history.some(s=>s.version===4));
 const preserved=(await settlements.detail(batch.id)).batch;assert.equal(preserved.version,1);assert.equal(preserved.state,"closed");
 console.log("Rejection, dispute, removed-contributor consent and immutable earlier payouts verified on Testnet");
 state.evidence.finalBatch={id:final.id,state:final.state,fundedUnits:final.fundedUnits,allocations:final.allocations};state.evidence.reconciliation=await settlements.refreshReconciliation();state.evidence.verificationKind="Generated-key service journey on real Stellar Testnet. Dynamic browser verification is separate.";await save();await writeFile(path+".public.json",JSON.stringify(state.evidence,null,2));console.log("Purchase, two-signature funding, both beneficiary claims and closed reconciliation passed");
}finally{await db.close();}
