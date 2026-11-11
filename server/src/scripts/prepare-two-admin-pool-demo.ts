import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,join} from "node:path";
import {Asset,BASE_FEE,Keypair,Networks,Operation,TransactionBuilder} from "@stellar/stellar-sdk";
import {Api,Server} from "@stellar/stellar-sdk/rpc";
import {env} from "../config/env.js";
import {databaseService as db} from "../services/database.service.js";
import {adminService} from "../modules/admin/admin.service.js";
import {passwordService} from "../services/password.service.js";
import {poolService} from "../modules/pool/pool.service.js";
import type {PoolAttempt} from "@music-city/shared";
assert.equal(env.STELLAR_NETWORK_PASSPHRASE,Networks.TESTNET);assert.equal(env.EARNINGS_MODE,"pool");assert.equal(new URL(env.DATABASE_URL).pathname,"/music_city_contributor_rehearsal_test");
const directory=process.env.TWO_ADMIN_POOL_DEMO_DIR;
assert(directory&&!resolve(directory).startsWith(resolve(import.meta.dirname,"../../..")+"/"),"Keep credentials and signed files outside the repository");
await mkdir(directory,{recursive:true,mode:0o700});const file=join(directory,"state.private.json");
type Admin={email:string;password:string;name:string;id?:string};
type State={admins:Admin[];funding?:{xdr:string;hash:string};attemptId?:string;previousAttemptIds?:string[]};
let state:State;try{state=JSON.parse(await readFile(file,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;state={admins:["a","b"].map(letter=>({email:`treasury-admin-${letter}@musiccity.test`,password:randomBytes(15).toString("base64url")+"!7",name:`Treasury Admin ${letter.toUpperCase()}`}))};}
async function save(){await writeFile(file,JSON.stringify(state,null,2),{mode:0o600});}await save();
const deployment=JSON.parse(await readFile(process.env.CONTRIBUTOR_REHEARSAL_STATE!,"utf8"));
const fixture=JSON.parse(await readFile(process.env.CONTRIBUTOR_VERIFICATION_STATE!,"utf8"));
const keys=deployment.secrets.slice(0,2).map((s:string)=>Keypair.fromSecret(s));assert.equal(keys[0]!.publicKey(),env.AGREEMENT_TREASURY_ADDRESS);
const rpc=new Server(env.STELLAR_SOROBAN_RPC_URL,{timeout:20000}),base=`http://127.0.0.1:${env.PORT}/api/v1/admin`;
async function request(path:string,token?:string,body?:object){const r=await fetch(base+path,{method:body?"POST":"GET",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});const value=await r.json() as any;if(!r.ok)throw Error(`Local demo API ${r.status}: ${value.error??"Request failed"}`);return value;}
try{
 await db.initialize({repair:false});
 for(const a of state.admins){const existing=await db.findAdminByEmail<{id:string;passwordHash:string}>(a.email);
  if(existing){assert(await passwordService.verifyPassword(a.password,existing.passwordHash),"Existing account has different credentials; refusing to reset it");a.id=existing.id;}
  else a.id=(await adminService.createAdmin({...a,role:"super_admin"})).id;await save();
 }
 const sessions=await Promise.all(state.admins.map(a=>request("/auth/login",undefined,{email:a.email,password:a.password})));
 assert.notEqual(sessions[0].admin.id,sessions[1].admin.id);
 let attempt=state.attemptId?(await poolService.attempts()).find(a=>a.id===state.attemptId):undefined;
 if(attempt&&Date.parse(attempt.expiresAt)<=Date.now()&&!['confirmed','failed','expired'].includes(attempt.status))attempt=await poolService.reconcile(attempt.id);
 if(attempt?.status==="confirmed"){console.log(JSON.stringify({completed:true,attemptId:attempt.id,transactionHash:attempt.transactionHash}));}
 else {
  if(!attempt||["failed","expired"].includes(attempt.status)){
   const account=await (await fetch(`${env.STELLAR_HORIZON_URL}/accounts/${keys[0]!.publicKey()}`)).json() as {balances:{asset_code?:string;asset_issuer?:string;balance:string}[]};
   const line=account.balances.find(b=>b.asset_code==="USDC"&&b.asset_issuer===env.STELLAR_SETTLEMENT_ASSET_ISSUER);
   if(!line||Number(line.balance)<0.1){
    if(!state.funding){const funder=Keypair.fromSecret(fixture.secrets[2]);const tx=new TransactionBuilder(await rpc.getAccount(funder.publicKey()),{fee:BASE_FEE,networkPassphrase:Networks.TESTNET}).addOperation(Operation.payment({destination:keys[0]!.publicKey(),asset:new Asset("USDC",env.STELLAR_SETTLEMENT_ASSET_ISSUER),amount:"0.5"})).setTimeout(600).build();tx.sign(funder);state.funding={xdr:tx.toXDR(),hash:tx.hash().toString("hex")};await save();}
    let r=await rpc.getTransaction(state.funding.hash);if(r.status===Api.GetTransactionStatus.NOT_FOUND){const sent=await rpc.sendTransaction(TransactionBuilder.fromXDR(state.funding.xdr,Networks.TESTNET));assert.notEqual(sent.status,"ERROR");}
    for(let i=0;i<40&&r.status===Api.GetTransactionStatus.NOT_FOUND;i++){await new Promise(resolve=>setTimeout(resolve,1000));r=await rpc.getTransaction(state.funding.hash);}assert.equal(r.status,Api.GetTransactionStatus.SUCCESS,"Resume the retained treasury preparation transfer");
   }
   if(state.attemptId)state.previousAttemptIds=[...(state.previousAttemptIds??[]),state.attemptId];
   attempt=(await request("/pool/prepare",sessions[0].session.token,{action:"top_up",amount:"0.1"})).attempt as PoolAttempt;
   state.attemptId=attempt.id;await save();
  }
  assert(attempt&&attempt.poolAction==="top_up"&&attempt.amountUnits==="1000000");
  const files:string[]=[];
  for(const [i,key] of keys.entries()){const tx=TransactionBuilder.fromXDR(attempt.transaction,attempt.networkPassphrase);assert.equal(tx.hash().toString("hex"),attempt.transactionHash);tx.sign(key);const path=join(directory,`admin-${i===0?"a":"b"}-signed.xdr`);await writeFile(path,tx.toXDR()+"\n",{mode:0o600});files.push(path);}
  const views=await Promise.all(sessions.map(s=>request("/pool",s.session.token)));assert(views.every(v=>v.attempts.some((a:PoolAttempt)=>a.id===attempt!.id)));
  const credentialsFile=join(directory,"admin-logins.txt");
  await writeFile(credentialsFile,state.admins.map(a=>`${a.name}\nEmail: ${a.email}\nPassword: ${a.password}\n`).join("\n"),{mode:0o600});
  const publicState={amountUSDC:"0.1",attemptId:attempt.id,transactionHash:attempt.transactionHash,expiresAt:attempt.expiresAt,signatureCount:attempt.signedBy.length,admins:state.admins.map((a,i)=>({id:a.id,name:a.name,email:a.email,signerWallet:keys[i]!.publicKey(),signedFile:files[i]})),credentialsFile};
  await writeFile(join(directory,"demo.public.json"),JSON.stringify(publicState,null,2));console.log(JSON.stringify(publicState));
 }
}finally{await db.close();}
