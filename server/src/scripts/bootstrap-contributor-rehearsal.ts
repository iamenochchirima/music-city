import assert from "node:assert/strict";
import pg from "pg";
import { databaseService } from "../services/database.service.js";
import { env } from "../config/env.js";
const source=process.env.CONTRIBUTOR_SOURCE_DATABASE_URL;
assert(source,"Set the preserved local source database URL");
for(const url of [source,env.DATABASE_URL]){const target=new URL(url);assert(["127.0.0.1","localhost"].includes(target.hostname)&&target.pathname.endsWith("_test"),"Only isolated local test databases are allowed");}
assert.notEqual(source,env.DATABASE_URL);
assert.equal(env.AGREEMENT_PUBLICATION_MODE,"contributors");
const from=new pg.Pool({connectionString:source});
try{
 await databaseService.initialize({repair:false});
 await databaseService.transaction(async client=>{
  for(const table of ["users","tracks","releases","release_tracks","contributor_agreements","payment_intents","settlement_batches"]){const n=(await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`)).rows[0].n;assert.equal(n,0,`Refusing to overwrite nonempty ${table}`);}
  for(const table of ["admins","users","tracks","releases","release_tracks"]){
   const rows=(await from.query(`SELECT * FROM ${table}`)).rows;
   for(const row of rows){const columns=Object.keys(row);await client.query(`INSERT INTO ${table} (${columns.map(c=>`"${c}"`).join(",")}) VALUES(${columns.map((_,i)=>`$${i+1}`).join(",")})`,columns.map(c=>row[c]));}
   console.log(`Copied ${rows.length} ${table} records`);
  }
  // Activation grants are existing account access, not payment or royalty history.
  for (const [table, query] of [
   ["artist_sponsorship_campaigns", "SELECT c.* FROM artist_sponsorship_campaigns c WHERE EXISTS (SELECT 1 FROM artist_sponsorship_grants g WHERE g.campaign_code=c.code)"],
   ["artist_sponsorship_eligibilities", "SELECT e.* FROM artist_sponsorship_eligibilities e WHERE EXISTS (SELECT 1 FROM artist_sponsorship_grants g WHERE g.eligibility_id=e.id)"],
   ["artist_sponsorship_grants", "SELECT * FROM artist_sponsorship_grants"],
  ] as const) {
   const rows=(await from.query(query)).rows;
   for(const row of rows){const columns=Object.keys(row);await client.query(`INSERT INTO ${table} (${columns.map(c=>`"${c}"`).join(",")}) VALUES(${columns.map((_,i)=>`$${i+1}`).join(",")}) ON CONFLICT DO NOTHING`,columns.map(c=>row[c]));}
   console.log(`Preserved ${rows.length} ${table} account-access records`);
  }
  const fee=(await from.query("SELECT payload FROM app_settings WHERE key='royalty_fee_settings'")).rows[0];
  if(fee)await client.query("INSERT INTO app_settings(key,payload) VALUES('royalty_fee_settings',$1)",[fee.payload]);
 });
 console.log("Fresh rehearsal database ready; financial history and pending envelopes were not imported");
}finally{await from.end();await databaseService.close();}
