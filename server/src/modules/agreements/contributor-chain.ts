import { randomUUID } from "node:crypto";
import { Address, BASE_FEE, Contract, Keypair, Networks, Transaction, TransactionBuilder, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import { Api, Server } from "@stellar/stellar-sdk/rpc";
import { z } from "zod";
import type { AgreementAction, AgreementVersion } from "@music-city/shared";
import { env } from "../../config/env.js";
import { databaseService } from "../../services/database.service.js";
import { HttpError } from "../../utils/http-error.js";
import { agreementsRepository, readVersion, recordEvent, writeVersion } from "./agreements.repository.js";
import { canonicalProposal } from "./agreement-domain.js";
import { agreementsChain, assertPublicationMatches } from "./agreements-chain.js";
export type ContributorAction = AgreementAction | "cancel";
export type ChainChallenge = {
  mode: "contributors"; id: string; agreementId: string; version: number; walletAddress: string;
  action: ContributorAction; reason: string; proposalHash: string; previousFinalizedHash: string;
  transaction: string; expiresAt: string; contractId: string; networkPassphrase: string;
};
const actions = { accept:0, reject:1, dispute:2, cancel:3 };
const rpc = () => new Server(env.STELLAR_SOROBAN_RPC_URL,{timeout:10000});
const config = () => agreementsChain.config();
const map = (values: Record<string,xdr.ScVal>) => xdr.ScVal.scvMap(Object.entries(values).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,val])=>new xdr.ScMapEntry({key:xdr.ScVal.scvSymbol(key),val})));
export function contributorProposal(version:AgreementVersion, previousHash:string) {
  const p=version.proposal;
  if (canonicalProposal(p).proposalHash!==version.proposalHash) throw new HttpError(409,"Agreement integrity check failed");
  return map({ track_id:nativeToScVal(p.trackId), agreement_id:nativeToScVal(p.agreementId), version:nativeToScVal(p.version,{type:"u32"}), owner:new Address(p.ownerWallet).toScVal(), recipients:xdr.ScVal.scvVec(p.recipients.map(r=>map({wallet:new Address(r.walletAddress).toScVal(),role:nativeToScVal(r.role),share_bps:nativeToScVal(r.shareBps,{type:"u32"})}))), proposal_hash:nativeToScVal(Buffer.from(version.proposalHash,"hex")), previous_finalized_hash:nativeToScVal(Buffer.from(previousHash,"hex")) });
}
async function read(method:string,args:xdr.ScVal[],source?:string) {
  const c=config(),server=rpc();
  const account=await server.getAccount(source??c.treasuryAddress);
  const tx=new TransactionBuilder(account,{fee:BASE_FEE,networkPassphrase:c.networkPassphrase}).addOperation(new Contract(c.contractId).call(method,...args)).setTimeout(30).build();
  const result=await server.simulateTransaction(tx);
  if (!Api.isSimulationSuccess(result) || !result.result) throw new HttpError(502,"Unable to read contributor registry");
  return scValToNative(result.result.retval);
}
// The registrar may bind ownership once. It cannot approve or change any split.
async function ensureRegistered(version:AgreementVersion) {
  const p=version.proposal;
  const existing=await read("owner",[nativeToScVal(p.trackId)]);
  if(existing){if(existing!==p.ownerWallet)throw new HttpError(409,"Registered track owner does not match");return;}
  if(!env.AGREEMENT_REGISTRAR_SECRET)throw new HttpError(503,"Track ownership registration is unavailable");
  if(env.NODE_ENV==="production" || env.STELLAR_NETWORK_PASSPHRASE!==Networks.TESTNET)throw new HttpError(503,"Automatic ownership registration is restricted to local Testnet rehearsal");
  const key=Keypair.fromSecret(env.AGREEMENT_REGISTRAR_SECRET),server=rpc(),c=config();
  const tx=await server.prepareTransaction(new TransactionBuilder(await server.getAccount(key.publicKey()),{fee:BASE_FEE,networkPassphrase:c.networkPassphrase}).addOperation(new Contract(c.contractId).call("register_track",nativeToScVal(p.trackId),new Address(p.ownerWallet).toScVal())).setTimeout(120).build());
  tx.sign(key);
  const result=await server.sendTransaction(tx);
  if(result.status==="ERROR")throw new HttpError(502,"Track ownership registration failed");
  // Idempotent registration is safe to retry, unlike a payment or approval.
  for(let i=0;i<12;i++){await new Promise(resolve=>setTimeout(resolve,500));const status=await server.getTransaction(tx.hash().toString("hex"));if(status.status===Api.GetTransactionStatus.SUCCESS)return;if(status.status===Api.GetTransactionStatus.FAILED)throw new HttpError(502,"Track ownership registration failed");}
  throw new HttpError(409,"Track ownership registration is confirming. Please retry shortly");
}
export function verifyContributorEnvelope(challenge:ChainChallenge,signedXdr:string,actor:string) {
  if(actor!==challenge.walletAddress || challenge.contractId!==config().contractId || challenge.networkPassphrase!==env.STELLAR_NETWORK_PASSPHRASE)throw new HttpError(403,"Signing context changed");
  let signed:Transaction;
  try{
    const expected=TransactionBuilder.fromXDR(challenge.transaction,challenge.networkPassphrase);
    const decoded=TransactionBuilder.fromXDR(signedXdr,challenge.networkPassphrase);
    if(!(decoded instanceof Transaction) || !(expected instanceof Transaction) || !decoded.hash().equals(expected.hash()) || decoded.source!==actor || !decoded.signatures.some(s=>Keypair.fromPublicKey(actor).verify(decoded.hash(),s.signature())))throw new Error();
    signed=decoded;
  }catch{throw new HttpError(401,"Wallet signature does not authorize the exact contributor transaction");}
  return signed;
}
export const contributorChain = {
  async readState(trackId: string, version: number) {
    return read("get_proposal",[nativeToScVal(trackId),nativeToScVal(version,{type:"u32"})]) as Promise<{proposal:{proposal_hash:Buffer};required:string[];decisions:{wallet:string;action:number}[];state:number}|null>;
  },
  async prepare(version:AgreementVersion,actor:string,input:unknown):Promise<ChainChallenge>{
    const request=z.object({action:z.enum(["accept","reject","dispute","cancel"]),reason:z.string().trim().max(1000).default("")}).strict().parse(input);
    if(!["proposed","ready"].includes(version.state))throw new HttpError(409,"This proposal is not open for responses");
    const required=version.requiredApprovers??[];
    if(!required.includes(actor) || (request.action==="cancel" && actor!==version.proposal.ownerWallet))throw new HttpError(403,"Only authorized participants can respond");
    if(["reject","dispute"].includes(request.action)&&!request.reason)throw new HttpError(400,"Add a reason");
    if(request.action==="accept"&&request.reason)throw new HttpError(400,"Acceptance cannot include a rejection reason");
    const pending=await databaseService.transaction(async client=>(await client.query("SELECT challenge_id FROM contributor_chain_attempts WHERE actor=$1 AND status='submitted' LIMIT 1",[actor])).rows[0]);
    if(pending)throw new HttpError(409,"Your previous wallet transaction is still confirming. Please wait before signing again");
    await ensureRegistered(version);
    const c=config();
    const saved=await read("get_proposal",[nativeToScVal(version.proposal.trackId),nativeToScVal(version.proposal.version,{type:"u32"})],actor);
    if(!saved && actor!==version.proposal.ownerWallet)throw new HttpError(409,"The track owner must sign this proposal before contributors respond");
    const previous=await agreementsChain.getLatest(version.proposal.trackId);
    // A finalized current version is handled by reconciliation, not a new signature.
    if(previous?.version===version.proposal.version)throw new HttpError(409,"This agreement already finalized. Refresh to see its status");
    const previousHash=previous?.proposalHash??"0".repeat(64),server=rpc();
    const transaction=await server.prepareTransaction(new TransactionBuilder(await server.getAccount(actor),{fee:BASE_FEE,networkPassphrase:c.networkPassphrase}).addOperation(new Contract(c.contractId).call("respond",contributorProposal(version,previousHash),new Address(actor).toScVal(),nativeToScVal(actions[request.action],{type:"u32"}))).setTimeout(300).build());
    return {mode:"contributors",id:randomUUID(),agreementId:version.proposal.agreementId,version:version.proposal.version,walletAddress:actor,action:request.action,reason:request.reason,proposalHash:version.proposalHash,previousFinalizedHash:previousHash,transaction:transaction.toXDR(),expiresAt:new Date(Number(transaction.timeBounds!.maxTime)*1000).toISOString(),contractId:c.contractId,networkPassphrase:c.networkPassphrase};
  },
  async respond(id:string,actor:string,input:unknown) {
    const request=z.object({challengeId:z.string().uuid(),signedTransaction:z.string().min(1).max(200000)}).strict().parse(input);
    const attempt=await agreementsRepository.locked(id,actor,async(client,_root,current)=>{
      const row=(await client.query("SELECT payload FROM agreement_challenges WHERE id=$1 AND agreement_id=$2 AND wallet_address=$3 FOR UPDATE",[request.challengeId,id,actor])).rows[0];
      const challenge=row?.payload as ChainChallenge|undefined;
      if(!challenge || challenge.mode!=="contributors")throw new HttpError(404,"Contributor transaction not found");
      const signed=verifyContributorEnvelope(challenge,request.signedTransaction,actor);
      const prior=(await client.query("SELECT * FROM contributor_chain_attempts WHERE challenge_id=$1",[challenge.id])).rows[0];
      if(prior?.status==="failed")throw new HttpError(422,"Contributor transaction failed. Review and sign a new request");
      if(prior)return {challenge,hash:prior.transaction_hash as string,signed:prior.signed_transaction as string};
      if(current.proposal.version!==challenge.version || current.proposalHash!==challenge.proposalHash || !["proposed","ready"].includes(current.state))throw new HttpError(409,"The proposal changed before submission");
      if(Date.parse(challenge.expiresAt)<=Date.now())throw new HttpError(409,"Signing request expired. Please review and sign again");
      await client.query("INSERT INTO contributor_chain_attempts(challenge_id,agreement_id,version,actor,transaction_hash,signed_transaction,status) VALUES($1,$2,$3,$4,$5,$6,'submitted')",[challenge.id,id,challenge.version,actor,signed.hash().toString("hex"),request.signedTransaction]);
      return {challenge,hash:signed.hash().toString("hex"),signed:request.signedTransaction};
    });
    const server=rpc();
    let result=await server.getTransaction(attempt.hash);
    if(result.status===Api.GetTransactionStatus.NOT_FOUND){
      const sent=await server.sendTransaction(TransactionBuilder.fromXDR(attempt.signed,attempt.challenge.networkPassphrase));
      if(sent.status==="ERROR" && sent.errorResult?.result().switch().name!=="txBadSeq")throw new HttpError(409,"Contributor transaction could not be submitted. Its original outcome will be reconciled");
    }
    for(let i=0;i<10 && result.status===Api.GetTransactionStatus.NOT_FOUND;i++){await new Promise(resolve=>setTimeout(resolve,500));result=await server.getTransaction(attempt.hash);}
    await this.reconcile(attempt.challenge.id);
    const status=await databaseService.transaction(async client=>(await client.query("SELECT status FROM contributor_chain_attempts WHERE challenge_id=$1",[attempt.challenge.id])).rows[0]?.status);
    if(status==="submitted")throw new HttpError(409,"Your approval is confirming. It will update automatically; no new signature is needed");
    return agreementsRepository.locked(id,actor,async(_client,_root,current)=>current);
  },
  async reconcile(challengeId:string){
    const stored=await databaseService.transaction(async client=>(await client.query("SELECT a.*,c.payload AS challenge FROM contributor_chain_attempts a JOIN agreement_challenges c ON c.id=a.challenge_id WHERE a.challenge_id=$1",[challengeId])).rows[0]);
    if(!stored || stored.status!=="submitted")return;
    const challenge=stored.challenge as ChainChallenge;
    if(challenge.contractId!==config().contractId || challenge.networkPassphrase!==env.STELLAR_NETWORK_PASSPHRASE)throw new HttpError(409,"Restore this attempt's original registry configuration");
    const result=await rpc().getTransaction(stored.transaction_hash);
    if(result.status===Api.GetTransactionStatus.NOT_FOUND)return;
    if(result.status===Api.GetTransactionStatus.FAILED){await databaseService.transaction(client=>client.query("UPDATE contributor_chain_attempts SET status='failed',error='Contract transaction failed',checked_at=NOW() WHERE challenge_id=$1 AND status='submitted'",[challengeId]));throw new HttpError(422,"Contributor transaction failed. Review and sign a new request");}
    if (new Transaction(result.envelopeXdr,challenge.networkPassphrase).hash().toString("hex")!==stored.transaction_hash) throw new HttpError(409,"Contributor transaction receipt does not match its retained hash");
    const sourceVersion=await databaseService.transaction(client=>readVersion(client,stored.agreement_id,stored.version));
    const state=await this.readState(sourceVersion.proposal.trackId,stored.version);
    if(!state || Buffer.from(state.proposal.proposal_hash).toString("hex")!==challenge.proposalHash || !state.decisions.some(d=>d.wallet===stored.actor && d.action===actions[challenge.action]))throw new HttpError(409,"Confirmed contributor state does not match the signed decision");
    if(JSON.stringify([...state.required].sort())!==JSON.stringify([...(sourceVersion.requiredApprovers??[])].sort()))throw new HttpError(409,"Contract approvers do not match the agreement's required consent");
    const finalized=state.state===1 ? await agreementsChain.getVersion(sourceVersion.proposal.trackId,stored.version):null;
    if(finalized)assertPublicationMatches(sourceVersion,finalized,challenge.previousFinalizedHash);
    await agreementsRepository.locked(stored.agreement_id,stored.actor,async(client,root,current)=>{
      const row=(await client.query("SELECT status FROM contributor_chain_attempts WHERE challenge_id=$1 FOR UPDATE",[challengeId])).rows[0];
      if(row.status!=="submitted")return;
      const version=await readVersion(client,stored.agreement_id,stored.version);
      const response={walletAddress:stored.actor,action:challenge.action,reason:challenge.reason,challengeId,proposalHash:challenge.proposalHash,signedTransaction:stored.signed_transaction,respondedAt:new Date().toISOString()};
      const already=version.responses.some(r=>r.challengeId===challengeId);
      if(version.state!=="finalized"){
        if(challenge.action!=="cancel"&&!already){await client.query("INSERT INTO agreement_responses(challenge_id,agreement_id,version,wallet_address,action,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",[challengeId,stored.agreement_id,stored.version,stored.actor,challenge.action,response]);version.responses.push(response as typeof version.responses[number]);}
        const names=["proposed","finalized","rejected","disputed","cancelled"] as const;
        version.state=state!.state===1 ? "proposed":names[state!.state]!;
        if(finalized && finalized.finalizedLedger===result.ledger){
          version.state="finalized";
          version.publication={contractId:challenge.contractId,networkPassphrase:challenge.networkPassphrase,transactionHash:stored.transaction_hash,transaction:stored.signed_transaction,actor:stored.actor,ledger:result.ledger,previousFinalizedHash:challenge.previousFinalizedHash};
        }
        version.updatedAt=new Date().toISOString();await writeVersion(client,version);
        await recordEvent(client,version,stored.actor,challenge.action==="cancel"?"cancelled":challenge.action,{challengeId,transactionHash:stored.transaction_hash});
        if(version.state==="finalized")await recordEvent(client,version,stored.actor,"finalized",{transactionHash:stored.transaction_hash,publicationMode:"contributors"});
      }
      await client.query("UPDATE agreement_challenges SET consumed_at=NOW() WHERE id=$1",[challengeId]);
      await client.query("UPDATE contributor_chain_attempts SET status='confirmed',receipt=$2,checked_at=NOW() WHERE challenge_id=$1",[challengeId,{ledger:result.ledger,transactionHash:stored.transaction_hash,contractId:challenge.contractId}]);
      if(version.state==="finalized" && version.publication?.transactionHash===stored.transaction_hash) {
        await client.query("UPDATE contributor_agreements SET effective_version=$2 WHERE id=$1",[stored.agreement_id,stored.version]);
      }
    },true);
  },
  async reconcilePending(){
    const rows=await databaseService.transaction(async client=>(await client.query("SELECT challenge_id FROM contributor_chain_attempts WHERE status='submitted' ORDER BY created_at LIMIT 20")).rows);
    for(const row of rows)await this.reconcile(row.challenge_id);
  },
};
