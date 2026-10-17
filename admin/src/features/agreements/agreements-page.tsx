import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AgreementDetail, AgreementSummary } from "@music-city/shared";
import { ArrowLeft, Check, LoaderCircle } from "lucide-react";
import { useAdminAuth } from "@/features/auth/providers/admin-auth-provider";
import { httpClient } from "@/lib/api/http-client";
import { Button } from "@/components/ui/button";
import { useAgreementResource } from "./use-agreement-resource";

type Detail = Omit<AgreementDetail, "permissions">;
const panel =
  "space-y-4 rounded-lg border border-white/10 bg-white/[0.02] p-5 sm:p-6";
const labels: Record<string, string> = {
  draft: "Draft",
  proposed: "Awaiting responses",
  ready: "Ready to finalize",
  rejected: "Rejected",
  disputed: "Disputed",
  finalizing: "Finalizing",
  finalized: "Active",
  cancelled: "Cancelled",
};
export function AdminAgreementsPage() {
  const { session } = useAdminAuth();
  const { agreementId } = useParams();
  const token = session?.token ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [showResolution, setShowResolution] = useState(false);
  const [signedXdr, setSignedXdr] = useState("");
  const lock = useRef(false);
  const list = useAgreementResource(
    `list:${token}`,
    () =>
      httpClient.get<{ items: AgreementSummary[] }>(
        "/agreements",
        token,
        AbortSignal.timeout(15000),
      ),
    busy || !!agreementId,
  );
  const resource = useAgreementResource<Detail | null>(
    `${token}:${agreementId ?? ""}`,
    () =>
      agreementId
        ? httpClient.get<Detail>(
            `/agreements/${agreementId}`,
            token,
            AbortSignal.timeout(15000),
          )
        : Promise.resolve(null),
    busy || !agreementId,
  );
  const detail = resource.value;
  const current = detail?.versions.find(
    (v) => v.proposal.version === detail.currentVersion,
  );
  const canOperate = session?.role === "super_admin";
  const attempt = detail?.finalizations
    .filter((a) => a.version === detail.currentVersion)
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
  useEffect(() => {
    setError(null);
    setResolution("");
    setShowResolution(false);
    setSignedXdr("");
  }, [agreementId, current?.proposal.version]);
  async function action(path: string, body: unknown = {}) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await httpClient.post(path, body, token);
      setSignedXdr("");
      setShowResolution(false);
      await resource.refresh();
      await list.refresh();
    } catch (e) {
      await resource.refresh();
      setError(
        e instanceof Error ? e.message : "Could not update the agreement",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function download() {
    if (!attempt) return;
    const blob = new Blob([attempt.transaction], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agreement-${attempt.id}.xdr`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const name = (wallet: string) =>
    detail?.context.people.find((p) => p.walletAddress === wallet)?.name ??
    (wallet.startsWith("admin:")
      ? "Administrator"
      : wallet.startsWith("worker:")
        ? "System"
        : "Contributor");
  const selection = current
    ? {
        expectedVersion: current.proposal.version,
        expectedHash: current.proposalHash,
      }
    : null;
  const waiting =
    attempt &&
    ["awaiting_signatures", "submitting", "submitted"].includes(attempt.status);
  const activeAttempt =
    attempt &&
    ["awaiting_signatures", "submitting", "submitted", "confirmed"].includes(
      attempt.status,
    );
  return (
    <main className="space-y-6 text-white">
      {agreementId && (
        <Link
          to="/console/agreements"
          className="inline-flex items-center gap-2 text-sm text-slate-400"
        >
          <ArrowLeft className="size-4" />
          All agreements
        </Link>
      )}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
        <div>
          <h1 className="break-words text-2xl font-semibold">
            {detail?.context.track.title ?? "Contributor agreements"}
          </h1>
          {current && (
            <p className="mt-2 text-sm text-slate-400">
              Version {current.proposal.version} · {labels[current.state]}
            </p>
          )}
        </div>
        {detail?.effectiveVersion !== null &&
          detail?.effectiveVersion !== undefined && (
            <span className="text-sm text-emerald-300">
              Version {detail.effectiveVersion} active
            </span>
          )}
      </header>
      {busy && (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-slate-400"
        >
          <LoaderCircle className="size-4 animate-spin" />
          Working…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded border border-red-500/30 p-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}
      {(agreementId ? resource.error : list.error) && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <span>
            {(agreementId ? detail : list.value)
              ? "Status check interrupted"
              : agreementId
                ? resource.error
                : list.error}
          </span>
          <Button
            variant="outline"
            onClick={() =>
              void (agreementId ? resource.refresh() : list.refresh())
            }
          >
            Retry status check
          </Button>
        </div>
      )}
      {(agreementId ? resource.loading : list.loading) && (
        <p role="status" className="text-sm text-slate-400">
          Loading agreements…
        </p>
      )}
      {!agreementId &&
        list.value &&
        (!list.value.items.length ? (
          <p className="py-8 text-sm text-slate-400">No agreements yet</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {list.value.items.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/console/agreements/${item.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0">
                    <h2 className="break-words font-medium">
                      {item.context.track.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {item.context.owner.name} · Version{" "}
                      {item.current.proposal.version}
                    </p>
                  </div>
                  <span className="text-sm text-slate-400">
                    {labels[item.current.state]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
      {detail && current && (
        <>
          <section className={panel} aria-label="Contributor consent">
            <h2 className="text-lg font-semibold">Contributor consent</h2>
            <ul className="divide-y divide-white/10">
              {current.proposal.recipients.map((r) => {
                const response = current.responses
                  .filter((v) => v.walletAddress === r.walletAddress)
                  .at(-1);
                return (
                  <li
                    key={r.walletAddress}
                    className="flex flex-wrap justify-between gap-3 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium">
                        {name(r.walletAddress)}
                      </p>
                      <p
                        title={r.walletAddress}
                        className="mt-1 text-xs text-slate-400"
                      >
                        {r.role.replaceAll("_", " ")} ·{" "}
                        {r.walletAddress.slice(0, 8)}…
                        {r.walletAddress.slice(-5)}
                      </p>
                      {response?.reason && (
                        <p className="mt-2 break-words text-sm">
                          {response.reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p>{Number((r.shareBps / 100).toFixed(2))}%</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {response
                          ? {
                              accept: "Accepted",
                              reject: "Rejected",
                              dispute: "Disputed",
                            }[response.action]
                          : current.state === "draft"
                            ? "Not sent"
                            : "Awaiting response"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {current.proposal.terms && (
              <div className="border-t border-white/10 pt-4">
                <h3 className="mb-2 text-sm font-medium">Additional terms</h3>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-400">
                  {current.proposal.terms}
                </p>
              </div>
            )}
          </section>
          {["rejected", "disputed"].includes(current.state) && (
            <section className={panel}>
              <h2 className="font-semibold">
                {current.state === "rejected"
                  ? "Proposal rejected"
                  : "Dispute needs review"}
              </h2>
              {canOperate ? (
                showResolution ? (
                  <>
                    <label className="block space-y-2 text-sm">
                      <span>Resolution</span>
                      <textarea
                        value={resolution}
                        maxLength={1000}
                        disabled={busy}
                        onChange={(e) => setResolution(e.target.value)}
                        className="min-h-24 w-full rounded-md border border-white/15 bg-transparent p-3"
                      />
                    </label>
                    <p className="text-xs text-slate-400">
                      The owner reviews the new draft. Everyone must sign again.
                    </p>
                    <div className="flex flex-wrap justify-end gap-3">
                      <Button
                        disabled={busy}
                        variant="outline"
                        onClick={() => setShowResolution(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        disabled={busy || !resolution.trim()}
                        onClick={() =>
                          void action(`/agreements/${detail.id}/resolutions`, {
                            ...selection,
                            resolution: resolution.trim(),
                          })
                        }
                      >
                        Create revised draft
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button onClick={() => setShowResolution(true)}>
                    Record resolution
                  </Button>
                )
              ) : (
                <p className="text-sm text-slate-400">
                  Waiting for a revised proposal
                </p>
              )}
            </section>
          )}
          {canOperate && current.state === "ready" && !activeAttempt && (
            <Button
              disabled={busy}
              onClick={() =>
                void action(`/agreements/${detail.id}/finalizations`, selection)
              }
            >
              Prepare finalization
            </Button>
          )}
          {attempt && (
            <section className={panel} aria-label="Finalization">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">Finalization</h2>
                <span className="text-sm text-slate-400">
                  {attempt.status === "confirmed"
                    ? "Confirmed"
                    : attempt.status === "awaiting_signatures"
                      ? `${attempt.signedBy.length} of 2 signatures`
                      : ["submitting", "submitted"].includes(attempt.status)
                        ? "Confirming…"
                        : attempt.status === "expired"
                          ? "Expired"
                          : "Failed"}
                </span>
              </div>
              {waiting && attempt.status !== "awaiting_signatures" && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm text-slate-400"
                >
                  <LoaderCircle className="size-4 animate-spin" />
                  Waiting for network confirmation
                </p>
              )}
              {attempt.status === "awaiting_signatures" && (
                <ul className="space-y-2 text-sm">
                  {attempt.signers.map((signer, i) => (
                    <li
                      key={signer}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <Check
                        className={`size-4 ${attempt.signedBy.includes(signer) ? "text-emerald-400" : "text-slate-600"}`}
                      />
                      <span>Signer {i + 1}</span>
                      <span title={signer} className="text-xs text-slate-400">
                        {signer.slice(0, 8)}…{signer.slice(-5)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {attempt.signedBy.includes(signer)
                          ? "Signed"
                          : "Awaiting signature"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {attempt.status === "awaiting_signatures" && canOperate && (
                <>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={download}
                    >
                      Download transaction
                    </Button>
                    <label className="flex cursor-pointer items-center rounded-md border border-white/15 px-3 py-2 text-sm">
                      Import signature
                      <input
                        type="file"
                        accept=".xdr,.txt"
                        disabled={busy}
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void file.text().then(setSignedXdr);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm text-slate-400">
                      Paste signed transaction
                    </summary>
                    <label className="mt-3 block space-y-2 text-sm">
                      <span>Signed transaction XDR</span>
                      <textarea
                        disabled={busy}
                        value={signedXdr}
                        onChange={(e) => setSignedXdr(e.target.value)}
                        className="min-h-28 w-full rounded-md border border-white/15 bg-transparent p-3 font-mono text-xs"
                      />
                    </label>
                  </details>
                  {signedXdr && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">
                        Signature ready to verify
                      </p>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void action(
                            `/agreements/${detail.id}/finalizations/${attempt.id}/signatures`,
                            { signedTransaction: signedXdr.trim() },
                          )
                        }
                      >
                        Add verified signature
                      </Button>
                    </div>
                  )}
                  <Button
                    disabled={
                      busy ||
                      attempt.signedBy.length < 2 ||
                      Date.parse(attempt.expiresAt) <= Date.now()
                    }
                    onClick={() =>
                      void action(
                        `/agreements/${detail.id}/finalizations/${attempt.id}/submit`,
                      )
                    }
                  >
                    Submit finalization
                  </Button>
                </>
              )}
              {["failed", "expired"].includes(attempt.status) && (
                <p className="text-sm text-slate-400">
                  No agreement activated by this attempt. Prepare a new
                  transaction when ready.
                </p>
              )}
              {attempt.status === "confirmed" && attempt.explorerUrl && (
                <a
                  href={attempt.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-emerald-300 underline"
                >
                  View confirmed publication
                </a>
              )}
            </section>
          )}
          <details className="border-t border-white/10 pt-4">
            <summary className="cursor-pointer text-sm">
              Version history
            </summary>
            <div className="mt-4 space-y-5">
              {[...detail.versions].reverse().map((v) => (
                <section key={v.proposal.version} className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    Version {v.proposal.version} · {labels[v.state]}
                    {detail.effectiveVersion === v.proposal.version
                      ? " · Current"
                      : ""}
                  </h3>
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-400">
                    {v.proposal.terms}
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
                              className="text-xs text-slate-400"
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
                  {detail.events
                    .filter((e) => e.version === v.proposal.version)
                    .map((e) => (
                      <div key={e.id} className="text-xs text-slate-400">
                        <p>
                          {e.action.replaceAll("_", " ")} ·{" "}
                          {name(e.actor_wallet)} ·{" "}
                          {new Date(e.created_at).toLocaleString()}
                        </p>
                        {typeof e.payload.resolution === "string" && (
                          <p className="mt-1 break-words">
                            {e.payload.resolution}
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
                        className="inline-block text-xs text-emerald-300 underline"
                      >
                        View publication receipt
                      </a>
                    ))}
                </section>
              ))}
            </div>
          </details>
          <details className="border-t border-white/10 pt-4">
            <summary className="cursor-pointer text-sm">
              Verification details
            </summary>
            <dl className="mt-4 space-y-3 text-xs text-slate-400">
              <div>
                <dt>Proposal hash</dt>
                <dd className="break-all font-mono">{current.proposalHash}</dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>{current.proposal.networkPassphrase}</dd>
              </div>
              {current.proposal.recipients.map((r) => (
                <div key={r.walletAddress}>
                  <dt>{name(r.walletAddress)}</dt>
                  <dd className="break-all font-mono">{r.walletAddress}</dd>
                </div>
              ))}
              {attempt && (
                <>
                  <div>
                    <dt>Treasury</dt>
                    <dd className="break-all font-mono">
                      {attempt.treasuryAddress}
                    </dd>
                  </div>
                  <div>
                    <dt>Registry</dt>
                    <dd className="break-all font-mono">
                      {attempt.contractId}
                    </dd>
                  </div>
                  <div>
                    <dt>Transaction hash</dt>
                    <dd className="break-all font-mono">
                      {attempt.transactionHash}
                    </dd>
                  </div>
                  <div>
                    <dt>Expires</dt>
                    <dd>{new Date(attempt.expiresAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Prepared transaction XDR</dt>
                    <dd>
                      <textarea
                        aria-label="Prepared transaction XDR"
                        readOnly
                        value={attempt.transaction}
                        className="mt-2 min-h-24 w-full rounded border border-white/15 bg-transparent p-3 font-mono text-xs"
                      />
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </details>
        </>
      )}
    </main>
  );
}
