import { useCallback, useEffect, useState } from "react";
import type { AgreementVersion, AgreementFinalization } from "@music-city/shared";
import { useAdminAuth } from "@/features/auth/providers/admin-auth-provider";
import { httpClient } from "@/lib/api/http-client";
import { Button } from "@/components/ui/button";

type Summary = { id: string; effectiveVersion: number | null; current: AgreementVersion };
type Detail = { id: string; currentVersion: number; effectiveVersion: number | null; versions: AgreementVersion[]; finalizations: AgreementFinalization[]; events: { id: string; action: string; version: number; created_at: string; actor_wallet: string; payload: Record<string, unknown> }[] };
const panel = "rounded-xl border border-white/10 bg-[#0f1728] p-5";
export function AdminAgreementsPage() {
  const { session } = useAdminAuth();
  const [items,setItems] = useState<Summary[]>([]);
  const [detail,setDetail] = useState<Detail | null>(null);
  const [signedXdr,setSignedXdr] = useState("");
  const [resolution,setResolution] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string | null>(null);
  const [loading,setLoading] = useState(true);
  const token = session?.token;
  const canFinalize = session?.role === "super_admin";
  const current = detail?.versions.find(v => v.proposal.version === detail.currentVersion);
  const attempts = detail?.finalizations.filter(a => a.version === detail.currentVersion) ?? [];
  const attempt = attempts.find(a => ["awaiting_signatures","submitting","submitted","confirmed"].includes(a.status));
  const load = useCallback(async (id?: string) => {
    if (!token) return;
    const response = await httpClient.get<{ items: Summary[] }>("/agreements",token);
    setItems(response.items);
    if (id) setDetail(await httpClient.get<Detail>(`/agreements/${id}`,token));
  },[token]);
  useEffect(() => {
    let active = true;
    setDetail(null); setLoading(true); setError(null);
    load().catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load agreements"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  },[load]);
  async function run(work: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await work(); } catch(e) { setError(e instanceof Error ? e.message : "Agreement action failed"); }
    finally { setBusy(false); }
  }
  async function action(path: string,body: unknown = {}) {
    await run(async () => { await httpClient.post(path,body,token); await load(detail!.id); setSignedXdr(""); setResolution(""); });
  }
  function downloadTransaction() {
    if (!attempt) return;
    const url = URL.createObjectURL(new Blob([attempt.transaction],{ type: "text/plain" }));
    const link = document.createElement("a"); link.href = url; link.download = `agreement-v${attempt.version}-${attempt.transactionHash}.xdr`; link.click(); URL.revokeObjectURL(url);
  }
  return <div className="space-y-6 p-4 text-slate-100 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Contributor agreements</h1><p className="mt-2 text-slate-400">Review contributor consent and finalize the exact proposal with two treasury signers.</p></div><Button disabled={busy} onClick={() => run(() => load(detail?.id))}>Refresh</Button></div>
    {error && <p role="alert" className="rounded-lg border border-red-400/30 p-4 text-red-200">{error}</p>}
    {detail ? <Button variant="outline" disabled={busy} onClick={() => { setDetail(null); setSignedXdr(""); }}>Back to agreements</Button> : loading ? <p role="status">Loading agreements…</p> : <div className="grid gap-3 md:grid-cols-2">{items.map(item => <button key={item.id} disabled={busy} onClick={() => run(async () => { await load(item.id); setSignedXdr(""); })} className={`${panel} text-left hover:border-emerald-400/50`}><p className="break-all">Track {item.current.proposal.trackId}</p><p className="mt-2 capitalize text-emerald-300">Version {item.current.proposal.version} · {item.current.state}</p><p className="text-sm text-slate-400">Effective version: {item.effectiveVersion ?? "None"}</p></button>)}{!items.length && <p>No contributor agreements yet.</p>}</div>}
    {detail && current && <section className={`${panel} space-y-5`}>
      <h2 className="text-xl font-semibold">Review version {current.proposal.version} · {current.state}</h2>
      <dl className="space-y-2 text-sm"><div><dt className="text-slate-400">Track / release</dt><dd className="break-all">{current.proposal.trackId} / {current.proposal.releaseId ?? "Track agreement"}</dd></div><div><dt className="text-slate-400">Proposal hash</dt><dd className="break-all font-mono">{current.proposalHash}</dd></div><div><dt className="text-slate-400">Network</dt><dd>{current.proposal.networkPassphrase}</dd></div></dl>
      <ul className="space-y-3">{current.proposal.recipients.map(r => <li key={r.walletAddress} className="rounded-lg bg-white/5 p-3"><p className="break-all font-mono text-sm">{r.walletAddress}</p><p>{(r.shareBps/100).toFixed(2)}% · {r.role.replaceAll("_"," ")}</p><p className="text-sm text-slate-400">{current.responses.filter(response => response.walletAddress === r.walletAddress).map(response => `${response.action}${response.reason ? `: ${response.reason}` : ""}`).join(" → ") || "Awaiting response"}</p></li>)}</ul>
      <div><h3 className="font-semibold">Terms</h3><p className="whitespace-pre-wrap">{current.proposal.terms || "No additional terms"}</p></div>
      {["rejected","disputed"].includes(current.state) && <p className="text-amber-200">This version is blocked. A recorded resolution and a revised proposal with fresh contributor signatures are required.</p>}
      {canFinalize && ["rejected","disputed"].includes(current.state) && <div className="space-y-3 rounded-lg border border-amber-300/20 p-4"><label className="block">Resolution explanation<textarea value={resolution} onChange={e => setResolution(e.target.value)} maxLength={1000} className="mt-2 min-h-24 w-full rounded border border-white/10 bg-slate-950 p-3 text-sm" /></label><p className="text-sm text-slate-400">Recording a resolution preserves this blocked version and creates a new draft. The owner must review, edit as needed and submit it; every contributor must sign again.</p><Button disabled={busy || !resolution.trim()} onClick={() => action(`/agreements/${detail.id}/resolutions`,{ resolution })}>Record resolution and create revised draft</Button></div>}
      {canFinalize && current.state === "ready" && !attempt && <Button disabled={busy} onClick={() => action(`/agreements/${detail.id}/finalizations`)}>Prepare treasury finalization</Button>}
      {!canFinalize && <p className="text-slate-400">Super admin access is required to operate finalization.</p>}
      {attempt && <section className="space-y-4 rounded-lg border border-emerald-400/20 p-4">
        <h3 className="font-semibold">Treasury finalization · {attempt.status.replaceAll("_"," ")}</h3>
        <dl className="space-y-2 text-sm"><div><dt>Treasury</dt><dd className="break-all font-mono">{attempt.treasuryAddress}</dd></div><div><dt>Registry</dt><dd className="break-all font-mono">{attempt.contractId}</dd></div><div><dt>Transaction hash</dt><dd className="break-all font-mono">{attempt.transactionHash}</dd></div><div><dt>Expires</dt><dd>{new Date(attempt.expiresAt).toLocaleString()}</dd></div></dl>
        <ul className="space-y-2 text-sm">{attempt.signers.map(signer => <li key={signer} className="break-all font-mono">{attempt.signedBy.includes(signer) ? "Signed" : attempt.status === "confirmed" ? "Did not sign" : "Awaiting signature"}: {signer}</li>)}</ul>
        {attempt.error && <p className="text-amber-200">{attempt.error}</p>}
        {attempt.status === "awaiting_signatures" && canFinalize && <>
          <p className="text-sm text-slate-300">Each treasury signer must review the proposal, network, registry and transaction hash, then sign this same transaction in their Stellar wallet. Signing alone does not submit it. Paste each signed envelope below; two independent signatures are required.</p>
          <Button variant="outline" onClick={downloadTransaction}>Download transaction for signing</Button>
          <details><summary>Prepared transaction XDR</summary><textarea readOnly aria-label="Prepared transaction XDR" value={attempt.transaction} className="mt-2 min-h-28 w-full rounded border border-white/10 bg-slate-950 p-3 font-mono text-xs" /></details>
          <label className="block text-sm">Signed transaction XDR<textarea value={signedXdr} onChange={e => setSignedXdr(e.target.value)} className="mt-2 min-h-28 w-full rounded border border-white/10 bg-slate-950 p-3 font-mono text-xs" /></label>
          <div className="flex flex-wrap gap-3"><Button disabled={busy || !signedXdr.trim()} onClick={() => action(`/agreements/${detail.id}/finalizations/${attempt.id}/signatures`,{ signedTransaction: signedXdr.trim() })}>Add verified signature</Button><Button disabled={busy || attempt.signedBy.length < 2 || Date.parse(attempt.expiresAt) <= Date.now()} onClick={() => action(`/agreements/${detail.id}/finalizations/${attempt.id}/submit`)}>Submit with {attempt.signedBy.length} signatures</Button></div>
        </>}
        {canFinalize && ["awaiting_signatures","submitting","submitted"].includes(attempt.status) && <Button disabled={busy} variant="outline" onClick={() => action(`/agreements/${detail.id}/finalizations/${attempt.id}/reconcile`)}>Check transaction outcome</Button>}
        {attempt.status === "confirmed" && attempt.explorerUrl && <a className="text-emerald-300 underline" href={attempt.explorerUrl} target="_blank" rel="noreferrer">View confirmed publication · ledger {attempt.ledger}</a>}
      </section>}
      <details><summary>Version, transaction and action history</summary><div className="mt-3 space-y-4">{detail.versions.map(v => <section key={v.proposal.version}><h3 className="font-semibold">Version {v.proposal.version} · {v.state}</h3><p className="break-all font-mono text-xs">{v.proposalHash}</p><p className="whitespace-pre-wrap">{v.proposal.terms}</p><ul className="text-sm">{v.proposal.recipients.map(r => <li key={r.walletAddress} className="break-all">{r.walletAddress} · {r.role} · {(r.shareBps/100).toFixed(2)}%<p className="text-slate-400">{v.responses.filter(response => response.walletAddress === r.walletAddress).map(response => `${response.action}${response.reason ? `: ${response.reason}` : ""}`).join(" → ") || "Awaiting response"}</p></li>)}</ul></section>)}{detail.finalizations.map(a => <p key={a.id} className="break-all text-sm">Version {a.version} · {a.status} · {a.transactionHash}</p>)}{detail.events.map(e => <div key={e.id} className="text-sm"><p>{new Date(e.created_at).toLocaleString()} · v{e.version} · {e.action.replaceAll("_"," ")}</p><p className="break-all text-xs text-slate-400">Actor: {e.actor_wallet}</p>{typeof e.payload.reason === "string" && <p>{e.payload.reason}</p>}{typeof e.payload.resolution === "string" && <p>{e.payload.resolution}</p>}</div>)}</div></details>
    </section>}
  </div>;
}
