import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import {adminPoolRouter} from "./pool.router.js";
import {poolService} from "./pool.service.js";
import {tokenService} from "../../services/token.service.js";
import {env} from "../../config/env.js";
import {HttpError} from "../../utils/http-error.js";
test("pool treasury writes require super admin and use server-derived actors",async()=>{
 const app=express();app.use(express.json());app.use("/pool",adminPoolRouter);app.use((e:Error,_q:express.Request,r:express.Response,_n:express.NextFunction)=>r.status(e instanceof HttpError?e.statusCode:500).json({error:e.message}));
 const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));const address=server.address();assert(address&&typeof address!=="string");const port=address.port;
 const original={...poolService},id=env.EARNINGS_POOL_CONTRACT_ID;const actors:string[]=[];env.EARNINGS_POOL_CONTRACT_ID="configured";
 poolService.report=async()=>({} as never);poolService.attempts=async()=>[];poolService.prepare=async(actor)=>{actors.push(actor);return {} as never;};poolService.addSignature=async(_id,actor)=>{actors.push(actor);return {} as never;};poolService.submit=async(_id,actor)=>{actors.push(actor);return {} as never;};
 const reader=tokenService.issueAdminSession({adminId:"reader",email:"reader@example.test",name:"Reader",role:"admin"}),operator=tokenService.issueAdminSession({adminId:"operator",email:"operator@example.test",name:"Operator",role:"super_admin"});
 async function request(path:string,token?:string,body?:object){return fetch(`http://127.0.0.1:${port}/pool${path}`,{method:body?"POST":"GET",headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});}
 try{
  assert.equal((await request("")).status,401);assert.equal((await request("",reader)).status,200);
  for(const [path,body] of [["/prepare",{action:"top_up",amount:"10"}],["/attempts/attempt/signatures",{signedTransaction:"signed"}],["/attempts/attempt/submit",{}]] as const){assert.equal((await request(path,undefined,body)).status,401);assert.equal((await request(path,reader,body)).status,403);assert.equal(actors.length,0);assert([200,201].includes((await request(path,operator,body)).status));assert.equal(actors.pop(),"admin:operator");}
 }finally{Object.assign(poolService,original);env.EARNINGS_POOL_CONTRACT_ID=id;await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()));}
});
