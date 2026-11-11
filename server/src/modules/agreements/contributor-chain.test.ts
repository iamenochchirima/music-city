import assert from "node:assert/strict";
import test from "node:test";
import { Account, BASE_FEE, Contract, Keypair, Networks, TransactionBuilder, StrKey, scValToNative, nativeToScVal } from "@stellar/stellar-sdk";
const owner=Keypair.random(),partner=Keypair.random(),outsider=Keypair.random();
const contract=StrKey.encodeContract(Buffer.alloc(32,7));
process.env.AGREEMENT_TREASURY_ADDRESS=owner.publicKey();
process.env.ROYALTY_REGISTRY_CONTRACT_ID=contract;
process.env.STELLAR_NETWORK_PASSPHRASE=Networks.TESTNET;
const {contributorProposal,verifyContributorEnvelope}=await import("./contributor-chain.js");
const {createVersion}=await import("./agreement-domain.js");
const version=createVersion({schemaVersion:1,agreementId:"agreement",trackId:"track",releaseId:null,version:1,previousHash:null,ownerWallet:owner.publicKey(),networkPassphrase:Networks.TESTNET,recipients:[{walletAddress:owner.publicKey(),role:"artist",shareBps:7000},{walletAddress:partner.publicKey(),role:"producer",shareBps:3000}],terms:"Test agreement"});
const expires=Math.floor(Date.now()/1000)+300;
function prepare(action=0,network=Networks.TESTNET){return new TransactionBuilder(new Account(owner.publicKey(),"10"),{fee:BASE_FEE,networkPassphrase:network,timebounds:{minTime:0,maxTime:expires}}).addOperation(new Contract(contract).call("respond",contributorProposal(version,"0".repeat(64)),nativeToScVal(owner.publicKey(),{type:"address"}),nativeToScVal(action,{type:"u32"}))).build();}
const tx=prepare();
const challenge={mode:"contributors" as const,id:crypto.randomUUID(),agreementId:"agreement",version:1,walletAddress:owner.publicKey(),action:"accept" as const,reason:"",proposalHash:version.proposalHash,previousFinalizedHash:"0".repeat(64),transaction:tx.toXDR(),expiresAt:new Date(Date.now()+300000).toISOString(),contractId:contract,networkPassphrase:Networks.TESTNET};
test("native proposal binds owner, exact recipients, version and predecessor",()=>{const p=scValToNative(contributorProposal(version,"0".repeat(64)));assert.equal(p.owner,owner.publicKey());assert.equal(p.version,1);assert.equal(Buffer.from(p.proposal_hash).toString("hex"),version.proposalHash);assert.deepEqual(p.recipients.map((r:{wallet:string})=>r.wallet),version.proposal.recipients.map(r=>r.walletAddress));assert.throws(()=>contributorProposal({...version,proposalHash:"a".repeat(64)},"0".repeat(64)));});
test("accepts only the original transaction signed by its actual contributor",()=>{const signed=prepare();signed.sign(owner);assert.equal(verifyContributorEnvelope(challenge,signed.toXDR(),owner.publicKey()).hash().toString("hex"),tx.hash().toString("hex"));});
test("rejects another action, signer, source actor, contract or network",()=>{const changed=prepare(1);changed.sign(owner);assert.throws(()=>verifyContributorEnvelope(challenge,changed.toXDR(),owner.publicKey()));const wrong=prepare();wrong.sign(outsider);assert.throws(()=>verifyContributorEnvelope(challenge,wrong.toXDR(),owner.publicKey()));const signed=prepare();signed.sign(owner);assert.throws(()=>verifyContributorEnvelope(challenge,signed.toXDR(),partner.publicKey()));assert.throws(()=>verifyContributorEnvelope({...challenge,contractId:StrKey.encodeContract(Buffer.alloc(32,9))},signed.toXDR(),owner.publicKey()));assert.throws(()=>verifyContributorEnvelope({...challenge,networkPassphrase:Networks.PUBLIC},signed.toXDR(),owner.publicKey()));});
