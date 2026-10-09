import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ReferralSummary } from "@music-city/shared";
import { useAuth } from "@/hooks/use-auth";
import { referralsApi } from "./referrals-api";

export function ReferralsOverview() {
  const { session } = useAuth();
  const [data,setData] = useState<ReferralSummary | null>(null);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const requestSequence = useRef(0);
  const [notice,setNotice] = useState("");
  const load = useCallback(async () => {
    if (!session?.token) return;
    const sequence = ++requestSequence.current;
    setBusy(true); setError("");
    try { const result = await referralsApi.mine(session.token); if (sequence === requestSequence.current) setData(result); }
    catch(e) { if (sequence === requestSequence.current) setError(e instanceof Error ? e.message : "Unable to load invitations."); }
    finally { if (sequence === requestSequence.current) setBusy(false); }
  },[session?.token]);
  useEffect(() => { setData(null); void load(); return () => { requestSequence.current++; }; },[load]);
  const link = data?.code ? `${window.location.origin}/join?ref=${data.code}` : "";
  async function share(copy: boolean) {
    try {
      if (!copy && navigator.share) await navigator.share({ title: "Join Music City",text: "Register as an artist on Music City",url: link });
      else { await navigator.clipboard.writeText(link); setNotice("Invitation link copied."); }
    } catch(e) { if (!(e instanceof Error && e.name === "AbortError")) setNotice("Could not share automatically. Select and copy your invitation link below."); }
  }
  if (!session?.token) return <p>Log in to <Link to="/auth" className="underline">invite artists</Link>.</p>;
  return <section className="space-y-6"><h1 className="text-2xl font-semibold">Invite artists</h1><p className="text-slate-300">Share your link with new artists. Registration referrals do not currently earn cash rewards.</p>
    <button disabled={busy} onClick={() => void load()} className="rounded-md border border-white/20 px-4 py-2">{busy ? "Loading…" : "Refresh"}</button>
    {error && <p role="alert" className="text-rose-200">{error}</p>}
    {data && <><p className="text-sm text-slate-400">An invitation lasts 30 days until registration begins. Existing accounts and self-referrals are ineligible. Credit is recorded once when a new artist completes onboarding. You can track progress here.</p>
      {!data.enabled ? <p>New invitations are paused. Existing referrals remain visible.</p> : <div className="space-y-3"><label className="block">Your invitation link<input aria-label="Your invitation link" readOnly value={link} className="mt-2 w-full rounded-md border border-white/10 bg-slate-950 p-3" /></label><div className="flex gap-3"><button onClick={() => void share(true)} className="rounded-md bg-emerald-400 px-4 py-2 text-slate-950">Copy link</button><button onClick={() => void share(false)} className="rounded-md border border-white/20 px-4 py-2">Share</button></div></div>}
      {notice && <p role="status">{notice}</p>}
      <dl className="grid gap-4 sm:grid-cols-3">{[["Registrations started",data.totals.started],["Registrations completed",data.totals.completed],["Artists registered",data.totals.artists]].map(([label,count]) => <div key={label} className="rounded-xl border border-white/10 p-4"><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-2 text-2xl">{count}</dd></div>)}</dl>
      {!data.items.length ? <p>No registrations from your invitations yet.</p> : <ul className="space-y-3">{data.items.map(item => <li key={item.id} className="rounded-xl border border-white/10 p-4"><p>{item.label}</p><p className="text-sm text-slate-300">{item.excluded ? "Ineligible" : item.artistQualifiedAt ? "Artist registered" : item.completedAt ? "Registration completed" : "Registration started"}</p><p className="text-xs text-slate-400">Started {new Date(item.startedAt).toLocaleDateString()}</p></li>)}</ul>}
    </>}
  </section>;
}
