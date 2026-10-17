import { useEffect, useRef, useState } from "react";
import {
  useDynamicContext,
  useUserWallets,
} from "@dynamic-labs/sdk-react-core";
import { Link } from "react-router-dom";
import type { AgreementAction, AgreementDetail } from "@music-city/shared";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { useAuth } from "@/hooks/use-auth";
import { clientEnv } from "@/lib/config/env";
import { resolveStellarWallet } from "@/features/wallet/lib/resolve-stellar-wallet";
import { useStellarAuthorization } from "@/features/wallet/lib/use-stellar-authorization";
import {
  agreementApi,
  agreementStateLabel,
  compactWallet,
} from "./agreement-api";

export function AgreementDetailPanel({
  detail,
  token,
  versionNumber,
  onRefresh,
  onEdit,
  onBusy,
}: {
  detail: AgreementDetail;
  token: string;
  versionNumber?: number;
  onRefresh: () => Promise<void>;
  onEdit: (mode: "edit" | "revise") => void;
  onBusy: (busy: boolean) => void;
}) {
  const { session } = useAuth();
  const { primaryWallet } = useDynamicContext();
  const wallets = useUserWallets();
  const authorize = useStellarAuthorization();
  const current = detail.versions.find(
    (v) => v.proposal.version === detail.currentVersion,
  )!;
  const version =
    detail.versions.find((v) => v.proposal.version === versionNumber) ??
    current;
  const latest = version.proposal.version === detail.currentVersion;
  const permissions = detail.permissions;
  const [review, setReview] = useState(false);
  const [choice, setChoice] = useState<"reject" | "dispute" | null>(null);
  const [reason, setReason] = useState("");
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletWaiting, setWalletWaiting] = useState(false);
  const pending = useRef<{
    id: string;
    version: number;
    action: AgreementAction;
    reason: string;
    challengeId: string;
    expiresAt: string;
    signedTransaction: string;
  } | null>(null);
  const lock = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setReview(false);
    setChoice(null);
    setReason("");
    setError(null);
    setCancelConfirm(false);
    pending.current = null;
  }, [detail.id, current.proposal.version]);
  const owner = version.proposal.ownerWallet === session?.walletAddress;
  const attempt = detail.finalizations
    .filter((a) => a.version === version.proposal.version)
    .sort((a, b) => {
      const active = (status: string) =>
        ["awaiting_signatures", "submitting", "submitted"].includes(status)
          ? 1
          : 0;
      return (
        active(b.status) - active(a.status) ||
        (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      );
    })[0];
  const name = (wallet: string) =>
    detail.context.people.find((p) => p.walletAddress === wallet)?.name ??
    (wallet.startsWith("admin:")
      ? "Administrator"
      : wallet.startsWith("worker:")
        ? "System"
        : "Contributor");
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    onBusy(true);
    try {
      await work();
    } catch (e) {
      try {
        await onRefresh();
      } catch {}
      if (alive.current)
        setError(
          e instanceof Error ? e.message : "Could not update the agreement",
        );
    } finally {
      lock.current = false;
      if (alive.current) {
        setBusy(false);
        setWalletWaiting(false);
        titleRef.current?.focus();
      }
      onBusy(false);
    }
  }
  async function act(action: "submit" | "cancel") {
    await run(async () => {
      await agreementApi.act(
        token,
        detail.id,
        action,
        current.proposal.version,
        current.proposalHash,
      );
      await onRefresh();
      setReview(false);
      setCancelConfirm(false);
    });
  }
  async function respond(action: AgreementAction) {
    await run(async () => {
      if (
        current.proposal.networkPassphrase !==
        clientEnv.stellarNetworkPassphrase
      )
        throw new Error("Connect to the network used by this agreement");
      const text = action === "accept" ? "" : reason.trim();
      if (action !== "accept" && !text) throw new Error("Add a reason");
      let signed = pending.current;
      if (!signed) {
        const wallet = resolveStellarWallet(
          session?.walletAddress,
          primaryWallet,
          wallets,
        );
        if (!wallet || wallet.address !== session?.walletAddress)
          throw new Error("Connect your linked Stellar wallet");
        const challenge = await agreementApi.challenge(token, detail.id, {
          action,
          reason: text,
        });
        if (
          challenge.proposalHash !== current.proposalHash ||
          challenge.networkPassphrase !== current.proposal.networkPassphrase
        )
          throw new Error(
            "The proposal changed. Review the latest version before signing",
          );
        setWalletWaiting(true);
        try {
          await authorize(wallet);
          const signedTransaction = await wallet.signTransaction(
            challenge.transaction,
          );
          signed = {
            id: detail.id,
            version: current.proposal.version,
            action,
            reason: text,
            challengeId: challenge.id,
            expiresAt: challenge.expiresAt,
            signedTransaction,
          };
          pending.current = signed;
        } catch (e) {
          throw new Error(
            e instanceof Error && /cancel|closed/i.test(e.message)
              ? "Signing cancelled. No response recorded."
              : e instanceof Error
                ? e.message
                : "Signing did not complete",
          );
        } finally {
          setWalletWaiting(false);
        }
      }
      if (
        signed.id !== detail.id ||
        signed.version !== current.proposal.version ||
        signed.action !== action ||
        signed.reason !== text
      )
        throw new Error(
          "Check the pending response before choosing another action",
        );
      try {
        await agreementApi.respond(token, detail.id, {
          challengeId: signed.challengeId,
          signedTransaction: signed.signedTransaction,
        });
      } catch (e) {
        const saved = await agreementApi.detail(token, detail.id);
        if (
          !saved.versions.some((v) =>
            v.responses.some((r) => r.challengeId === signed!.challengeId),
          )
        ) {
          // A successful read found no recorded response; an expired envelope cannot be retried.
          if (Date.parse(signed.expiresAt) <= Date.now())
            pending.current = null;
          throw e;
        }
      }
      pending.current = null;
      setChoice(null);
      setReason("");
      await onRefresh();
    });
  }
  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b border-border pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 ref={titleRef} tabIndex={-1} className="break-words text-2xl font-semibold outline-none">
              {detail.context.track.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Royalty agreement · Version {version.proposal.version}
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {version.state === "finalized" &&
            detail.effectiveVersion !== version.proposal.version
              ? "Previous version"
              : agreementStateLabel(version.state)}
          </span>
        </div>
        {detail.effectiveVersion !== null &&
          detail.effectiveVersion !== version.proposal.version && (
            <p className="text-sm text-muted-foreground">
              Version {detail.effectiveVersion} is active
            </p>
          )}
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {busy && (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin" />
          {walletWaiting ? "Waiting for your wallet…" : "Saving response…"}
        </div>
      )}
      <section
        className="space-y-4 rounded-lg border border-border bg-card p-5 sm:p-6"
        aria-label="Agreement summary"
      >
        <h2 className="text-lg font-semibold">Contributors</h2>
        <ul className="divide-y divide-border">
          {version.proposal.recipients.map((recipient) => {
            const response = version.responses
              .filter((r) => r.walletAddress === recipient.walletAddress)
              .at(-1);
            const status = response
              ? (
                  {
                    accept: "Accepted",
                    reject: "Rejected",
                    dispute: "Disputed",
                  } as const
                )[response.action]
              : "Awaiting response";
            return (
              <li
                key={recipient.walletAddress}
                className="flex flex-wrap justify-between gap-3 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">
                    {name(recipient.walletAddress)}
                    {recipient.walletAddress === session?.walletAddress
                      ? " (you)"
                      : ""}
                  </p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {recipient.role.replaceAll("_", " ")} ·{" "}
                    <span title={recipient.walletAddress}>
                      {compactWallet(recipient.walletAddress)}
                    </span>
                  </p>
                  {response?.reason && (
                    <p className="mt-2 break-words text-sm">
                      {response.reason}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {Number((recipient.shareBps / 100).toFixed(2))}%
                  </p>
                  <p className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    {response?.action === "accept" && (
                      <Check className="size-3" />
                    )}
                    {version.state === "draft" ? "Not sent" : status}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        {version.proposal.terms && (
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-medium">Additional terms</h3>
            <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {version.proposal.terms}
            </p>
          </div>
        )}
      </section>
      {latest && (
        <div className="space-y-4">
          {owner && version.state === "draft" && !review && (
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => onEdit("edit")}
              >
                Edit draft
              </Button>
              <Button disabled={busy} onClick={() => setReview(true)}>
                Review proposal
              </Button>
            </div>
          )}
          {review && permissions.submit && (
            <section
              aria-label="Review proposal"
              className="space-y-4 rounded-lg border border-border bg-card p-5"
            >
              <h2 className="font-semibold">Send for approval?</h2>
              <p className="text-sm text-muted-foreground">
                Changes after sending need a new version and fresh signatures.
              </p>
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => setReview(false)}
                >
                  Back
                </Button>
                <Button disabled={busy} onClick={() => void act("submit")}>
                  Send proposal
                </Button>
              </div>
            </section>
          )}
          {["rejected", "disputed"].includes(version.state) && (
            <p className="text-sm text-muted-foreground">
              {version.state === "rejected"
                ? "A contributor rejected this proposal."
                : "This proposal is disputed."}{" "}
              {permissions.revise
                ? "Revise it to request approval again."
                : "Waiting for a revised proposal."}
            </p>
          )}
          {permissions.revise && (
            <Button disabled={busy} onClick={() => onEdit("revise")}>
              Revise agreement
            </Button>
          )}
          {(permissions.accept ||
            permissions.reject ||
            permissions.dispute) && (
            <section className="space-y-4" aria-label="Your response">
              {!choice ? (
                <div className="flex flex-wrap justify-end gap-3">
                  {permissions.reject && (
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() => setChoice("reject")}
                    >
                      Reject
                    </Button>
                  )}
                  {permissions.dispute && (
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() => setChoice("dispute")}
                    >
                      Raise dispute
                    </Button>
                  )}
                  {permissions.accept && (
                    <Button
                      disabled={busy}
                      onClick={() => void respond("accept")}
                    >
                      Accept and sign
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 rounded-lg border border-border bg-card p-5">
                  <FormField
                    id="agreement-response-reason"
                    label={
                      choice === "reject"
                        ? "Why are you rejecting this proposal?"
                        : "What needs to be resolved?"
                    }
                  >
                    <Textarea
                      disabled={busy || !!pending.current}
                      maxLength={1000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </FormField>
                  <div className="flex flex-wrap justify-end gap-3">
                    <Button
                      disabled={busy || !!pending.current}
                      variant="outline"
                      onClick={() => {
                        setChoice(null);
                        setReason("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={busy || !reason.trim()}
                      onClick={() => void respond(choice)}
                    >
                      {choice === "reject" ? "Reject and sign" : "Sign dispute"}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}
          {version.state === "ready" && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Check className="size-4" />
              Everyone accepted. Awaiting finalization.
            </p>
          )}
          {version.state === "finalizing" && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircle className="size-4 animate-spin" />
              Finalizing agreement…
            </p>
          )}
          {permissions.cancel &&
            !review &&
            (cancelConfirm ? (
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <p className="text-sm">Cancel this proposal?</p>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => setCancelConfirm(false)}
                >
                  Keep proposal
                </Button>
                <Button
                  disabled={busy}
                  variant="destructive"
                  onClick={() => void act("cancel")}
                >
                  Confirm cancellation
                </Button>
              </div>
            ) : (
              <Button
                disabled={busy}
                variant="ghost"
                onClick={() => setCancelConfirm(true)}
              >
                Cancel proposal
              </Button>
            ))}
        </div>
      )}
      {attempt?.status === "confirmed" && attempt.explorerUrl && (
        <a
          href={attempt.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-sm text-primary underline"
        >
          View confirmed agreement
        </a>
      )}
      <details className="space-y-3 border-t border-border pt-4">
        <summary className="cursor-pointer text-sm font-medium">
          Version history
        </summary>
        <ol className="mt-4 space-y-4">
          {[...detail.versions].reverse().map((v) => (
            <li key={v.proposal.version} className="space-y-2">
              <Link
                to={`?version=${v.proposal.version}`}
                className="text-sm font-medium text-primary underline"
              >
                Version {v.proposal.version}
                {detail.effectiveVersion === v.proposal.version
                  ? " · Active"
                  : ""}
              </Link>
              <p className="text-xs text-muted-foreground">
                {new Date(v.createdAt).toLocaleString()}
              </p>
              <ul className="text-sm">
                {v.proposal.recipients.map((r) => (
                  <li key={r.walletAddress} className="break-words">
                    {name(r.walletAddress)} ·{" "}
                    {Number((r.shareBps / 100).toFixed(2))}% ·{" "}
                    {r.role.replaceAll("_", " ")}
                    {v.responses
                      .filter(
                        (response) =>
                          response.walletAddress === r.walletAddress,
                      )
                      .map((response) => (
                        <p
                          key={response.challengeId}
                          className="mt-1 text-xs text-muted-foreground"
                        >
                          {response.action}
                          {response.reason
                            ? ` · ${response.reason}`
                            : ""} ·{" "}
                          {new Date(response.respondedAt).toLocaleString()}
                        </p>
                      ))}
                  </li>
                ))}
              </ul>
              {v.proposal.terms && (
                <p className="whitespace-pre-wrap break-words text-sm">
                  {v.proposal.terms}
                </p>
              )}
              {detail.events
                .filter((e) => e.version === v.proposal.version)
                .map((event) => (
                  <div key={event.id} className="text-xs text-muted-foreground">
                    <p>
                      {event.action.replaceAll("_", " ")} ·{" "}
                      {name(event.actor_wallet)} ·{" "}
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                    {typeof event.payload.resolution === "string" && (
                      <p className="mt-1 break-words">
                        {event.payload.resolution}
                      </p>
                    )}
                  </div>
                ))}
              {detail.finalizations
                .filter(
                  (a) =>
                    a.version === v.proposal.version &&
                    a.status === "confirmed" &&
                    a.explorerUrl,
                )
                .map((a) => (
                  <a
                    key={a.id}
                    href={a.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs text-primary underline"
                  >
                    View publication receipt
                  </a>
                ))}
            </li>
          ))}
        </ol>
      </details>
      <details className="border-t border-border pt-4 text-sm">
        <summary className="cursor-pointer">Verification details</summary>
        <dl className="mt-3 space-y-3 text-xs text-muted-foreground">
          <div>
            <dt>Proposal hash</dt>
            <dd className="break-all font-mono">{version.proposalHash}</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>{version.proposal.networkPassphrase}</dd>
          </div>
          {version.proposal.recipients.map((r) => (
            <div key={r.walletAddress}>
              <dt>{name(r.walletAddress)}</dt>
              <dd className="break-all font-mono">{r.walletAddress}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
