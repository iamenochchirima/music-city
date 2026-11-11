import assert from "node:assert/strict";
import { readFile,writeFile,mkdir,rename } from "node:fs/promises";
import { dirname,resolve } from "node:path";
import { randomBytes,createHash } from "node:crypto";
import { Address,Asset,BASE_FEE,Keypair,Networks,Operation,TransactionBuilder,scValToNative } from "@stellar/stellar-sdk";
import { Api,Server } from "@stellar/stellar-sdk/rpc";
const path=process.env.CONTRIBUTOR_REHEARSAL_STATE;
if(!path || resolve(path).startsWith(resolve(import.meta.dirname,"../../..")+"/"))throw new Error("Keep private rehearsal state outside the repository");
const network=Networks.TESTNET,rpc=new Server("https://soroban-testnet.stellar.org",{timeout:30000});
assert.equal((await rpc.getNetwork()).passphrase,network);
type State={secrets:string[];salts:{registry:string;settlement:string};transactions:Record<string,{xdr:string;hash:string}>;registryId?:string;contractId?:string;deploymentLedger?:number};
let state:State;
try{state=JSON.parse(await readFile(path,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;state={secrets:Array.from({length:4},()=>Keypair.random().secret()),salts:{registry:randomBytes(32).toString("hex"),settlement:randomBytes(32).toString("hex")},transactions:{}};}
async function save(){await mkdir(dirname(path!),{recursive:true});await writeFile(path+".tmp",JSON.stringify(state,null,2),{mode:0o600});await rename(path+".tmp",path!);}
await save();
const keys=state.secrets.map(s=>Keypair.fromSecret(s)),treasury=keys[0]!,registrar=keys[3]!;
for(const key of [treasury,registrar]){
 const response=await fetch(`https://horizon-testnet.stellar.org/accounts/${key.publicKey()}`);
 if(response.status===404){const funded=await fetch(`https://friendbot.stellar.org?addr=${key.publicKey()}`);if(!funded.ok)throw new Error("Friendbot funding failed");}
 else if(!response.ok)throw new Error("Unable to inspect rehearsal account");
}
async function stage(name:string,ops:Parameters<TransactionBuilder["addOperation"]>[0][],soroban=false){
 let stored=state.transactions[name];
 if(!stored){let builder=new TransactionBuilder(await rpc.getAccount(treasury.publicKey()),{fee:BASE_FEE,networkPassphrase:network});for(const op of ops)builder=builder.addOperation(op);let tx=builder.setTimeout(600).build();if(soroban)tx=await rpc.prepareTransaction(tx);tx.sign(...keys.slice(0,name === "treasuryThreshold" ? 1 : 2));stored={xdr:tx.toXDR(),hash:tx.hash().toString("hex")};state.transactions[name]=stored;await save();}
 let status=await rpc.getTransaction(stored.hash);
 if(status.status===Api.GetTransactionStatus.FAILED)throw new Error(`Retained ${name} failed; inspect ${stored.hash}`);
 if(status.status===Api.GetTransactionStatus.NOT_FOUND){const sent=await rpc.sendTransaction(TransactionBuilder.fromXDR(stored.xdr,network));if(sent.status==="ERROR")throw new Error(`${name} rejected: ${sent.errorResult?.result().switch().name}`);}
 for(let i=0;i<45 && status.status===Api.GetTransactionStatus.NOT_FOUND;i++){await new Promise(r=>setTimeout(r,1000));status=await rpc.getTransaction(stored.hash);}
 if(status.status!==Api.GetTransactionStatus.SUCCESS)throw new Error(`Retained ${name} not confirmed; resume this same state`);
 console.log(`${name}: confirmed ${stored.hash}`);return status;
}
await stage("treasuryThreshold",[Operation.setOptions({signer:{ed25519PublicKey:keys[1]!.publicKey(),weight:1}}),Operation.setOptions({signer:{ed25519PublicKey:keys[2]!.publicKey(),weight:1}}),Operation.setOptions({masterWeight:1,lowThreshold:2,medThreshold:2,highThreshold:2})]);
const issuer="GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",asset=new Asset("USDC",issuer),assetId=asset.contractId(network);
await stage("treasuryTrustline",[Operation.changeTrust({asset})]);
const root=resolve(import.meta.dirname,"../../..");
const wasm:Record<string,Buffer>={registry:await readFile(resolve(root,"contracts/target/wasm32v1-none/release/contributor_registry.wasm")),settlement:await readFile(resolve(root,"contracts/target/wasm32v1-none/release/earnings_settlement.wasm"))};
const upload=await stage("registryUpload",[Operation.uploadContractWasm({wasm:wasm.registry!})],true);
const deployed=await stage("registryDeploy",[Operation.createCustomContract({address:new Address(treasury.publicKey()),wasmHash:upload.returnValue!.bytes(),salt:Buffer.from(state.salts.registry,"hex"),constructorArgs:[new Address(treasury.publicKey()).toScVal(),new Address(registrar.publicKey()).toScVal()]})],true);
state.registryId=scValToNative(deployed.returnValue!) as string;await save();
const uploadS=await stage("settlementUpload",[Operation.uploadContractWasm({wasm:wasm.settlement!})],true);
const deployedS=await stage("settlementDeploy",[Operation.createCustomContract({address:new Address(treasury.publicKey()),wasmHash:uploadS.returnValue!.bytes(),salt:Buffer.from(state.salts.settlement,"hex"),constructorArgs:[new Address(treasury.publicKey()).toScVal(),new Address(state.registryId).toScVal(),new Address(assetId).toScVal()]})],true);
state.contractId=scValToNative(deployedS.returnValue!) as string;state.deploymentLedger=deployedS.ledger;await save();
const evidence={networkPassphrase:network,registryId:state.registryId,contractId:state.contractId,deploymentLedger:state.deploymentLedger,treasuryAddress:treasury.publicKey(),registrarAddress:registrar.publicKey(),signers:keys.slice(0,3).map(k=>k.publicKey()),assetCode:"USDC",assetIssuer:issuer,assetContractId:assetId,wasmSha256:Object.fromEntries(Object.entries(wasm).map(([k,v])=>[k,createHash("sha256").update(v).digest("hex")])),transactions:Object.fromEntries(Object.entries(state.transactions).map(([k,v])=>[k,v.hash]))};
await writeFile(path+".public.json",JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
