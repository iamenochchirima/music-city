import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useDynamicContext, useUserWallets } from "@dynamic-labs/sdk-react-core";
import { agreementTermsSchema, royaltyRecipientRoleSchema, type AgreementAction, type AgreementVersion, type AgreementFinalization, type TrackSummary } from "@music-city/shared";
import { useAuth } from "@/hooks/use-auth";
import { httpClient } from "@/lib/api/http-client";
import { clientEnv } from "@/lib/config/env";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { ensureActiveStellarAccount, resolveStellarWallet } from "@/features/wallet/lib/resolve-stellar-wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Summary = { id: string; effectiveVersion: number | null; current: AgreementVersion };
type Detail = { id: string; effectiveVersion: number | null; currentVersion: number; versions: AgreementVersion[]; finalizations: AgreementFinalization[]; events: { id: string; version: number; action: string; actor_wallet: string; created_at: string; payload: { resolution?: string; reason?: string } }[] };
type RecipientInput = { walletAddress: string; role: "artist" | "producer" | "writer" | "featured_artist" | "label" | "platform" | "other"; percentage: string };
const inputStyle = "rounded-lg border border-white/15 bg-slate-950 p-3 text-sm text-white";
const stateLabel = (state: string) => state === "ready" ? "Ready for treasury finalization" : state.replaceAll("_", " ");

