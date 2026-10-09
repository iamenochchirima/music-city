import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { referralsApi } from "./referrals-api";
import { pendingReferral, rememberReferral, clearReferral, bindReferralWallet } from "./referral-storage";

export function ReferralCodeInput() {
  const { session } = useAuth();
  const [invitation,setInvitation] = useState(pendingReferral);
  const [code,setCode] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  async function apply() {
    setBusy(true); setError("");
    try { setInvitation(rememberReferral(await referralsApi.capture(code),true)); if (session?.walletAddress) bindReferralWallet(session.walletAddress); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not apply invitation."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2 rounded-lg border border-white/10 p-4">
    <label htmlFor="referral-code" className="text-sm text-slate-300">Invitation code (optional)</label>
    {invitation && <p role="status" className="text-sm text-emerald-300">Invited by {invitation.inviterName}. Applied to your registration.</p>}
    <div className="flex gap-2"><input id="referral-code" value={code} onChange={e => setCode(e.target.value)} maxLength={18} placeholder="MC…" className="min-w-0 flex-1 rounded-md border border-white/10 bg-slate-950 p-2 text-white" /><button type="button" disabled={busy || !code.trim()} onClick={() => void apply()} className="rounded-md border border-white/20 px-3 text-sm disabled:opacity-50">{busy ? "Applying…" : "Apply"}</button></div>
    {invitation && <button type="button" onClick={() => { clearReferral(); setInvitation(null); }} className="text-sm text-slate-300 underline">Remove invitation</button>}
    {error && <p role="alert" className="text-sm text-rose-200">{error} You can continue without an invitation.</p>}
  </div>;
}
