import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Address, Asset, BASE_FEE, Contract, Keypair, Networks, Operation, TransactionBuilder, scValToNative } from "@stellar/stellar-sdk";
import { Api, Server } from "@stellar/stellar-sdk/rpc";
import { type TreasuryAccount, verifyTreasuryConfiguration } from "../modules/agreements/treasury-signatures.js";

const root=resolve(import.meta.dirname,"../../..");
const signerPath=process.env.SETTLEMENTS_SIGNER_STATE_PATH,statePath=process.env.SETTLEMENTS_DEPLOY_STATE_PATH;
if(!signerPath||!statePath)throw new Error("Set private SETTLEMENTS_SIGNER_STATE_PATH and SETTLEMENTS_DEPLOY_STATE_PATH");
for(const path of [signerPath,statePath])if(resolve(path).startsWith(root+"/"))throw new Error("Keep signing and resumable deployment state outside the repository");
const source=JSON.parse(await readFile(signerPath,"utf8")) as {secrets:string[]};
const keys=source.secrets.slice(0,3).map(secret=>Keypair.fromSecret(secret));assert.equal(keys.length,3);
const treasury=keys[0]!.publicKey(),network=Networks.TESTNET;
const rpc=new Server("https://soroban-testnet.stellar.org",{timeout:30000});
assert.equal((await rpc.getNetwork()).passphrase,network);
const accountResponse=await fetch(`https://horizon-testnet.stellar.org/accounts/${treasury}`,{signal:AbortSignal.timeout(15000)});if(!accountResponse.ok)throw new Error("Cannot verify deployment treasury");
const treasuryAccount=await accountResponse.json() as TreasuryAccount;
assert.deepEqual(verifyTreasuryConfiguration(treasuryAccount,treasury),keys.map(k=>k.publicKey()).sort());
type State={treasury:string;salts:{registry:string;settlement:string};transactions:Record<string,{xdr:string;hash:string}>};
let state:State;
try{state=JSON.parse(await readFile(statePath,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;state={treasury,salts:{registry:randomBytes(32).toString("hex"),settlement:randomBytes(32).toString("hex")},transactions:{}};}
assert.equal(state.treasury,treasury);
const transactions:Record<string,{transactionHash:string;ledger:number;explorerUrl:string}>={};
async function save(){await mkdir(dirname(statePath!),{recursive:true});await writeFile(statePath+".tmp",JSON.stringify(state,null,2),{mode:0o600});await rename(statePath+".tmp",statePath!);}
await save();
async function stage(name:string,operation:Parameters<TransactionBuilder["addOperation"]>[0]){
 let stored=state.transactions[name];
 if(!stored){const tx=await rpc.prepareTransaction(new TransactionBuilder(await rpc.getAccount(treasury),{fee:BASE_FEE,networkPassphrase:network}).addOperation(operation).setTimeout(600).build());tx.sign(keys[0]!,keys[1]!);stored={xdr:tx.toXDR(),hash:tx.hash().toString("hex")};state.transactions[name]=stored;await save();}
 let result=await rpc.getTransaction(stored.hash);
 if(result.status!==Api.GetTransactionStatus.SUCCESS){
  if(result.status===Api.GetTransactionStatus.FAILED)throw new Error(`Recorded deployment failed. Inspect ${stored.hash}`);
  const sent=await rpc.sendTransaction(TransactionBuilder.fromXDR(stored.xdr,network));
  if(sent.status==="ERROR")throw new Error(`Deployment rejected; reconcile the persisted original ${stored.hash}: ${sent.errorResult?.result().switch().name}`);
  for(let attempt=0;attempt<30;attempt++){await new Promise(r=>setTimeout(r,2000));result=await rpc.getTransaction(stored.hash);if(result.status===Api.GetTransactionStatus.SUCCESS)break;if(result.status===Api.GetTransactionStatus.FAILED)throw new Error(`Deployment failed ${stored.hash}`);}
 }
 if(result.status!==Api.GetTransactionStatus.SUCCESS)throw new Error(`Deployment outcome unknown. Resume the same state for ${stored.hash}`);
 transactions[name]={transactionHash:stored.hash,ledger:result.ledger,explorerUrl:`https://stellar.expert/explorer/testnet/tx/${stored.hash}`};console.log(`${name}: confirmed ${stored.hash}`);return result;
}
const registryWasm=await readFile(resolve(root,"contracts/target/wasm32v1-none/release/royalty_split_registry.wasm"));
const settlementWasm=await readFile(resolve(root,"contracts/target/wasm32v1-none/release/earnings_settlement.wasm"));
const registryUpload=await stage("registryUpload",Operation.uploadContractWasm({wasm:registryWasm}));
const settlementUpload=await stage("settlementUpload",Operation.uploadContractWasm({wasm:settlementWasm}));
const hashes={registry:createHash("sha256").update(registryWasm).digest("hex"),settlement:createHash("sha256").update(settlementWasm).digest("hex")};
assert.equal(registryUpload.returnValue!.bytes().toString("hex"),hashes.registry);assert.equal(settlementUpload.returnValue!.bytes().toString("hex"),hashes.settlement);
const registryDeployment=await stage("registryDeployment",Operation.createCustomContract({address:Address.fromString(treasury),wasmHash:registryUpload.returnValue!.bytes(),salt:Buffer.from(state.salts.registry,"hex"),constructorArgs:[new Address(treasury).toScVal()]}));
const registryId=scValToNative(registryDeployment.returnValue!) as string;
const issuer="GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",assetId=new Asset("USDC",issuer).contractId(network);
const settlementDeployment=await stage("settlementDeployment",Operation.createCustomContract({address:Address.fromString(treasury),wasmHash:settlementUpload.returnValue!.bytes(),salt:Buffer.from(state.salts.settlement,"hex"),constructorArgs:[new Address(treasury).toScVal(),new Address(registryId).toScVal(),new Address(assetId).toScVal()]}));
const contractId=scValToNative(settlementDeployment.returnValue!) as string;
const instance=await rpc.getLedgerEntries(new Contract(contractId).getFootprint());assert.equal(instance.entries[0]?.lastModifiedLedgerSeq,settlementDeployment.ledger);
const result={status:"contracts_deployed_application_rollout_pending",verifiedAt:new Date().toISOString(),environment:"Railway production, Stellar Testnet",networkPassphrase:network,treasuryAddress:treasury,registryId,contractId,assetCode:"USDC",assetIssuer:issuer,assetContractId:assetId,deploymentLedger:settlementDeployment.ledger,wasmSha256:hashes,treasury:treasuryAccount,syntheticEarningsImported:false,transactions};
const evidence=resolve(root,"docs/settlement-evidence/live-contracts.json");await mkdir(dirname(evidence),{recursive:true});await writeFile(evidence,JSON.stringify(result,null,2)+"\n");console.log(`Public deployment evidence: ${evidence}`);
