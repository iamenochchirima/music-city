import {useAdminWallet} from "@/features/wallet/use-admin-wallet";
import {useCallback, useEffect, useState} from "react";
import type {PoolAttempt} from "@music-city/shared";
import {httpClient} from "@/lib/api/http-client";
import {Button} from "@/components/ui/button";

const money = (value:string) => {
  const n = BigInt(value);
  const fraction = (n % 10000000n).toString().padStart(7,"0").replace(/0+$/,"");
  return `${n/10000000n}${fraction ? `.${fraction}` : ""}`;
};
const shortAddress = (address:string) => `${address.slice(0,6)}…${address.slice(-5)}`;
type Report = {balanceUnits:string; outstandingUnits:string; surplusUnits:string; claimedUnits:string; feeUnits:string; ok:boolean; errors:string[]; feeBps:number; contractId:string};
const activeStatuses = ["awaiting_signatures","submitting","submitted"];

export function PoolPanel({token,canOperate,onEnabledChange}:{token:string; canOperate:boolean; onEnabledChange:(v:boolean)=>void}) {
  const wallet = useAdminWallet(token);
  const [data,setData] = useState<{enabled:boolean; acceptingPurchases?:boolean; report:Report|null; attempts:PoolAttempt[]}|null>(null);
  const [treasury,setTreasury] = useState<{balanceUnits:string}|null>(null);
  const [error,setError] = useState<string|null>(null);
  const [busy,setBusy] = useState(false);
  const [showForm,setShowForm] = useState(false);
  const [amount,setAmount] = useState("10");
  const [action,setAction] = useState<"top_up"|"return_surplus">("top_up");
  const load = useCallback(async()=>{
    const [result,treasuryBalance] = await Promise.all([
      httpClient.get<NonNullable<typeof data>>("/pool",token),
      httpClient.get<{balanceUnits:string}>("/pool/treasury",token).catch(()=>null),
    ]);
    setTreasury(treasuryBalance);
    setData(result); onEnabledChange(result.acceptingPurchases??result.enabled);
  },[token,onEnabledChange]);
  useEffect(()=>{
    void load().catch(e=>setError(e.message));
    const timer = setInterval(()=>void load().catch(e=>setError(e.message)),10000);
    return ()=>clearInterval(timer);
  },[load]);
  async function work(fn:()=>Promise<void>) {
    setBusy(true); setError(null);
    try {await fn(); await load();}
    catch(e) {setError(e instanceof Error ? e.message : "Pool action failed");}
    finally {setBusy(false);}
  }
  if (!data?.enabled && !error) return null;
  const report = data?.report;
  const attempts = data?.attempts.filter(a=>a.kind!=="claim")??[];
  const pending = attempts.filter(a=>activeStatuses.includes(a.status));
  const history = attempts.filter(a=>!activeStatuses.includes(a.status));
  const disabled = busy || wallet.busy;

  function transaction(a:PoolAttempt) {
    return <article key={a.id} className="space-y-3 border-t border-white/10 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{a.poolAction==="top_up" ? "Pool top-up" : "Return unused funds"} · {money(a.amountUnits)} USDC</h3>
        <p className="text-sm text-slate-400">{a.status==="awaiting_signatures" ? `${a.signedBy.length}/2 signatures` : a.status.replaceAll("_"," ")}</p>
      </div>
      {activeStatuses.includes(a.status) && a.error && <p role="alert" className="text-sm text-amber-200">{a.error}</p>}
      {canOperate && a.status==="awaiting_signatures" && <div className="flex flex-wrap items-center gap-3">
        {a.signedBy.includes(wallet.status?.walletAddress??"") ? <p className="text-sm text-slate-400">You have signed.</p> :
          <Button disabled={disabled || !wallet.status?.eligible || !a.signers?.includes(wallet.status.walletAddress??"")} onClick={()=>void work(()=>wallet.signAttempt(a.id))}>Sign with connected wallet</Button>}
        <Button variant="outline" disabled={disabled || a.signedBy.length<2} onClick={()=>void work(async()=>{await httpClient.post(`/pool/attempts/${a.id}/submit`,{},token);})}>Submit pool transaction</Button>
      </div>}
      <details className="text-sm text-slate-400">
        <summary className="cursor-pointer w-fit rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">Transaction details</summary>
        <div className="mt-3 space-y-2">
          <p>{a.signedBy.length}/2 signatures</p>
          <ul className="space-y-1">{a.signatureApprovals?.map(approval=><li key={approval.signerWallet}>Signature added by {approval.actorName} · <span title={approval.signerWallet}>{shortAddress(approval.signerWallet)}</span></li>)}</ul>
          {!activeStatuses.includes(a.status) && a.error && <p>{a.error}</p>}
          <p className="break-all font-mono text-xs">{a.transactionHash}</p>
          {a.status==="confirmed" && <a className="inline-block text-emerald-300 underline" target="_blank" rel="noreferrer" href={`https://stellar.expert/explorer/${a.networkPassphrase.includes("Test SDF") ? "testnet" : "public"}/tx/${a.transactionHash}`}>View confirmed transaction</a>}
        </div>
      </details>
    </article>;
  }

  return <section aria-label="Prefunded pool" className="space-y-6 rounded-xl border border-white/10 p-5 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Earnings pool</h2>
      {canOperate && <Button variant="outline" aria-expanded={showForm} onClick={()=>setShowForm(v=>!v)}>Manage funds</Button>}
    </div>
    {data?.acceptingPurchases===false && <p className="text-sm text-amber-200">New purchases use settlement funding. Existing pool earnings remain claimable.</p>}
    {report && <>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4">
        {[["Treasury balance",treasury?.balanceUnits],["Pool balance",report.balanceUnits],["Reserved earnings",report.outstandingUnits],["Pool available",report.surplusUnits]].map(([label,value])=><div key={label} className="min-w-0"><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-1 break-words text-lg font-medium md:text-2xl">{value===undefined ? <span className="text-sm text-slate-400">Unavailable</span> : <>{money(value)} <span className="text-xs font-normal text-slate-400">USDC</span></>}</dd></div>)}
      </dl>
      {!report.ok && <div role="alert" className="space-y-1 text-sm text-amber-200"><p>Pool needs attention</p>{report.errors.map(e=><p key={e}>{e}</p>)}</div>}
    </>}
    {canOperate && <section aria-label="Your treasury wallet" className="border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm"><h3 className="font-medium">Signing wallet</h3>
          <p className="mt-1 break-words text-slate-400">{wallet.connectedAddress ? <span title={wallet.connectedAddress}>{wallet.connectedEmail??shortAddress(wallet.connectedAddress)}</span> : "Connect your wallet to approve transactions."}</p>
        </div>
        {!wallet.connectedAddress ? <Button disabled={disabled} onClick={()=>void work(async()=>wallet.connect())}>Sign in to wallet</Button> : !wallet.status?.walletAddress ? <Button disabled={disabled} onClick={()=>void work(wallet.link)}>Link wallet</Button> : <span className={`text-sm ${wallet.status.eligible ? "text-emerald-300" : "text-amber-200"}`}>{wallet.status.eligible ? "Ready to sign" : "Treasury authorization required"}</span>}
      </div>
      {wallet.busy && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><p role="status">Waiting for your wallet…</p><Button variant="outline" onClick={wallet.cancel}>Cancel wallet request</Button></div>}
      {wallet.connectedAddress && <details className="mt-3 text-sm text-slate-400"><summary className="w-fit cursor-pointer">Wallet settings</summary><div className="mt-3 space-y-3"><p className="break-all">Connected: {wallet.connectedAddress}</p>{wallet.status?.walletAddress && <p className="break-all">Linked: {wallet.status.walletAddress}</p>}<div className="flex flex-wrap gap-3"><Button variant="outline" disabled={disabled} onClick={()=>void work(wallet.switchWallet)}>Switch wallet account</Button><Button variant="outline" disabled={disabled} onClick={()=>void work(wallet.refresh)}>Refresh wallet status</Button></div></div></details>}
    </section>}
    {(error || wallet.error) && <p role="alert" className="text-sm text-red-200">{error??wallet.error}</p>}
    {canOperate && showForm && <form className="flex flex-wrap items-end gap-3 border-t border-white/10 pt-4" onSubmit={e=>{e.preventDefault();void work(async()=>{await httpClient.post("/pool/prepare",{action,amount},token);setShowForm(false);});}}>
      <label className="grid gap-2 text-sm">Action<select className="min-w-0 rounded border border-white/10 bg-[#0b1220] p-2" value={action} onChange={e=>setAction(e.target.value as typeof action)}><option value="top_up">Top up pool</option><option value="return_surplus">Return unused funds</option></select></label>
      <label className="grid gap-2 text-sm">Amount, USDC<input className="w-36 max-w-full rounded border border-white/10 bg-[#0b1220] p-2" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
      <Button type="submit" disabled={disabled}>Prepare pool transaction</Button>
      <p className="w-full text-xs text-slate-400">Requires two wallet signatures. Reserved earnings cannot be returned.</p>
    </form>}
    <section aria-label="Pending approvals">
      <h3 className="text-sm font-medium">Pending approvals{pending.length ? ` · ${pending.length}` : ""}</h3>
      {pending.length ? <div className="mt-3">{pending.map(transaction)}</div> : <p className="mt-2 text-sm text-slate-400">No transactions waiting for approval.</p>}
    </section>
    <div className="space-y-3 border-t border-white/10 pt-4 text-sm text-slate-400">
      <details><summary className="w-fit cursor-pointer">Pool activity · {history.length}</summary><div className="mt-3 text-slate-100">{history.length ? history.map(transaction) : <p>No past transactions.</p>}</div></details>
      {report && <details><summary className="w-fit cursor-pointer">Pool details</summary><dl className="mt-3 grid grid-cols-2 gap-3"><div><dt>Total claimed</dt><dd className="mt-1 text-slate-100">{money(report.claimedUnits)} USDC</dd></div><div><dt>Purchase fee</dt><dd className="mt-1 text-slate-100">{report.feeBps/100}%</dd></div><div><dt>Fees sent to treasury</dt><dd className="mt-1 text-slate-100">{money(report.feeUnits)} USDC</dd></div><div><dt>Reconciliation</dt><dd className="mt-1 text-slate-100">{report.ok ? "Reconciled" : "Needs attention"}</dd></div></dl></details>}
    </div>
  </section>;
}