export function AgreementsOverview() {
  const { session, error: authError } = useAuth();
  const { primaryWallet } = useDynamicContext();
  const userWallets = useUserWallets();
  const stellarWallet = resolveStellarWallet(session?.walletAddress, primaryWallet, userWallets);
  const [items,setItems] = useState<Summary[]>([]);
  const [tracks,setTracks] = useState<TrackSummary[]>([]);
  const [detail,setDetail] = useState<Detail | null>(null);
  const [trackId,setTrackId] = useState("");
  const [recipients,setRecipients] = useState<RecipientInput[]>([]);
  const [terms,setTerms] = useState("");
  const [resolution,setResolution] = useState("");
  const [reason,setReason] = useState("");
  const [mode,setMode] = useState<"create" | "edit" | "revise" | null>(null);
  const [reviewing,setReviewing] = useState(false);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string | null>(null);
  const token = session?.token;
  const current = detail?.versions.find(v => v.proposal.version === detail.currentVersion);
  const isOwner = current?.proposal.ownerWallet === session?.walletAddress;
  const isContributor = current?.proposal.recipients.some(r => r.walletAddress === session?.walletAddress);
  const ownResponses = current?.responses.filter(r => r.walletAddress === session?.walletAddress) ?? [];

  const load = useCallback(async (id?: string) => {
    if (!token) return;
    const [agreements,myTracks] = await Promise.all([
      httpClient.get<{ items: Summary[] }>("/agreements",token), tracksApi.listMyTracks(token),
    ]);
    setItems(agreements.items); setTracks(myTracks);
    if (id) setDetail(await httpClient.get<Detail>(`/agreements/${id}`,token));
  },[token]);
  useEffect(() => {
    setDetail(null); setItems([]); setMode(null);
    setReviewing(false);
    if (!token) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    load().catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load agreements"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  },[load,token]);

  async function run(work: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Agreement action failed"); }
    finally { setBusy(false); }
  }
  function openEditor(editorMode: "create" | "edit" | "revise") {
    setMode(editorMode); setResolution(""); setError(null);
    if (editorMode !== "create" && current) {
      setRecipients(current.proposal.recipients.map(r => ({ ...r,percentage: (r.shareBps / 100).toFixed(2) })));
      setTerms(current.proposal.terms); setTrackId(current.proposal.trackId);
    } else {
      setRecipients([{ walletAddress: session!.walletAddress,role: "artist",percentage: "100" }]);
      setTerms(""); setTrackId(tracks[0]?.id ?? "");
    }
  }
  function parsedTerms() {
    return agreementTermsSchema.parse({ terms,recipients: recipients.map(r => {
      if (!/^\d{1,3}(\.\d{1,2})?$/.test(r.percentage)) throw new Error("Enter each share with at most two decimal places");
      return { walletAddress: r.walletAddress.trim(),role: r.role,shareBps: Math.round(Number(r.percentage) * 100) };
    }) });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const parsed = parsedTerms();
      const path = mode === "create" ? "/agreements" : `/agreements/${detail!.id}/${mode === "edit" ? "draft" : "revisions"}`;
      const payload = mode === "create" ? { trackId,...parsed } : mode === "revise" ? { ...parsed,resolution } : parsed;
      const response = mode === "edit" ? await httpClient.put<{ version: AgreementVersion }>(path,payload,token) : await httpClient.post<{ version: AgreementVersion }>(path,payload,token);
      await load(response.version.proposal.agreementId); setMode(null);
    });
  }
  async function act(action: "submit" | "cancel") {
    await run(async () => { await httpClient.post(`/agreements/${detail!.id}/${action}`,{},token); await load(detail!.id); });
  }
  async function respond(action: AgreementAction) {
    await run(async () => {
      if (current!.proposal.networkPassphrase !== clientEnv.stellarNetworkPassphrase) throw new Error("Agreement network does not match the configured wallet network");
      const challenge = await httpClient.post<{ transaction: string; id: string; proposalHash: string; networkPassphrase: string }>(`/agreements/${detail!.id}/challenges`,{ action,reason: action === "accept" ? "" : reason },token);
      if (challenge.proposalHash !== current!.proposalHash) throw new Error("The proposal changed. Refresh and review it before signing");
      if (challenge.networkPassphrase !== clientEnv.stellarNetworkPassphrase) throw new Error("Agreement network does not match the configured wallet network");
      if (!stellarWallet || stellarWallet.address !== session!.walletAddress) {
        throw new Error("Your signed-in Stellar wallet is unavailable. Sign in again and retry.");
      }
      await ensureActiveStellarAccount(stellarWallet);
      const signedTransaction = await stellarWallet.signTransaction(challenge.transaction);
      await httpClient.post(`/agreements/${detail!.id}/responses`,{ challengeId: challenge.id,signedTransaction },token);
      await load(detail!.id); setReason("");
    });
  }

  if (!session) return <div className="space-y-3 rounded-2xl border border-white/10 p-6 text-slate-300">
    <p>Sign in to view and respond to royalty agreements. Signing uses your linked Stellar wallet.</p>
    {authError && <p role="alert" className="text-sm text-rose-200">{authError}</p>}
  </div>;
  return <div className="space-y-6 text-white">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Royalty agreements</h1><p className="mt-2 text-slate-400">Review every contributor’s share and approve the exact split with your wallet.</p></div>
      {tracks.length > 0 && <Button disabled={busy} onClick={() => openEditor("create")}>New proposal</Button>}
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>}
    {loading ? <p role="status">Loading agreements…</p> : <div className="grid gap-3 sm:grid-cols-2">
      {items.map(item => <button key={item.id} disabled={busy} onClick={() => run(async () => { await load(item.id); setMode(null); })} className="rounded-xl border border-white/10 bg-white/5 p-4 text-left hover:border-violet-400">
        <strong>{tracks.find(t => t.id === item.current.proposal.trackId)?.title ?? `Track ${item.current.proposal.trackId}`}</strong>
        <p className="mt-2 text-sm capitalize text-violet-300">Version {item.current.proposal.version} · {stateLabel(item.current.state)}</p>
        <p className="mt-1 text-xs text-slate-400">{item.current.proposal.recipients.length} contributors</p>
      </button>)}
      {!items.length && <p className="text-slate-400">No royalty agreements yet. Proposals for your wallet will appear here.</p>}
    </div>}
    {mode && <form onSubmit={save} className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-xl font-semibold">{mode === "create" ? "New split proposal" : mode === "edit" ? "Edit draft" : "Create a revised version"}</h2>
      {mode === "create" && <label className="block">Track<select required value={trackId} onChange={e => setTrackId(e.target.value)} className={`${inputStyle} mt-2 block w-full`}><option value="">Select a track</option>{tracks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>}
      <p className="text-sm text-slate-400">Every recipient must have a Music City account linked to this Stellar wallet. Shares must total 100%.</p>
      {recipients.map((r,i) => <div key={i} className="grid gap-3 rounded-lg border border-white/10 p-3 md:grid-cols-[1fr_150px_110px_auto]">
        <label>Contributor wallet<Input required value={r.walletAddress} onChange={e => setRecipients(rows => rows.map((v,n) => n === i ? { ...v,walletAddress: e.target.value } : v))} /></label>
        <label>Role<select value={r.role} onChange={e => setRecipients(rows => rows.map((v,n) => n === i ? { ...v,role: e.target.value as RecipientInput["role"] } : v))} className={`${inputStyle} block w-full`}>{royaltyRecipientRoleSchema.options.map(role => <option key={role} value={role}>{role.replaceAll("_"," ")}</option>)}</select></label>
        <label>Share %<Input required inputMode="decimal" value={r.percentage} onChange={e => setRecipients(rows => rows.map((v,n) => n === i ? { ...v,percentage: e.target.value } : v))} /></label>
        <Button type="button" variant="outline" disabled={recipients.length === 1 || busy} onClick={() => setRecipients(rows => rows.filter((_,n) => n !== i))}>Remove</Button>
      </div>)}
      <div className="flex items-center gap-4"><Button type="button" variant="outline" disabled={recipients.length >= 20 || busy} onClick={() => setRecipients(rows => [...rows,{ walletAddress: "",role: "producer",percentage: "0" }])}>Add contributor</Button><p>Total: {recipients.reduce((s,r) => s + (Number(r.percentage) || 0),0).toFixed(2)}%</p></div>
      <label className="block">Agreement terms<textarea value={terms} onChange={e => setTerms(e.target.value)} maxLength={2000} className={`${inputStyle} mt-2 block min-h-24 w-full`} /></label>
      {mode === "revise" && <label className="block">What changed or how was the dispute resolved?<textarea required value={resolution} maxLength={1000} onChange={e => setResolution(e.target.value)} className={`${inputStyle} mt-2 block w-full`} /></label>}
      <div className="flex gap-3"><Button disabled={busy}>Save draft</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setMode(null)}>Close editor</Button></div>
    </form>}
    {detail && current && <section className="space-y-5 rounded-xl border border-white/10 p-5">
      <div><h2 className="text-xl font-semibold">Version {current.proposal.version}</h2><p className="capitalize text-violet-300">{stateLabel(current.state)}</p><p className="mt-1 text-sm text-slate-400">Effective finalized version: {detail.effectiveVersion ?? "None"}</p></div>
      <ul className="space-y-3">{current.proposal.recipients.map(r => <li key={r.walletAddress} className="rounded-lg bg-white/5 p-3"><p className="break-all font-mono text-sm">{r.walletAddress}</p><p className="mt-1">{(r.shareBps/100).toFixed(2)}% · {r.role.replaceAll("_"," ")}</p><p className="text-sm text-slate-400">{current.responses.filter(v => v.walletAddress === r.walletAddress).map(v => `${v.action}${v.reason ? `: ${v.reason}` : ""}`).join(" → ") || "Awaiting response"}</p></li>)}</ul>
      <div><h3 className="font-semibold">Terms</h3><p className="whitespace-pre-wrap text-slate-300">{current.proposal.terms || "No additional terms"}</p></div>
      <details><summary>Proposal verification details</summary><p className="mt-2 break-all text-xs">Track: {current.proposal.trackId}</p><p className="break-all text-xs">Release: {current.proposal.releaseId ?? "Track agreement"}</p><p className="mt-2 break-all font-mono text-xs">{current.proposalHash}</p><p className="text-xs">{current.proposal.networkPassphrase}</p></details>
      {detail.finalizations.length > 0 && <section className="space-y-3"><h3 className="font-semibold">Treasury publication evidence</h3>{detail.finalizations.map(attempt => <div key={attempt.id} className="rounded-lg bg-white/5 p-3 text-sm"><p>Version {attempt.version} · {attempt.status.replaceAll("_"," ")}</p><p className="break-all font-mono text-xs text-slate-400">{attempt.transactionHash}</p><p>{attempt.signedBy.length} of 3 treasury signers recorded</p>{attempt.status === "confirmed" && attempt.explorerUrl && <a href={attempt.explorerUrl} target="_blank" rel="noreferrer" className="text-violet-300 underline">View confirmed publication · ledger {attempt.ledger}</a>}</div>)}</section>}
      {isOwner && <div className="flex flex-wrap gap-3">{current.state === "draft" && <><Button disabled={busy} onClick={() => { setReviewing(false); openEditor("edit"); }}>Edit draft</Button><Button disabled={busy || !!mode} onClick={() => setReviewing(true)}>Review for contributor approval</Button></>}{["draft","proposed","ready"].includes(current.state) && <Button variant="outline" disabled={busy} onClick={() => act("cancel")}>Cancel proposal</Button>}{["finalized","rejected","disputed","cancelled"].includes(current.state) && <Button disabled={busy} onClick={() => openEditor("revise")}>Create revised version</Button>}</div>}
      {isOwner && reviewing && current.state === "draft" && <section aria-label="Review proposal" className="space-y-3 rounded-lg border border-violet-400/30 p-4"><h3 className="font-semibold">Confirm this proposal</h3><p>Check every wallet, role, share and the terms above. Submitting fixes this version; any subsequent change requires a new version and fresh contributor signatures.</p><p>Total: {(current.proposal.recipients.reduce((sum,r) => sum+r.shareBps,0)/100).toFixed(2)}%</p><div className="flex gap-3"><Button disabled={busy} onClick={() => act("submit")}>Submit for contributor approval</Button><Button variant="outline" disabled={busy} onClick={() => setReviewing(false)}>Back to draft</Button></div></section>}
      {isContributor && ["proposed","ready"].includes(current.state) && <div className="space-y-3 rounded-lg bg-violet-500/10 p-4"><p>Review the complete split and terms above before signing. Your response applies only to this version.</p>{!ownResponses.length && <Button disabled={busy} onClick={() => respond("accept")}>Accept and sign with wallet</Button>}<label className="block">Reason for rejection or dispute<textarea value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} className={`${inputStyle} mt-2 block w-full`} /></label><div className="flex gap-3">{!ownResponses.length && <Button variant="outline" disabled={busy || !reason.trim()} onClick={() => respond("reject")}>Reject and sign</Button>}<Button variant="outline" disabled={busy || !reason.trim()} onClick={() => respond("dispute")}>Dispute and sign</Button></div></div>}
      <details><summary>Version and action history</summary><ul className="mt-3 space-y-2 text-sm">{detail.versions.map(v => <li key={v.proposal.version}><strong>Version {v.proposal.version}: {stateLabel(v.state)}</strong><p className="break-all text-xs text-slate-400">{v.proposalHash}</p><p className="whitespace-pre-wrap">{v.proposal.terms}</p><ul>{v.proposal.recipients.map(r => <li key={r.walletAddress} className="break-all">{r.walletAddress} · {r.role.replaceAll("_"," ")} · {(r.shareBps/100).toFixed(2)}%<p className="text-slate-400">{v.responses.filter(response => response.walletAddress === r.walletAddress).map(response => `${response.action}${response.reason ? `: ${response.reason}` : ""}`).join(" → ") || "Awaiting response"}</p></li>)}</ul></li>)}{detail.events.map(e => <li key={e.id}>{new Date(e.created_at).toLocaleString()} · v{e.version} · {e.action.replaceAll("_"," ")}{e.payload.resolution && <p>{e.payload.resolution}</p>}</li>)}</ul></details>
    </section>}
  </div>;
}
