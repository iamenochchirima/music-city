import assert from "node:assert/strict";
import { readFile,writeFile } from "node:fs/promises";
import { randomBytes,createHash } from "node:crypto";
import {resolve} from "node:path";
import {Address,BASE_FEE,Keypair,Networks,Operation,TransactionBuilder,scValToNative} from "@stellar/stellar-sdk";
import {Api,Server} from "@stellar/stellar-sdk/rpc";
import {env} from "../config/env.js";
assert.equal(env.STELLAR_NETWORK_PASSPHRASE,Networks.TESTNET);
const file=process.env.EARNINGS_POOL_DEPLOYMENT_STATE;
assert(file && !resolve(file).startsWith(resolve(import.meta.dirname,"../../..")+"/"),"Use private resumable deployment state outside the repository");
const original=JSON.parse(await readFile(process.env.CONTRIBUTOR_REHEARSAL_STATE!,"utf8"));
assert.equal(env.SETTLEMENT_CONTRACT_ID,original.contractId);
const keys=original.secrets.slice(0,2).map((s:string)=>Keypair.fromSecret(s));
const rpc=new Server(env.STELLAR_SOROBAN_RPC_URL,{timeout:30000});
assert.equal((await rpc.getNetwork()).passphrase,Networks.TESTNET);
const wasm=await readFile(resolve(import.meta.dirname,"../../../contracts/target/wasm32v1-none/release/earnings_pool.wasm"));
type State={salt:string;wasmSha256:string;transactions:Record<string,{xdr:string;hash:string}>;contractId?:string};
let state:State;try{state=JSON.parse(await readFile(file,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;state={salt:randomBytes(32).toString("hex"),wasmSha256:createHash("sha256").update(wasm).digest("hex"),transactions:{}};}
assert.equal(state.wasmSha256,createHash("sha256").update(wasm).digest("hex"));
async function save(){await writeFile(file!,JSON.stringify(state,null,2),{mode:0o600});}await save();
async function stage(name:string,operation:Parameters<TransactionBuilder["addOperation"]>[0]) {
 let saved=state.transactions[name];
 if(!saved){const tx=await rpc.prepareTransaction(new TransactionBuilder(await rpc.getAccount(keys[0]!.publicKey()),{fee:BASE_FEE,networkPassphrase:Networks.TESTNET}).addOperation(operation).setTimeout(600).build());tx.sign(...keys);saved={xdr:tx.toXDR(),hash:tx.hash().toString("hex")};state.transactions[name]=saved;await save();}
 let result=await rpc.getTransaction(saved.hash);
 if(result.status===Api.GetTransactionStatus.NOT_FOUND){const sent=await rpc.sendTransaction(TransactionBuilder.fromXDR(saved.xdr,Networks.TESTNET));assert.notEqual(sent.status,"ERROR");}
 for(let i=0;i<40&&result.status===Api.GetTransactionStatus.NOT_FOUND;i++){await new Promise(r=>setTimeout(r,1000));result=await rpc.getTransaction(saved.hash);}
 assert.equal(result.status,Api.GetTransactionStatus.SUCCESS,`Resume the same retained ${name} transaction`);
 return result as Api.GetSuccessfulTransactionResponse;
}
const {databaseService}=await import("../services/database.service.js");
const {royaltiesService}=await import("../modules/royalties/royalties.service.js");
await databaseService.initialize({repair:false});
const feeBps=(await royaltiesService.getFeeSettings()).trackPurchaseFeeBps;
await databaseService.close();
const {Asset,nativeToScVal}=await import("@stellar/stellar-sdk");
const upload=await stage("upload",Operation.uploadContractWasm({wasm}));
const deployed=await stage("deploy",Operation.createCustomContract({address:new Address(keys[0]!.publicKey()),wasmHash:upload.returnValue!.bytes(),salt:Buffer.from(state.salt,"hex"),constructorArgs:[new Address(keys[0]!.publicKey()).toScVal(),new Address(original.registryId).toScVal(),new Address(new Asset(env.STELLAR_SETTLEMENT_ASSET_CODE,env.STELLAR_SETTLEMENT_ASSET_ISSUER).contractId(Networks.TESTNET)).toScVal(),nativeToScVal(feeBps,{type:"u32"})]}));
state.contractId=scValToNative(deployed.returnValue!) as string;await save();
const evidence={contractId:state.contractId,registryId:original.registryId,treasuryAddress:keys[0]!.publicKey(),feeBps,networkPassphrase:Networks.TESTNET,wasmSha256:state.wasmSha256,ledger:deployed.ledger,transactions:Object.fromEntries(Object.entries(state.transactions).map(([k,v])=>[k,v.hash]))};
await writeFile(file+".public.json",JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
