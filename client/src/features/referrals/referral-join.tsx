import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { referralsApi } from "./referrals-api";
import { pendingReferral, rememberReferral } from "./referral-storage";

export function ReferralJoin() {
  const [params] = useSearchParams();
  const code = params.get("ref") ?? "";
  const [status,setStatus] = useState("Checking your invitation…");
  const [busy,setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    setBusy(true);
    const current = pendingReferral();
    const capture = current ? Promise.resolve(current) : referralsApi.capture(code);
    capture.then(invitation => {
      if (active) { rememberReferral(invitation); setStatus(`You were invited by ${invitation.inviterName}. Your invitation is saved for registration.`); }
    }).catch(e => { if (active) setStatus(`${e instanceof Error ? e.message : "Invitation unavailable."} You can still register.`); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  },[code]);
  return <section className="mx-auto max-w-2xl space-y-6 px-6 py-16"><p className="text-sm text-emerald-300">Music City artist invitation</p><h1 className="text-3xl font-semibold">Bring your music to Music City</h1><p className="text-slate-300">Create an artist profile, manage your releases, and connect with listeners.</p><p role="status">{status}</p><p className="text-sm text-slate-400">Complete registration with the artist or both option to credit your inviter. Registration referrals do not currently earn cash rewards.</p>{!busy && <Link to="/auth" className="inline-block rounded-md bg-emerald-400 px-5 py-3 text-slate-950">Continue to registration</Link>}</section>;
}
