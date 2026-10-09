import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/features/auth/providers/admin-auth-provider";
import { httpClient } from "@/lib/api/http-client";

type Referral = {
  id: string; inviter_id: string; invitee_id: string; inviter_name: string; invitee_name: string;
  campaign: string; bound_at: string; completed_at: string | null; artist_qualified_at: string | null;
  excluded_at: string | null; exclusion_reason: string | null;
  paid_activation?: { amount: string; asset_code: string; network_passphrase: string; recorded_at: string } | null;
  events: { id: string; action: string; actor: string; reason: string | null; created_at: string }[];
};
export function AdminReferralsPage() {
  const { session } = useAdminAuth();
  const [items,setItems] = useState<Referral[]>([]);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [filter,setFilter] = useState("all");
  const [campaign,setCampaign] = useState("all");
  const [reason,setReason] = useState<Record<string,string>>({});
  const token = session?.token;
  const load = useCallback(async () => {
    if (!token) return;
    setItems((await httpClient.get<{ items: Referral[] }>("/referrals",token)).items);
  },[token]);
  const run = useCallback(async (work: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await work(); } catch(e) { setError(e instanceof Error ? e.message : "Unable to load referrals."); } finally { setBusy(false); }
  },[]);
  useEffect(() => { void run(load); },[load,run]);
  function state(row: Referral) { return row.excluded_at ? "excluded" : row.artist_qualified_at ? "artist" : row.completed_at ? "completed" : "started"; }
  const visible = items.filter(r => (filter === "all" || state(r) === filter) && (campaign === "all" || r.campaign === campaign));
  return <section className="space-y-6 p-4 text-slate-100 md:p-8"><h1 className="text-2xl font-semibold">Registration referrals</h1><p className="text-slate-400">Review attribution and registration milestones. Cash rewards are disabled.</p>
    <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={() => void run(load)} className="rounded border border-white/20 px-4 py-2">{busy ? "Loading…" : "Refresh"}</button><label>Status <select value={filter} onChange={e => setFilter(e.target.value)} className="ml-2 rounded bg-slate-900 p-2">{["all","started","completed","artist","excluded"].map(v => <option key={v}>{v}</option>)}</select></label><label>Campaign <select value={campaign} onChange={e => setCampaign(e.target.value)} className="ml-2 rounded bg-slate-900 p-2"><option value="all">All campaigns</option>{[...new Set(items.map(r => r.campaign))].map(v => <option key={v}>{v}</option>)}</select></label>{session?.role === "super_admin" && <button disabled={busy} onClick={() => void run(async () => { await httpClient.post("/referrals/reconcile",{},token); await load(); })} className="rounded border border-white/20 px-4 py-2">Reconcile completed registrations</button>}</div>
    {error && <p role="alert" className="text-rose-200">{error}</p>}
    {!busy && !visible.length && <p>No matching referrals.</p>}
    {visible.map(row => <article key={row.id} className="space-y-3 rounded-xl border border-white/10 p-5"><h2 className="font-semibold">{row.inviter_name} invited {row.invitee_name}</h2><p className="text-sm text-emerald-300">{state(row)} · {row.campaign}</p><dl className="space-y-1 break-all text-xs text-slate-400"><div><dt>Inviter account</dt><dd>{row.inviter_id}</dd></div><div><dt>Invited account</dt><dd>{row.invitee_id}</dd></div><div><dt>Started</dt><dd>{new Date(row.bound_at).toLocaleString()}</dd></div>{row.completed_at && <div><dt>Registration complete</dt><dd>{new Date(row.completed_at).toLocaleString()}</dd></div>}{row.artist_qualified_at && <div><dt>Artist qualified</dt><dd>{new Date(row.artist_qualified_at).toLocaleString()}</dd></div>}</dl>
      {row.paid_activation && <p className="text-sm text-slate-300">Paid activation: {row.paid_activation.amount} {row.paid_activation.asset_code} · {row.paid_activation.network_passphrase}. No commission issued.</p>}
      {row.exclusion_reason && <p>Exclusion reason: {row.exclusion_reason}</p>}
      {session?.role === "super_admin" && !row.excluded_at && <div className="flex flex-wrap gap-2"><label className="grow">Exclusion reason<input value={reason[row.id] ?? ""} onChange={e => setReason({ ...reason,[row.id]: e.target.value })} maxLength={500} className="mt-1 block w-full rounded border border-white/10 bg-slate-950 p-2" /></label><button disabled={busy || (reason[row.id]?.trim().length ?? 0) < 3} onClick={() => void run(async () => { await httpClient.post(`/referrals/${row.id}/exclude`,{ reason: reason[row.id] },token); await load(); })} className="self-end rounded border border-rose-300/30 p-2 text-rose-200">Exclude referral</button></div>}
      <details><summary>Audit history</summary><ul className="mt-2 space-y-2 text-xs text-slate-400">{row.events.map(event => <li key={event.id}>{new Date(event.created_at).toLocaleString()} · {event.action.replaceAll("_"," ")} · {event.actor}{event.reason && <p>{event.reason}</p>}</li>)}</ul></details>
    </article>)}
  </section>;
}
