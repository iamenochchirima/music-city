import { useCallback, useEffect, useState } from "react";
import type { SponsorshipAdminReport } from "@music-city/shared";

import { useAdminAuth } from "@/features/auth/providers/admin-auth-provider";
import { httpClient } from "@/lib/api/http-client";

const formatUsd = (minor: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
}).format(minor / 100);

export function AdminSponsorshipsPage() {
  const { session } = useAdminAuth();
  const token = session?.token;
  const [report, setReport] = useState<SponsorshipAdminReport | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setReport(await httpClient.get<SponsorshipAdminReport>("/sponsorships", token));
  }, [token]);

  const run = useCallback(async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try { await work(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update sponsorship."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void run(load); }, [load, run]);

  const updateCampaign = () => {
    if (!report || !token) return;
    void run(async () => {
      await httpClient.put("/sponsorships/campaign", { active: !report.campaign.active, reason: reason.trim() }, token);
      setReason("");
      await load();
    });
  };

  const reconcile = () => {
    if (!token) return;
    void run(async () => {
      await httpClient.post("/sponsorships/reconcile", {}, token);
      await load();
    });
  };

  return (
    <section className="space-y-6 p-4 text-slate-100 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Early-user artist sponsorship</h1>
        <p className="mt-2 max-w-3xl text-slate-400">Music City covers the one-time artist activation for eligible new accounts. Sponsored activations do not create payment revenue or referral commissions.</p>
      </div>
      {error ? <p role="alert" className="text-rose-200">{error}</p> : null}
      {!report ? <p role="status" className="text-sm text-slate-400">Loading campaign…</p> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Campaign", report.campaign.active ? "Active" : "Paused"],
            ["Eligible accounts", String(report.campaign.eligibleAccounts)],
            ["Artist activations", String(report.campaign.activatedArtists)],
            ["Pending eligibility", String(report.campaign.pendingEligibility)],
          ].map(([label, value]) => <article key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></article>)}
        </div>

        <article className="space-y-4 rounded-xl border border-white/10 bg-white/[0.04] p-5">
          <div>
            <h2 className="font-semibold">{report.campaign.code} · terms {report.campaign.termsRevision}</h2>
            <p className="mt-1 text-sm text-slate-400">Standard price {formatUsd(report.campaign.originalAmountMinor)} · {report.campaign.discountPercent}% discount · due {formatUsd(report.campaign.amountDueMinor)}</p>
            <p className="mt-2 text-sm text-slate-300">Fees waived at face value: {formatUsd(report.campaign.totalFeesWaivedMinor)}. This is not sales revenue or money paid out.</p>
          </div>
          {session?.role === "super_admin" ? <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-64 flex-1 text-sm">Reason for {report.campaign.active ? "pausing" : "resuming"}
              <input value={reason} onChange={event => setReason(event.target.value)} maxLength={500} className="mt-1 block w-full rounded border border-white/10 bg-slate-950 p-2" />
            </label>
            <button disabled={busy || reason.trim().length < 5} onClick={updateCampaign} className="rounded border border-emerald-300/30 px-4 py-2 text-emerald-200 disabled:opacity-50">{report.campaign.active ? "Pause new eligibility" : "Resume new eligibility"}</button>
            <button disabled={busy} onClick={reconcile} className="rounded border border-white/20 px-4 py-2 disabled:opacity-50">Reconcile eligible artists</button>
          </div> : <p className="text-xs text-slate-500">Only a super admin can pause, resume, or reconcile.</p>}
        </article>

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Eligible accounts</h2>
          <button disabled={busy} onClick={() => void run(load)} className="rounded border border-white/20 px-3 py-2 text-sm">Refresh</button>
        </div>
        {report.items.length === 0 ? <p className="text-sm text-slate-400">No accounts have been enrolled yet.</p> : <div className="space-y-3">
          {report.items.map(item => <article key={item.id} className="space-y-2 rounded-xl border border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{item.displayName || "Unnamed account"}</h3><span className="text-sm text-emerald-300">{item.status === "sponsored" ? "Artist access activated" : "Eligible"}</span></div>
            <p className="break-all font-mono text-xs text-slate-400">{item.walletAddress}</p>
            <p className="text-xs text-slate-500">Joined {new Date(item.capturedAt).toLocaleString()}{item.activatedAt ? ` · Activated ${new Date(item.activatedAt).toLocaleString()}` : ""}</p>
            {item.inviterName ? <p className="text-xs text-slate-400">Personal invitation from {item.inviterName}</p> : null}
          </article>)}
        </div>}

        <details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer font-medium">Campaign audit history</summary><ul className="mt-3 space-y-2 text-xs text-slate-400">{report.events.map(event => <li key={event.id}>{new Date(event.createdAt).toLocaleString()} · {event.action.replaceAll("_", " ")} · {event.actor}{event.reason ? ` · ${event.reason}` : ""}</li>)}</ul></details>
      </>}
    </section>
  );
}
