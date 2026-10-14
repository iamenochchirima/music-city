import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { referralsApi } from "./referrals-api";
import {
  pendingReferral,
  rememberReferral,
  clearReferral,
  bindReferralWallet,
} from "./referral-storage";

export function ReferralCodeInput() {
  const { session } = useAuth();
  const [invitation, setInvitation] = useState(pendingReferral);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isExpanded, setIsExpanded] = useState(() =>
    Boolean(pendingReferral()),
  );

  async function apply() {
    setBusy(true);
    setError("");

    try {
      setInvitation(
        rememberReferral(await referralsApi.capture(code.trim()), true),
      );
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
    <section className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Have an artist invitation code?
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            Optional. Add a code to credit the artist who invited you.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          aria-expanded={isExpanded}
          aria-controls="referral-code-panel"
          onClick={() => setIsExpanded((expanded) => !expanded)}
        >
          {isExpanded
            ? "Hide code"
            : invitation
              ? "Manage invitation"
              : "Add code"}
        </Button>
      </div>

      {invitation ? (
        <p role="status" className="text-sm text-primary">
          Invited by {invitation.inviterName}. This invitation is applied to
          your registration.
        </p>
      ) : null}

      {isExpanded ? (
        <div
          id="referral-code-panel"
          className="flex flex-col items-start gap-3 border-t border-border pt-4 sm:flex-row sm:items-end"
        >
          <FormField
            id="referral-code"
            label="Invitation code (optional)"
            className="w-full flex-1"
            error={
              error
                ? `${error} You can continue without an invitation.`
                : undefined
            }
          >
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={18}
              placeholder="MC…"
            />
          </FormField>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !code.trim()}
            onClick={() => void apply()}
          >
            {busy ? "Applying…" : "Apply code"}
          </Button>
        </div>
      ) : null}

      {invitation ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            clearReferral();
            setInvitation(null);
          }}
        >
          Remove invitation
        </Button>
      ) : null}
    </section>
  );
}
