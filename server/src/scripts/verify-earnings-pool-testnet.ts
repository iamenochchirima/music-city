import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {randomUUID} from "node:crypto";
import {Asset,BASE_FEE,Keypair,Networks,Operation,TransactionBuilder} from "@stellar/stellar-sdk";
import {Api,Server} from "@stellar/stellar-sdk/rpc";
import {userProfileSchema,type PoolAttempt} from "@music-city/shared";
import {env} from "../config/env.js";
import {databaseService as db} from "../services/database.service.js";
import {poolService} from "../modules/pool/pool.service.js";
import {paymentsService} from "../modules/payments/payments.service.js";
import {checkoutService} from "../modules/payments/checkout.service.js";
assert.equal(env.STELLAR_NETWORK_PASSPHRASE,Networks.TESTNET);assert.equal(env.EARNINGS_MODE,"pool");assert.equal(new URL(env.DATABASE_URL).pathname,"/music_city_contributor_rehearsal_test");
const file=process.env.EARNINGS_POOL_VERIFICATION_STATE;assert(file&&!resolve(file).startsWith(resolve(import.meta.dirname,"../../..")+"/"));
const old=JSON.parse(await readFile(process.env.CONTRIBUTOR_VERIFICATION_STATE!,"utf8")),deploy=JSON.parse(await readFile(process.env.CONTRIBUTOR_REHEARSAL_STATE!,"utf8"));
const signers=deploy.secrets.slice(0,2).map((s:string)=>Keypair.fromSecret(s)),owner=Keypair.fromSecret(old.secrets[0]),funder=Keypair.fromSecret(old.secrets[2]);
assert.equal(signers[0]!.publicKey(),env.AGREEMENT_TREASURY_ADDRESS);
const trackId=old.ids[3] as string;
type State={buyerSecret:string;buyerId:string;tx:Record<string,{xdr:string;hash:string}>;topUpId?:string;returnId?:string;readyBufferId?:string;intentId?:string;checkoutId?:string;evidence:Record<string,unknown>};
let state:State;try{state=JSON.parse(await readFile(file,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;state={buyerSecret:Keypair.random().secret(),buyerId:randomUUID(),tx:{},evidence:{}};}
const buyer=Keypair.fromSecret(state.buyerSecret),rpc=new Server(env.STELLAR_SOROBAN_RPC_URL,{timeout:20000});
async function save(){await writeFile(file!,JSON.stringify(state,null,2),{mode:0o600});}await save();
function sign(xdr:string,key:Keypair){const tx=TransactionBuilder.fromXDR(xdr,Networks.TESTNET);tx.sign(key);return tx.toXDR();}
async function wait(hash:string){for(let i=0;i<40;i++){const r=await rpc.getTransaction(hash);if(r.status===Api.GetTransactionStatus.SUCCESS)return r;assert.notEqual(r.status,Api.GetTransactionStatus.FAILED);await new Promise(r=>setTimeout(r,1000));}throw Error(`Resume retained transaction ${hash}`);}
async function classic(name:string,key:Keypair,operation:Parameters<TransactionBuilder["addOperation"]>[0]){let saved=state.tx[name];if(!saved){const tx=new TransactionBuilder(await rpc.getAccount(key.publicKey()),{fee:BASE_FEE,networkPassphrase:Networks.TESTNET}).addOperation(operation).setTimeout(600).build();tx.sign(key);saved={xdr:tx.toXDR(),hash:tx.hash().toString("hex")};state.tx[name]=saved;await save();}if((await rpc.getTransaction(saved.hash)).status===Api.GetTransactionStatus.NOT_FOUND){const r=await rpc.sendTransaction(TransactionBuilder.fromXDR(saved.xdr,Networks.TESTNET));assert.notEqual(r.status,"ERROR");}await wait(saved.hash);}
async function finish(a:PoolAttempt){for(let i=0;i<35&&a.status!=="confirmed";i++){assert(!["failed","expired"].includes(a.status),a.status);await new Promise(r=>setTimeout(r,1000));a=await poolService.reconcile(a.id);}assert.equal(a.status,"confirmed");return a;}
async function treasuryAction(action:"top_up"|"return_surplus",field:"topUpId"|"returnId"){
 let a=state[field]?(await poolService.attempts()).find(a=>a.id===state[field])!:await poolService.prepare("verification:pool-treasury",{action,amount:"1"});state[field]=a.id;await save();
 if(a.status==="awaiting_signatures"){
  if(!a.signedBy.includes(signers[0]!.publicKey()))a=await poolService.addSignature(a.id,a.actor,sign(a.transaction,signers[0]!),true);
  if(a.signedBy.length===1)await assert.rejects(poolService.submit(a.id,a.actor,true));
  if(!a.signedBy.includes(signers[1]!.publicKey()))a=await poolService.addSignature(a.id,a.actor,sign(a.transaction,signers[1]!),true);
  a=await poolService.submit(a.id,a.actor,true);
 }a=await finish(a);state.evidence[action]={hash:a.transactionHash,ledger:a.ledger,signers:a.signedBy};await save();return a;
}
try {
 await db.initialize({repair:false});
 const account=await fetch(`${env.STELLAR_HORIZON_URL}/accounts/${buyer.publicKey()}`);if(account.status===404){const f=await fetch(`https://friendbot.stellar.org?addr=${buyer.publicKey()}`);assert(f.ok);}else assert(account.ok);
 const asset=new Asset("USDC",env.STELLAR_SETTLEMENT_ASSET_ISSUER);
 await classic("buyer-trustline",buyer,Operation.changeTrust({asset}));
 await classic("fund-buyer",funder,Operation.payment({destination:buyer.publicKey(),asset,amount:"6"}));
 await classic("fund-treasury-buffer",funder,Operation.payment({destination:signers[0]!.publicKey(),asset,amount:"1"}));
 const stamp=new Date().toISOString(),profile=userProfileSchema.parse({id:state.buyerId,walletAddress:buyer.publicKey(),displayName:"Pool verification buyer",primaryIntent:"listener",artistAccess:false,onboardingStatus:"complete",onboardingStep:"complete",onboardingVersion:1,notificationPreferences:{},socialLinks:{},createdAt:stamp,updatedAt:stamp});
 await db.transaction(c=>c.query("INSERT INTO users(id,wallet_address,primary_intent,onboarding_status,onboarding_step,payload) VALUES($1,$2,'listener','complete','complete',$3) ON CONFLICT(id) DO NOTHING",[profile.id,profile.walletAddress,profile]));
 await treasuryAction("top_up","topUpId");await poolService.syncEvents();
 if(!state.intentId){const before=await poolService.report();assert.equal(before.outstandingUnits,"0");assert.equal(before.balanceUnits,"10000000");state.evidence.prefundedBeforePurchase=before;
  const intent=await paymentsService.createTrackPurchaseIntent(buyer.publicKey(),trackId);assert(intent.poolContractId&&intent.poolOrderId);state.intentId=intent.id;await save();}
 let checkout=state.checkoutId?await checkoutService.get(buyer.publicKey(),state.checkoutId):await checkoutService.prepare(buyer.publicKey(),state.intentId);state.checkoutId=checkout.id;await save();
 if(checkout.status==="prepared")await checkoutService.authorize(buyer.publicKey(),checkout.id,sign(checkout.transaction,buyer));
 await checkoutService.submit(buyer.publicKey(),checkout.id);await wait(checkout.transactionHash);checkout=await checkoutService.get(buyer.publicKey(),checkout.id);assert.equal(checkout.status,"confirmed");
 await paymentsService.confirm(buyer.publicKey(),{intentId:state.intentId,txHash:checkout.transactionHash});await poolService.syncEvents();
 const mine=await poolService.mine(owner.publicKey());const order=mine.orders.find(o=>o.id===checkout.poolOrderId);assert(order);assert.equal(order.grossUnits,"30000000");
 const legacy=await db.transaction(async c=>(await c.query("SELECT count(*)::int AS n FROM royalty_ledger WHERE source_id IN (SELECT id FROM payments WHERE intent_id=$1)",[state.intentId])).rows[0].n);assert.equal(legacy,0,"Pool purchases must bypass manual earnings approval and old payout funding");
 state.evidence.purchase={hash:checkout.transactionHash,ledger:checkout.ledger,orderId:order.id,claims:order.claims,legacyApprovalEntries:legacy,registrationAuthorization:"buyer only, atomic with payment"};await save();
 console.log("Prefunded before buying; buyer payment automatically registered earnings without admin approval");
 const index=order.claims.findIndex(c=>c.beneficiary===owner.publicKey());assert(index>=0);
 if(!order.claims[index]!.claimed){
  await assert.rejects(poolService.prepare(buyer.publicKey(),{action:"claim",orderId:order.id,index}),/another wallet/);
  let claim=await poolService.prepare(owner.publicKey(),{action:"claim",orderId:order.id,index});
  if(claim.status==="awaiting_signatures"){await poolService.addSignature(claim.id,owner.publicKey(),sign(claim.transaction,owner));claim=await poolService.submit(claim.id,owner.publicKey());}
  claim=await finish(claim);state.evidence.claim={hash:claim.transactionHash,ledger:claim.ledger,signedBy:claim.signedBy};await save();
 }
 await poolService.syncEvents();
 if(!state.returnId) {const r=await poolService.report();assert.equal(r.outstandingUnits,"0");assert.equal(r.balanceUnits,"10000000");}
 await treasuryAction("return_surplus","returnId");await poolService.syncEvents();const report=await poolService.report();assert.equal(report.ok,true);assert.equal(report.balanceUnits,state.readyBufferId?"10000000":"0");assert.equal(report.outstandingUnits,"0");
 const retry=await checkoutService.get(buyer.publicKey(),checkout.id);assert.equal(retry.transactionHash,checkout.transactionHash);
 await assert.rejects(db.transaction(c=>c.query("UPDATE pool_orders SET payload=jsonb_set(payload,'{grossUnits}','\"1\"') WHERE id=$1",[order.id])),/immutable/);
 state.evidence.reconciliation=report;state.evidence.kind="Generated-key service journey on real Stellar Testnet. No real-account signing or live browser claim is implied.";await save();await writeFile(file+".public.json",JSON.stringify(state.evidence,null,2));console.log(JSON.stringify(state.evidence));
}finally{await db.close();}
