import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { referralsApi } from "./referrals-api";
import { pendingReferral, rememberReferral, clearReferral, bindReferralWallet } from "./referral-storage";

export function ReferralCodeInput() {
  const { session } = useAuth();
  const [invitation, setInvitation] = useState(pendingReferral);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isExpanded, setIsExpanded] = useState(() => Boolean(pendingReferral()));

  async function apply() {
    setBusy(true);
    setError("");

    try {
      setInvitation(rememberReferral(await referralsApi.capture(code.trim()), true));
      if (session?.walletAddress) {
        bindReferralWallet(session.walletAddress);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not apply invitation.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-white">Have an artist invitation code?</p>
          <p className="text-xs leading-5 text-slate-400">
            Optional. Add a code to credit the artist who invited you.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="shrink-0 self-start rounded-md border border-white/15 px-3 py-2 text-sm text-slate-200 transition hover:border-white/30 hover:bg-white/5 sm:self-auto"
        >
          {isExpanded ? "Hide code" : invitation ? "Manage invitation" : "Add code"}
        </button>
      </div>

      {invitation ? (
        <p role="status" className="text-sm text-emerald-300">
          Invited by {invitation.inviterName}. This invitation is applied to your registration.
        </p>
      ) : null}

      {isExpanded ? (
        <div id="referral-code-panel" className="space-y-2 border-t border-white/10 pt-3">
          <label htmlFor="referral-code" className="text-sm text-slate-300">
            Invitation code (optional)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="referral-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={18}
              placeholder="MC…"
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-slate-950 p-2 text-white"
            />
            <button
              type="button"
              disabled={busy || !code.trim()}
              onClick={() => void apply()}
              className="rounded-md border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? "Applying…" : "Apply code"}
            </button>
          </div>
        </div>
      ) : null}

      {invitation ? (
        <button
          type="button"
          onClick={() => {
            clearReferral();
            setInvitation(null);
          }}
          className="text-sm text-slate-300 underline underline-offset-4"
        >
          Remove invitation
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-rose-200">
          {error} You can continue without an invitation.
        </p>
      ) : null}
    </section>
  );
}
