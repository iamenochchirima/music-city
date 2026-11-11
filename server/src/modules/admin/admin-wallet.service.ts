import {randomUUID,randomBytes,createHash,timingSafeEqual} from "node:crypto";
import {Account,TransactionBuilder,Operation,Memo,StrKey} from "@stellar/stellar-sdk";
import type {PoolClient} from "pg";
import {databaseService as db} from "../../services/database.service.js";
import {env} from "../../config/env.js";
import {HttpError} from "../../utils/http-error.js";
import {poolChain} from "../pool/pool-chain.js";
import {poolService} from "../pool/pool.service.js";
import {poolAttemptSchema} from "@music-city/shared";
import {verifyAdminWalletProof} from "./admin-wallet-proof.js";
const hash=(s:string)=>createHash("sha256").update(s).digest();
type RequestRow={id:string;admin_id:string;kind:"link"|"sign";attempt_id:string|null;token_hash:string;network_passphrase:string;expires_at:Date;wallet_address:string|null;transaction:string|null;signed_transaction:string|null;status:string};
async function request(c:PoolClient,id:string){const r=(await c.query<RequestRow>("SELECT * FROM admin_wallet_requests WHERE id=$1 FOR UPDATE",[id])).rows[0];if(!r)throw new HttpError(404,"Wallet request not found");return r;}
function live(r:RequestRow){if(Date.parse(String(r.expires_at))<=Date.now())throw new HttpError(409,"Wallet request expired. Start again from the admin page");if(r.network_passphrase!==env.STELLAR_NETWORK_PASSPHRASE)throw new HttpError(409,"Wallet request network changed");if(r.status==="cancelled")throw new HttpError(409,"Wallet request was cancelled");}
function capability(r:RequestRow,token:string){if(!token||!timingSafeEqual(hash(token),Buffer.from(r.token_hash,"hex")))throw new HttpError(403,"Invalid wallet request token");live(r);}
async function link(c:PoolClient,adminId:string){return (await c.query("SELECT * FROM admin_wallet_links WHERE admin_id=$1",[adminId])).rows[0] as {wallet_address:string;network_passphrase:string}|undefined;}
export const adminWalletService={
 async status(adminId:string){const current=await db.transaction(c=>link(c,adminId));let signers:string[]=[];if(current){if(current.network_passphrase!==env.STELLAR_NETWORK_PASSPHRASE)throw new HttpError(409,"Restore the linked wallet's network");signers=await poolChain.signers();}return {walletAddress:current?.wallet_address??null,eligible:!!current&&signers.includes(current.wallet_address),networkPassphrase:env.STELLAR_NETWORK_PASSPHRASE};},
 async create(adminId:string,input:{kind:"link"|"sign";attemptId?:string}){
  const token=randomBytes(32).toString("hex"),id=randomUUID();
  return db.transaction(async c=>{
   await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`admin-wallet:${adminId}`]);
   const account=(await c.query("SELECT payload FROM admins WHERE id=$1",[adminId])).rows[0]?.payload;if(!account||account.role!=="super_admin")throw new HttpError(403,"Treasury wallet actions require a super admin");
   const current=await link(c,adminId);let transaction:string|null=null,wallet:string|null=null,expires=new Date(Date.now()+600000);
   if(input.kind==="link"&&current)throw new HttpError(409,"This admin already has a linked wallet. Wallet replacement requires reviewed recovery");
   if(input.kind==="sign"){
    if(!current)throw new HttpError(409,"Connect and link your wallet before signing");if(current.network_passphrase!==env.STELLAR_NETWORK_PASSPHRASE)throw new HttpError(409,"Linked wallet network changed");
    const raw=(await c.query("SELECT payload FROM pool_attempts WHERE id=$1",[input.attemptId])).rows[0]?.payload;if(!raw)throw new HttpError(404,"Pool transaction not found");const a=poolAttemptSchema.parse(raw);
    if(a.kind==="claim"||a.status!=="awaiting_signatures")throw new HttpError(409,"This transaction is not collecting treasury signatures");
    if(!(await poolChain.signers()).includes(current.wallet_address)||!a.signers.includes(current.wallet_address))throw new HttpError(403,"Your linked wallet must be authorized in the current treasury signer set");
    if(a.signedBy.includes(current.wallet_address))throw new HttpError(409,"Your wallet has already signed this transaction");
    transaction=a.transaction;wallet=current.wallet_address;expires=new Date(Math.min(expires.getTime(),Date.parse(a.expiresAt)));
   }
   if(expires.getTime()<=Date.now())throw new HttpError(409,"Reconcile the expired transaction and prepare a new one");
   await c.query("UPDATE admin_wallet_requests SET status='cancelled' WHERE admin_id=$1 AND status IN ('pending','challenged','signed')",[adminId]);
   await c.query("INSERT INTO admin_wallet_requests(id,admin_id,kind,attempt_id,token_hash,network_passphrase,expires_at,wallet_address,transaction,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[id,adminId,input.kind,input.attemptId??null,hash(token).toString("hex"),env.STELLAR_NETWORK_PASSPHRASE,expires,wallet,transaction,input.kind==="sign"?"challenged":"pending"]);
   return {id,token,expiresAt:expires.toISOString()};
  });
 },
 async publicView(id:string,token:string){return db.transaction(async c=>{const r=await request(c,id);capability(r,token);const admin=(await c.query("SELECT payload FROM admins WHERE id=$1",[r.admin_id])).rows[0].payload;
  let summary:string;if(r.kind==="link")summary=`Link this wallet to ${admin.email}. This proof is not a payment and will not be submitted to Stellar.`;
  else {const a=poolAttemptSchema.parse((await c.query("SELECT payload FROM pool_attempts WHERE id=$1",[r.attempt_id])).rows[0].payload);summary=`${a.poolAction==="top_up"?"Top up pool":"Return unused liquidity"}: ${BigInt(a.amountUnits)/10000000n}.${(BigInt(a.amountUnits)%10000000n).toString().padStart(7,"0")} USDC. Treasury ${a.treasuryAddress}. Transaction ${a.transactionHash}.`;}
  return {id:r.id,kind:r.kind,adminName:admin.name,adminEmail:admin.email,walletAddress:r.wallet_address,transaction:r.transaction,networkPassphrase:r.network_passphrase,expiresAt:r.expires_at,status:r.status,summary};
 });},
 async challenge(id:string,token:string,wallet:string){if(!StrKey.isValidEd25519PublicKey(wallet))throw new HttpError(400,"Choose a Stellar wallet");return db.transaction(async c=>{
  const r=await request(c,id);capability(r,token);if(r.status==="completed")throw new HttpError(409,"Wallet request is already complete");
  if(r.kind==="sign"){if(wallet!==r.wallet_address)throw new HttpError(403,"Choose the wallet linked to this admin account");return {transaction:r.transaction!,networkPassphrase:r.network_passphrase};}
  if(r.wallet_address){if(r.wallet_address!==wallet)throw new HttpError(409,"This challenge is bound to a different wallet. Start again from the admin page");return {transaction:r.transaction!,networkPassphrase:r.network_passphrase};}
  if(!(await poolChain.signers()).includes(wallet))throw new HttpError(403,"Connect your authorized treasury wallet. Linking cannot grant treasury signing permission");
  const claimed=(await c.query("SELECT admin_id FROM admin_wallet_links WHERE wallet_address=$1",[wallet])).rows[0];if(claimed)throw new HttpError(409,"This wallet is already linked to a different admin account");
  const context=hash(JSON.stringify({purpose:"music-city-admin-wallet-link",request:r.id,adminId:r.admin_id,origin:env.ADMIN_CLIENT_ORIGIN,wallet,network:r.network_passphrase,expires:r.expires_at,nonce:r.token_hash}));
  const tx=new TransactionBuilder(new Account(wallet,"0"),{fee:"100",networkPassphrase:r.network_passphrase}).addOperation(Operation.manageData({name:"music-city-admin-link",value:context})).addMemo(Memo.hash(context)).setTimebounds(0,Math.floor(new Date(r.expires_at).getTime()/1000)).build();
  await c.query("UPDATE admin_wallet_requests SET wallet_address=$2,transaction=$3,status='challenged' WHERE id=$1",[id,wallet,tx.toXDR()]);return {transaction:tx.toXDR(),networkPassphrase:r.network_passphrase};
 });},
 async signed(id:string,token:string,signedTransaction:string){return db.transaction(async c=>{const r=await request(c,id);capability(r,token);if(!r.transaction||!r.wallet_address)throw new HttpError(409,"Choose a wallet first");
  verifyAdminWalletProof(r.transaction,signedTransaction,r.wallet_address,r.network_passphrase);
  if(r.signed_transaction&&r.signed_transaction!==signedTransaction)throw new HttpError(409,"This request already has a different signed response");
  if(!["completed","signed"].includes(r.status))await c.query("UPDATE admin_wallet_requests SET signed_transaction=$2,status='signed' WHERE id=$1",[id,signedTransaction]);return {status:r.status==="completed"?"completed":"signed"};
 });},
 async get(adminId:string,id:string){return db.transaction(async c=>{const r=await request(c,id);if(r.admin_id!==adminId)throw new HttpError(403,"This request belongs to a different admin");return {status:r.status,expiresAt:r.expires_at};});},
 async cancel(adminId:string,id:string){return db.transaction(async c=>{const r=await request(c,id);if(r.admin_id!==adminId)throw new HttpError(403,"This request belongs to a different admin");if(!["completed","cancelled"].includes(r.status))await c.query("UPDATE admin_wallet_requests SET status='cancelled' WHERE id=$1",[id]);return {status:r.status==="completed"?"completed":"cancelled"};});},
 async confirm(adminId:string,id:string){return db.transaction(async c=>{
  const r=await request(c,id);if(r.admin_id!==adminId)throw new HttpError(403,"This request belongs to a different admin");if(r.status==="completed")return {status:"completed"};live(r);if(r.status!=="signed"||!r.signed_transaction||!r.wallet_address||!r.transaction)throw new HttpError(409,"Complete the wallet signature first");
  verifyAdminWalletProof(r.transaction,r.signed_transaction,r.wallet_address,r.network_passphrase);
  if(r.kind==="link"){
   if(!(await poolChain.signers()).includes(r.wallet_address))throw new HttpError(403,"This wallet is no longer an authorized treasury signer");
   await c.query("SELECT pg_advisory_xact_lock(hashtext('music-city-admin-wallet-links'))");
   const current=await link(c,adminId);if(current&&current.wallet_address!==r.wallet_address)throw new HttpError(409,"This admin is already linked to another wallet");
   const taken=(await c.query("SELECT admin_id FROM admin_wallet_links WHERE wallet_address=$1",[r.wallet_address])).rows[0];if(taken&&taken.admin_id!==adminId)throw new HttpError(409,"This wallet is already linked to another admin");
   if(!current)await c.query("INSERT INTO admin_wallet_links(admin_id,wallet_address,network_passphrase,challenge_id) VALUES($1,$2,$3,$4)",[adminId,r.wallet_address,r.network_passphrase,id]);
  }else{
   const current=await link(c,adminId);if(current?.wallet_address!==r.wallet_address||!(await poolChain.signers()).includes(r.wallet_address))throw new HttpError(403,"Linked treasury signer changed");
   await poolService.addSignature(r.attempt_id!,`admin:${adminId}`,r.signed_transaction,true);
  }
  await c.query("UPDATE admin_wallet_requests SET status='completed',completed_at=NOW() WHERE id=$1",[id]);return {status:"completed"};
 });},
};
