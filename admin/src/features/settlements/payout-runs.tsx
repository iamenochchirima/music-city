import { useEffect, useState } from "react";
import type { PayoutRun } from "@music-city/shared";
import { httpClient } from "@/lib/api/http-client";
import { Button } from "@/components/ui/button";
type Source = {trackId:string;sourceType:string;sourceId:string;allocations:number};
const money=(units:string)=>`${(BigInt(units)/10000000n)}.${(BigInt(units)%10000000n).toString().padStart(7,"0")}`;
const key=(s:Source)=>`${s.trackId}:${s.sourceType}:${s.sourceId}`;
export function PayoutRuns({token,sources,onOpen}:{token:string;sources:Source[];onOpen:(id:string)=>Promise<void>}) {
 const [selected,setSelected]=useState<string[]>([]),[expiry,setExpiry]=useState(()=>new Date(Date.now()+86400000).toISOString().slice(0,16));
 const [preview,setPreview]=useState<PayoutRun|null>(null),[runs,setRuns]=useState<PayoutRun[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 async function load(){const result=await httpClient.get<{items:PayoutRun[]}>("/settlements/runs",token);setRuns(result.items);}
 useEffect(()=>{void load().catch(e=>setError(e.message));},[token]);
 async function work(fn:()=>Promise<void>){setBusy(true);setError(null);try{await fn();}catch(e){setError(e instanceof Error?e.message:"Payout run failed");}finally{setBusy(false);}}
 const input=()=>({sources:sources.filter(s=>selected.includes(key(s))).map(({trackId,sourceType,sourceId})=>({trackId,sourceType,sourceId})),expiresAt:new Date(`${expiry}:00Z`).toISOString()});
 const recipients=new Map<string,bigint>();for(const b of preview?.batches??[])for(const a of b.allocations)recipients.set(a.beneficiary,(recipients.get(a.beneficiary)??0n)+BigInt(a.amountUnits));
 return <section aria-label="Payout runs" className="space-y-4 rounded-xl border border-white/10 p-5">
  <h2 className="text-lg font-semibold">Fund multiple earnings</h2>
  <p className="text-sm text-slate-400">Select up to 10 earnings sources across songs. Two treasury signatures fund the entire run in one transaction. Every source keeps its captured split and fees.</p>
  {error&&<p role="alert" className="text-red-200">{error}</p>}
  {!sources.length&&<p>No approved, unreserved earnings sources.</p>}
  {sources.map(s=><label key={key(s)} className="flex items-start gap-3 rounded-lg border border-white/10 p-3 text-sm">
   <input type="checkbox" checked={selected.includes(key(s))} disabled={busy||(!selected.includes(key(s))&&selected.length>=10)} onChange={e=>{setSelected(v=>e.target.checked?[...v,key(s)]:v.filter(k=>k!==key(s)));setPreview(null);}} />
   <span className="break-all">{s.sourceType.replaceAll("_"," ")} · {s.trackId} · {s.sourceId}<span className="block text-slate-400">{s.allocations} allocations</span></span>
  </label>)}
  {!!selected.length&&<>
   <p>{selected.length} sources selected</p>
   <label className="block text-sm">Claim deadline, UTC <input type="datetime-local" value={expiry} disabled={busy} onChange={e=>{setExpiry(e.target.value);setPreview(null);}} className="rounded bg-black/20 p-2" /></label>
   <Button disabled={busy} onClick={()=>void work(async()=>{const r=await httpClient.post<{run:PayoutRun}>("/settlements/runs/preview",input(),token);setPreview(r.run);})}>Review payout run</Button>
  </>}
  {preview&&<div className="space-y-3 border-t border-white/10 pt-4">
   <h3 className="font-semibold">{money(preview.fundedUnits)} USDC total · {preview.batches.length} earnings sources</h3>
   <p className="text-sm text-slate-400">Contributor totals for this run. Claims remain linked to each earnings source.</p>
   {[...recipients].map(([wallet,amount])=><p key={wallet} className="break-all text-sm">{money(amount.toString())} USDC → {wallet}</p>)}
   <details><summary>Source amounts and captured agreements</summary>{preview.batches.map(b=><p key={b.id} className="break-all text-sm">{b.trackId} · {b.sourceId} · agreement v{b.version} · {money(b.fundedUnits)} USDC net · fee {b.feeBps/100}%</p>)}</details>
   <Button disabled={busy} onClick={()=>void work(async()=>{await httpClient.post("/settlements/runs/reserve",{previewId:preview.id,source:input()},token);setPreview(null);setSelected([]);await load();await onOpen(preview.batches[0]!.id);})}>Reserve payout run</Button>
  </div>}
  {!!runs.length&&<div className="space-y-2 border-t border-white/10 pt-4"><h3 className="font-semibold">Payout run history</h3>{runs.map(run=><Button key={run.id} variant="outline" disabled={busy} onClick={()=>void work(()=>onOpen(run.batches[0]!.id))}>{money(run.fundedUnits)} USDC · {run.batches.length} sources · {run.id.slice(0,8)}</Button>)}</div>}
 </section>;
}
