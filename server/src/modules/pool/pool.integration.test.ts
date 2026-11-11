import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import {Account,Keypair,Networks,Operation,StrKey,TransactionBuilder} from "@stellar/stellar-sdk";
import {Api} from "@stellar/stellar-sdk/rpc";
const url=process.env.POOL_TEST_DATABASE_URL;
test("pool PostgreSQL durability and authorization with real signatures and mocked chain",{skip:!url},async()=>{
 const target=new URL(url!);assert(["localhost","127.0.0.1"].includes(target.hostname)&&target.pathname.endsWith("_test"));process.env.DATABASE_URL=url;process.env.NODE_ENV="test";
 const {env}=await import("../../config/env.js"),{databaseService:db}=await import("../../services/database.service.js"),{poolService:s}=await import("./pool.service.js"),{poolChain:chain}=await import("./pool-chain.js"),{settlementChain:legacy}=await import("../settlements/settlement-chain.js"),{agreementsChain:registry}=await import("../agreements/agreements-chain.js"),{signedFinancialTransaction}=await import("../settlements/settlement.service.js");
 const originals={chain:{...chain},env:{...env},readiness:legacy.readiness,getVersion:registry.getVersion};
 const treasury=[Keypair.random(),Keypair.random(),Keypair.random()],owner=Keypair.random(),other=Keypair.random(),pool=StrKey.encodeContract(Buffer.alloc(32,90));env.EARNINGS_POOL_CONTRACT_ID=pool;env.STELLAR_NETWORK_PASSPHRASE=Networks.TESTNET;
 const config={contractId:pool,treasuryAddress:treasury[0]!.publicKey(),registryId:"registry",assetContractId:"asset",networkPassphrase:Networks.TESTNET,assetCode:"USDC" as const,assetIssuer:"issuer",feeBps:0};
 let sequence=1,sent=0;
 const missing=()=>({status:Api.GetTransactionStatus.NOT_FOUND,latestLedger:100,latestLedgerCloseTime:Math.floor(Date.now()/1000),oldestLedger:1,oldestLedgerCloseTime:0});
 const receipts=new Map<string,any>(),movements=new Map<string,any>();
 const order={id:"a".repeat(64),contractId:pool,trackId:"track",version:1,proposalHash:"b".repeat(64),buyer:other.publicKey(),grossUnits:"30000000",transactionHash:"c".repeat(64),ledger:90,claims:[{index:0,beneficiary:owner.publicKey(),grossUnits:"30000000",feeUnits:"0",amountUnits:"30000000",claimed:false,ledger:90}]};
 function sign(xdr:string,key:Keypair){const tx=TransactionBuilder.fromXDR(xdr,Networks.TESTNET);tx.sign(key);return tx.toXDR();}
 try{
 await db.initialize({repair:false});
 chain.verify=async()=>config;
 chain.prepare=async(source)=>{const tx=new TransactionBuilder(new Account(source,String(sequence++)),{fee:"100",networkPassphrase:Networks.TESTNET}).addOperation(Operation.manageData({name:"mock-pool-boundary",value:randomUUID()})).setTimeout(600).build();return {transaction:tx.toXDR(),transactionHash:tx.hash().toString("hex"),expiresAt:new Date(Number(tx.timeBounds!.maxTime)*1000).toISOString()};};
 chain.signers=async()=>treasury.map(k=>k.publicKey()).sort();chain.order=async()=>structuredClone(order);chain.receipt=async(hash)=>receipts.get(hash)??missing();
 chain.read=async(method,args)=>{if(method==="get_top_up"||method==="get_return")return movements.get(Buffer.from((await import("@stellar/stellar-sdk")).scValToNative(args![0]!)).toString("hex"))??null;return null;};
 legacy.readiness=async()=>({nativeAvailableUnits:100000000000n});registry.getVersion=async()=>({agreementId:"agreement",version:1,proposalHash:order.proposalHash,previousFinalizedHash:"0".repeat(64),recipients:[{walletAddress:owner.publicKey(),role:"artist",shareBps:10000}],finalizedLedger:80});
 chain.send=async(xdr)=>{sent++;const tx=TransactionBuilder.fromXDR(xdr,Networks.TESTNET);const row=await db.transaction(async c=>(await c.query("SELECT status,payload FROM pool_attempts WHERE transaction_hash=$1",[tx.hash().toString("hex")])).rows[0]);assert.equal(row.status,"submitting");assert(Object.keys(row.payload.signatures).length>=1);throw Error("unknown network outcome");};
 const {adminWalletService:walletLinks}=await import("../admin/admin-wallet.service.js");
 for(const [i,id] of ["operator-a","operator-b"].entries()){
  await db.upsertAdmin(id,`${id}@example.test`,"super_admin",{id,email:`${id}@example.test`,name:`Admin ${i}`,role:"super_admin",passwordHash:"unused",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  const link=await walletLinks.create(id,{kind:"link"});const challenge=await walletLinks.challenge(link.id,link.token,treasury[i]!.publicKey());await walletLinks.signed(link.id,link.token,sign(challenge.transaction,treasury[i]!));await walletLinks.confirm(id,link.id);
 }
 let top=await s.prepare("admin:operator",{action:"top_up",amount:"10"});
 await assert.rejects(s.addSignature(top.id,owner.publicKey(),sign(top.transaction,owner)),/authorized/);
 await s.addSignature(top.id,"admin:operator-a",sign(top.transaction,treasury[0]!),true);await assert.rejects(s.submit(top.id,top.actor,true));assert.equal(sent,0);
 top=await s.addSignature(top.id,"admin:operator-b",sign(top.transaction,treasury[1]!),true);top=await s.submit(top.id,top.actor,true);assert.equal(top.status,"submitting");assert.equal(sent,1);
 movements.set(top.batchId,{amount:100000000n,ledger:101});
 receipts.set(top.transactionHash,{status:Api.GetTransactionStatus.SUCCESS,txHash:top.transactionHash,ledger:101,envelopeXdr:signedFinancialTransaction(top).toEnvelope(),resultXdr:{feeCharged:()=>({toString:()=>"100"})}});
 top=await s.reconcile(top.id);assert.equal(top.status,"confirmed");const credited=(await s.attempts()).find(a=>a.id===top.id)!;assert.deepEqual(credited.signatureApprovals?.map(a=>a.actor).sort(),["admin:operator-a","admin:operator-b"]);await assert.rejects(db.transaction(c=>c.query("UPDATE pool_signature_approvals SET actor_name='changed' WHERE attempt_id=$1",[top.id])),/append-only/);assert.equal((await s.reconcile(top.id)).status,"confirmed");assert.equal((await db.transaction(async c=>(await c.query("SELECT count(*)::int n FROM pool_orders")).rows[0].n)),0,"Top-ups must not create earnings");
 await assert.rejects(db.transaction(c=>c.query("UPDATE pool_attempts SET payload=jsonb_set(payload,'{amountUnits}','\"1\"') WHERE id=$1",[top.id])),/immutable/);
 await db.transaction(c=>c.query("INSERT INTO pool_orders(contract_id,id,payload) VALUES($1,$2,$3)",[pool,order.id,order]));
 await assert.rejects(s.prepare(other.publicKey(),{action:"claim",orderId:order.id,index:0}),/another wallet/);
 const [claim,retry]=await Promise.all([s.prepare(owner.publicKey(),{action:"claim",orderId:order.id,index:0}),s.prepare(owner.publicKey(),{action:"claim",orderId:order.id,index:0})]);assert.equal(claim.id,retry.id);
 await assert.rejects(s.addSignature(claim.id,owner.publicKey(),sign(claim.transaction,other)),/signature|signer/i);
 let signed=await s.addSignature(claim.id,owner.publicKey(),sign(claim.transaction,owner));signed=await s.submit(claim.id,owner.publicKey());assert.equal(signed.status,"submitting");
 order.claims[0]!.claimed=true;order.claims[0]!.ledger=102;
 receipts.set(signed.transactionHash,{status:Api.GetTransactionStatus.SUCCESS,txHash:signed.transactionHash,ledger:102,envelopeXdr:signedFinancialTransaction(signed).toEnvelope(),resultXdr:{feeCharged:()=>({toString:()=>"100"})}});
 assert.equal((await s.reconcile(claim.id)).status,"confirmed");const mine=await s.mine(owner.publicKey());assert.equal(mine.orders[0]!.claims[0]!.claimed,true);
 await assert.rejects(db.transaction(c=>c.query("UPDATE pool_orders SET payload=jsonb_set(payload,'{claims,0,claimed}','false') WHERE id=$1",[order.id])),/immutable/);
 assert.equal((await s.prepare(owner.publicKey(),{action:"claim",orderId:order.id,index:0})).id,claim.id);
 }finally{Object.assign(chain,originals.chain);Object.assign(env,originals.env);legacy.readiness=originals.readiness;registry.getVersion=originals.getVersion;await db.close();}
});
