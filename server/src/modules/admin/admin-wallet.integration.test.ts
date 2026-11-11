import assert from "node:assert/strict";
import test from "node:test";
import {Account,Keypair,Networks,Operation,StrKey,TransactionBuilder} from "@stellar/stellar-sdk";
const url=process.env.ADMIN_WALLET_TEST_DATABASE_URL;
test("admin wallet ownership, request isolation and linked-only signing in PostgreSQL",{skip:!url},async()=>{
 const target=new URL(url!);assert(["localhost","127.0.0.1"].includes(target.hostname)&&target.pathname.endsWith("_test"));process.env.DATABASE_URL=url;
 const {databaseService:db}=await import("../../services/database.service.js"),{env}=await import("../../config/env.js"),{adminWalletService:s}=await import("./admin-wallet.service.js"),{poolChain}=await import("../pool/pool-chain.js"),{poolService}=await import("../pool/pool.service.js");
 const originals={...env},oldSigners=poolChain.signers;const keys=[Keypair.random(),Keypair.random(),Keypair.random()],other=Keypair.random(),pool=StrKey.encodeContract(Buffer.alloc(32,88));env.EARNINGS_POOL_CONTRACT_ID=pool;env.STELLAR_NETWORK_PASSPHRASE=Networks.TESTNET;
 poolChain.signers=async()=>keys.map(k=>k.publicKey()).sort();
 function sign(xdr:string,key:Keypair){const tx=TransactionBuilder.fromXDR(xdr,Networks.TESTNET);tx.sign(key);return tx.toXDR();}
 try{
  await db.initialize({repair:false});for(const id of ["a","b","c"])await db.upsertAdmin(id,`${id}@example.test`,"super_admin",{id,name:`Admin ${id}`,role:"super_admin",email:`${id}@example.test`,passwordHash:"unused",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  const a=await s.create("a",{kind:"link"});await assert.rejects(s.publicView(a.id,"wrong"),/token/);await assert.rejects(s.get("b",a.id),/different admin/);
  await assert.rejects(s.challenge(a.id,a.token,other.publicKey()),/authorized treasury wallet/);
  const challenge=await s.challenge(a.id,a.token,keys[0]!.publicKey());await assert.rejects(s.signed(a.id,a.token,sign(challenge.transaction,keys[1]!)),/own connected wallet/);
  await s.signed(a.id,a.token,sign(challenge.transaction,keys[0]!));assert.equal((await s.status("a")).walletAddress,null,"The popup cannot link an account without the authenticated admin confirmation");
  await assert.rejects(s.confirm("b",a.id),/different admin/);await s.confirm("a",a.id);assert.equal((await s.status("a")).walletAddress,keys[0]!.publicKey());await s.confirm("a",a.id);
  const b=await s.create("b",{kind:"link"});await assert.rejects(s.challenge(b.id,b.token,keys[0]!.publicKey()),/different admin/);
  const bc=await s.challenge(b.id,b.token,keys[1]!.publicKey());await assert.rejects(s.signed(b.id,b.token,sign(challenge.transaction,keys[0]!)),/own connected wallet/);await s.signed(b.id,b.token,sign(bc.transaction,keys[1]!));await s.confirm("b",b.id);
  await assert.rejects(s.create("a",{kind:"link"}),/already has/);
  const c=await s.create("c",{kind:"link"});await s.cancel("c",c.id);await assert.rejects(s.challenge(c.id,c.token,keys[2]!.publicKey()),/cancelled/);
  const cancelled=await s.create("c",{kind:"link"});const cc=await s.challenge(cancelled.id,cancelled.token,keys[2]!.publicKey());await s.signed(cancelled.id,cancelled.token,sign(cc.transaction,keys[2]!));await s.cancel("c",cancelled.id);await assert.rejects(s.confirm("c",cancelled.id),/cancelled/);assert.equal((await s.status("c")).walletAddress,null);
  const expiring=await s.create("c",{kind:"link"});const ec=await s.challenge(expiring.id,expiring.token,keys[2]!.publicKey());
  await assert.rejects(db.transaction(c=>c.query("UPDATE admin_wallet_requests SET wallet_address=$2 WHERE id=$1",[expiring.id,keys[0]!.publicKey()])),/immutable/);
  const now=Date.now;try{Date.now=()=>now()+700000;await assert.rejects(s.signed(expiring.id,expiring.token,sign(ec.transaction,keys[2]!)),/expired/);}finally{Date.now=now;}
  const tx=new TransactionBuilder(new Account(keys[2]!.publicKey(),"100"),{fee:"100",networkPassphrase:Networks.TESTNET}).addOperation(Operation.manageData({name:"mock-treasury-boundary",value:"top-up"})).setTimeout(600).build();const stamp=new Date().toISOString();const attempt={id:"attempt",poolContractId:pool,poolAction:"top_up",amountUnits:"1000000",batchId:"f".repeat(64),kind:"settle",actor:"admin:a",treasuryAddress:keys[2]!.publicKey(),networkPassphrase:Networks.TESTNET,transaction:tx.toXDR(),transactionHash:tx.hash().toString("hex"),signers:await poolChain.signers(),signatures:{},signedBy:[],status:"awaiting_signatures",submissionCount:0,expiresAt:new Date(Number(tx.timeBounds!.maxTime)*1000).toISOString(),createdAt:stamp,updatedAt:stamp};
  await db.transaction(c=>c.query("INSERT INTO pool_attempts(id,contract_id,source_address,transaction_hash,status,payload) VALUES($1,$2,$3,$4,$5,$6)",[attempt.id,pool,attempt.treasuryAddress,attempt.transactionHash,attempt.status,attempt]));
  await assert.rejects(poolService.addSignature(attempt.id,"admin:a",sign(attempt.transaction,keys[1]!),true),/own connected wallet/);
  const combined=TransactionBuilder.fromXDR(attempt.transaction,Networks.TESTNET);combined.sign(keys[0]!,keys[1]!);await assert.rejects(poolService.addSignature(attempt.id,"admin:a",combined.toXDR(),true),/own connected wallet/);
  for(const [i,id] of ["a","b"].entries()){
   const r=await s.create(id,{kind:"sign",attemptId:attempt.id});const v=await s.publicView(r.id,r.token);assert.equal(v.walletAddress,keys[i]!.publicKey());
   await assert.rejects(s.challenge(r.id,r.token,keys[(i+1)%3]!.publicKey()),/linked/);
   const q=await s.challenge(r.id,r.token,keys[i]!.publicKey());await s.signed(r.id,r.token,sign(q.transaction,keys[i]!));await s.confirm(id,r.id);
   const current=(await poolService.attempts())[0]!;assert.equal(current.signedBy.length,i+1);
  }
  assert.deepEqual((await poolService.attempts())[0]!.signatureApprovals?.map(a=>a.actor).sort(),["admin:a","admin:b"]);
  await assert.rejects(db.transaction(c=>c.query("UPDATE admin_wallet_links SET wallet_address=$1 WHERE admin_id='a'",[other.publicKey()])),/append-only/);
 }finally{Object.assign(env,originals);poolChain.signers=oldSigners;await db.close();}
});
