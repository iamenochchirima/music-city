import assert from "node:assert/strict";
import pg from "pg";
import { databaseService } from "../services/database.service.js";
import { env } from "../config/env.js";
import { agreementsService } from "../modules/agreements/agreements.service.js";
import { contributorChain } from "../modules/agreements/contributor-chain.js";
assert.equal(env.AGREEMENT_PUBLICATION_MODE,"contributors");
assert.equal(env.NODE_ENV,"development");
const source=new pg.Pool({connectionString:process.env.CONTRIBUTOR_SOURCE_DATABASE_URL});
try{
 await databaseService.initialize({repair:false});
 const selected=(await source.query("SELECT v.payload FROM contributor_agreements a JOIN agreement_versions v ON v.agreement_id=a.id AND v.version=a.current_version WHERE a.track_id=$1",["trk_da757bca79134a44"])).rows[0]?.payload;
 assert(selected,"Source demo proposal must exist");
 const p=selected.proposal;
 const existing=await agreementsService.forTrack(p.ownerWallet,p.trackId);
 const version=existing?(await agreementsService.get(existing,p.ownerWallet)).versions.at(-1)!:await agreementsService.create(p.ownerWallet,{trackId:p.trackId,recipients:p.recipients,terms:p.terms,submitForApproval:true});
 for(const wallet of version.requiredApprovers??[]){
  const response=await fetch(`https://horizon-testnet.stellar.org/accounts/${wallet}`,{signal:AbortSignal.timeout(15000)});
  if(response.status===404){const funded=await fetch(`https://friendbot.stellar.org?addr=${wallet}`,{signal:AbortSignal.timeout(30000)});assert(funded.ok,"Testnet account funding failed");}
  else assert(response.ok,"Unable to verify demo account readiness");
 }
 await contributorChain.prepare(version,p.ownerWallet,{action:"accept"});
 console.log(JSON.stringify({agreementId:version.proposal.agreementId,trackId:p.trackId,state:version.state,requiredApprovers:version.requiredApprovers,url:`http://localhost:3000/account/agreements/${version.proposal.agreementId}`},null,2));
}finally{await source.end();await databaseService.close();}
