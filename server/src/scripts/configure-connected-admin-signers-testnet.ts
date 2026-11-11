import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {BASE_FEE,Keypair,Networks,Operation,TransactionBuilder} from "@stellar/stellar-sdk";
import {Api,Server} from "@stellar/stellar-sdk/rpc";
import {env} from "../config/env.js";
import {databaseService as db} from "../services/database.service.js";
import {verifyTreasuryConfiguration,type TreasuryAccount} from "../modules/agreements/treasury-signatures.js";
assert.equal(env.STELLAR_NETWORK_PASSPHRASE,Networks.TESTNET);assert.equal(new URL(env.DATABASE_URL).pathname,"/music_city_contributor_rehearsal_test");
const path=process.env.CONNECTED_ADMIN_SIGNERS_STATE;assert(path&&!resolve(path).startsWith(resolve(import.meta.dirname,"../../..")+"/"));
const original=JSON.parse(await readFile(process.env.CONTRIBUTOR_REHEARSAL_STATE!,"utf8"));const keys:Keypair[]=original.secrets.slice(0,3).map((s:string)=>Keypair.fromSecret(s));assert.equal(keys[0]!.publicKey(),env.AGREEMENT_TREASURY_ADDRESS);
const rpc=new Server(env.STELLAR_SOROBAN_RPC_URL,{timeout:20000});assert.equal((await rpc.getNetwork()).passphrase,Networks.TESTNET);
try{
 await db.initialize({repair:false});
 const expected=[{email:"iamenochchirima@gmail.com",wallet:"GB3XS62ZJ7EVX2ZSMUJ2BWYXOXBOL6OCDY7J2F5QOOFWWLYWSEB6TV6U"},{email:"chirimaenoch@gmail.com",wallet:"GCZS3HHJGOFZRSKOO4K6WO5PFQEBW7XP3QTTA53A6IITRCORN2ZS4APA"}];
 for(const person of expected){const profiles=await db.transaction(async c=>(await c.query("SELECT wallet_address FROM users WHERE lower(payload->>'email')=$1",[person.email])).rows);assert.equal(profiles.length,1);assert.equal(profiles[0].wallet_address,person.wallet);}
 const pending=await db.transaction(async c=>(await c.query("SELECT id FROM pool_attempts WHERE source_address=$1 AND status IN ('awaiting_signatures','submitting','submitted') UNION ALL SELECT id FROM financial_attempts WHERE source_address=$1 AND status IN ('awaiting_signatures','submitting','submitted') UNION ALL SELECT id FROM agreement_finalizations WHERE treasury_address=$1 AND status IN ('awaiting_signatures','submitting','submitted')",[keys[0]!.publicKey()])).rows);assert.equal(pending.length,0,"Reconcile outstanding treasury transactions before changing signers");
 const account=async():Promise<TreasuryAccount>=>{const r=await fetch(`${env.STELLAR_HORIZON_URL}/accounts/${keys[0]!.publicKey()}`);assert(r.ok);return await r.json() as TreasuryAccount;};
 const current=verifyTreasuryConfiguration(await account(),keys[0]!.publicKey()),desired=[keys[0]!.publicKey(),...expected.map(p=>p.wallet)].sort();
 let state:{transaction?:string;hash?:string;ledger?:number;signers?:string[]};try{state=JSON.parse(await readFile(path,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;state={};}
 if(JSON.stringify(current)!==JSON.stringify(desired)){
  assert.deepEqual(current,keys.map(k=>k.publicKey()).sort(),"Refusing to replace an unexpected signer configuration");
  if(!state.transaction){let tx=new TransactionBuilder(await rpc.getAccount(keys[0]!.publicKey()),{fee:BASE_FEE,networkPassphrase:Networks.TESTNET});for(const p of expected)tx=tx.addOperation(Operation.setOptions({signer:{ed25519PublicKey:p.wallet,weight:1}}));
   // The old second signing key remains active until the final operation.
   for(const key of [keys[2]!,keys[1]!])tx=tx.addOperation(Operation.setOptions({signer:{ed25519PublicKey:key.publicKey(),weight:0}}));
   const built=tx.setTimeout(600).build();built.sign(keys[0]!,keys[1]!);state.transaction=built.toXDR();state.hash=built.hash().toString("hex");await writeFile(path,JSON.stringify(state,null,2),{mode:0o600});
  }
  let r=await rpc.getTransaction(state.hash!);if(r.status===Api.GetTransactionStatus.NOT_FOUND){const sent=await rpc.sendTransaction(TransactionBuilder.fromXDR(state.transaction!,Networks.TESTNET));assert.notEqual(sent.status,"ERROR");}
  for(let i=0;i<40&&r.status===Api.GetTransactionStatus.NOT_FOUND;i++){await new Promise(resolve=>setTimeout(resolve,1000));r=await rpc.getTransaction(state.hash!);}assert.equal(r.status,Api.GetTransactionStatus.SUCCESS,"Resume the retained signer transaction; do not guess an unknown outcome");state.ledger=(r as Api.GetSuccessfulTransactionResponse).ledger;
 }
 state.signers=verifyTreasuryConfiguration(await account(),keys[0]!.publicKey());assert.deepEqual(state.signers,desired);await writeFile(path,JSON.stringify(state,null,2),{mode:0o600});
 const evidence={network:Networks.TESTNET,treasury:keys[0]!.publicKey(),threshold:2,signers:state.signers,transactionHash:state.hash,ledger:state.ledger,admins:expected,ownershipLinks:"Fresh wallet ownership proofs are still required per admin account"};await writeFile(path+".public.json",JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{await db.close();}
