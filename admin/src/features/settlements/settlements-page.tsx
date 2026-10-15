import { useCallback, useEffect, useState } from "react";
import type { FinancialAttempt, SettlementBatch } from "@music-city/shared";
import { Loader2 } from "lucide-react";
import { useAdminAuth } from "@/features/auth/providers/admin-auth-provider";
import { httpClient } from "@/lib/api/http-client";
import { Button } from "@/components/ui/button";
type Source = {
  trackId: string;
  sourceType: string;
  sourceId: string;
  allocations: number;
};
type Reconciliation={snapshot:null|{ok:boolean;checkedAt:string;fundedUnits:string;claimedUnits:string;reclaimedUnits:string;openUnits:string;escrowBalanceUnits:string;networkFeeXlmUnits:string;discrepancies:{batchId:string;message:string}[]};stale:boolean;error:string|null};
type Detail = {
  batch: SettlementBatch;
  attempts: FinancialAttempt[];
  events: { id: string; action: string; created_at: string; payload: object }[];
};
const money = (value: string) => {
  const n = BigInt(value);
  return `${n / 10000000n}.${(n % 10000000n).toString().padStart(7, "0")}`;
};
const panel = "rounded-xl border border-white/10 bg-white/[0.025] p-5";
export function AdminSettlementsPage() {
  const { session } = useAdminAuth();
  const token = session?.token,
    canOperate = session?.role === "super_admin";
  const [items, setItems] = useState<SettlementBatch[]>([]),
    [sources, setSources] = useState<Source[]>([]),
    [detail, setDetail] = useState<Detail | null>(null);
  const [source, setSource] = useState<Source | null>(null),
    [preview, setPreview] = useState<SettlementBatch | null>(null),
    [expiry, setExpiry] = useState(() =>
      new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    );
  const [reconciliation,setReconciliation]=useState<Reconciliation|null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true);
  const load = useCallback(
    async (id?: string) => {
      if (!token) return;
      const [b, s, reconciliation] = await Promise.all([
        httpClient.get<{ items: SettlementBatch[] }>("/settlements", token),
        httpClient.get<{ items: Source[] }>("/settlements/sources", token),
      httpClient.get<Reconciliation>("/settlements/reconciliation",token),
      ]);
      setItems(b.items);
      setSources(s.items);setReconciliation(reconciliation);
      if (id)
        setDetail(await httpClient.get<Detail>(`/settlements/${id}`, token));
    },
    [token],
  );
  useEffect(() => {
    setDetail(null);
    setPreview(null);
    setSource(null);
    setItems([]);
    setLoading(true);
    void load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => {
      void load(detail?.batch.id).catch((e) => setError(e.message));
    }, 5000);
    return () => clearInterval(timer);
  }, [load, detail?.batch.id]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settlement action failed");
    } finally {
      setBusy(false);
    }
  }
  async function action(path: string, body: unknown = {}) {
    await run(async () => {
      await httpClient.post(path, body, token);
      await load(detail?.batch.id);
      setSigned({});
    });
  }
  function download(attempt: FinancialAttempt) {
    const url = URL.createObjectURL(
      new Blob([attempt.transaction], { type: "text/plain" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${attempt.kind}-${attempt.transactionHash}.xdr`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const b = detail?.batch;
  return (
    <main aria-busy={busy} className="space-y-6 p-4 text-slate-100 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Earnings settlements</h1>
        {busy && <span role="status" aria-label="Updating settlement" className="mt-3 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="size-4 animate-spin"/>Updating settlement</span>}
        <p className="mt-2 text-sm text-slate-400">
          Fund approved earnings with two treasury signatures. Contributors
          claim their own USDC.
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/30 p-4 text-red-200"
        >
          {error}
        </p>
      )}
        <section aria-label="Contract reconciliation" className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Contract reconciliation</h2>{!reconciliation?.snapshot||reconciliation.stale?<p role="status" className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="size-4 animate-spin"/>Checking financial records</p>:<p role="status" className={reconciliation.snapshot.ok?"text-sm text-emerald-300":"text-sm text-amber-200"}>{reconciliation.snapshot.ok?"Reconciled":"Needs attention"}</p>}</div>
        {reconciliation?.snapshot&&<dl className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-5">{[["Funded",reconciliation.snapshot.fundedUnits],["Claimed",reconciliation.snapshot.claimedUnits],["Recovered",reconciliation.snapshot.reclaimedUnits],["Unclaimed",reconciliation.snapshot.openUnits],["Escrow USDC",reconciliation.snapshot.escrowBalanceUnits]].map(([label,value])=><div key={label} className="rounded-lg bg-white/5 p-3"><dt className="text-slate-400">{label}</dt><dd className="mt-1 break-words">{money(value!)}</dd></div>)}</dl>}
        {reconciliation?.snapshot&&<p className="mt-3 text-xs text-slate-400">Network fees: {money(reconciliation.snapshot.networkFeeXlmUnits)} XLM</p>}
        {reconciliation?.error&&<p role="alert" className="mt-3 text-sm text-amber-200">{reconciliation.error}</p>}
        {reconciliation?.snapshot&&!reconciliation.snapshot.ok&&<ul role="alert" className="mt-3 space-y-2 text-sm text-amber-200">{reconciliation.snapshot.discrepancies.map((d,index)=><li key={`${d.batchId}:${index}`}>{d.message}</li>)}</ul>}
      </section>
    {detail ? (
        <>
          <Button variant="outline" onClick={() => setDetail(null)}>
            Back to settlements
          </Button>
          <section className={`${panel} space-y-5`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {money(b!.fundedUnits)} USDC
                </h2>
                <p className="mt-1 capitalize text-emerald-300">{b!.state}</p>
              </div>
              <p className="text-sm text-slate-400">
                Expires {new Date(b!.expiresAt).toLocaleString()}
              </p>
            </div>
            {b!.discrepancy && (
              <p
                role="alert"
                className="rounded-lg border border-amber-400/30 p-3 text-amber-200"
              >
                {b!.discrepancy}
              </p>
            )}
            <div className="grid grid-cols-3 gap-3 text-sm">
              {["available", "claimed", "reclaimed"].map((status) => (
                <div key={status} className="rounded-lg bg-white/5 p-3">
                  <p className="capitalize text-slate-400">
                    {status === "available" ? "Unclaimed" : status}
                  </p>
                  <p className="mt-1 break-words">
                    {money(
                      b!.allocations
                        .filter((a) => a.status === status)
                        .reduce((n, a) => n + BigInt(a.amountUnits), 0n)
                        .toString(),
                    )}{" "}
                    USDC
                  </p>
                </div>
              ))}
            </div>
            <ul className="divide-y divide-white/10">
              {b!.allocations.map((a) => (
                <li
                  key={a.index}
                  className="flex flex-wrap justify-between gap-3 py-4"
                >
                  <div>
                    <p>
                      {money(a.amountUnits)} USDC · {a.status}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-slate-400">
                      {a.beneficiary}
                    </p>
                  </div>
                  {canOperate &&
                    a.status === "available" &&
                    Date.parse(b!.expiresAt) <= Date.now() && (
                      <Button
                        disabled={busy || detail.attempts.some(attempt=>attempt.kind==="reclaim"&&attempt.claimIndex===a.index&&["awaiting_signatures","submitting","submitted","confirmed"].includes(attempt.status))}
                        onClick={() =>
                          action(
                            `/settlements/${b!.id}/claims/${a.index}/reclaim`,
                          )
                        }
                      >
                        Prepare recovery
                      </Button>
                    )}
                </li>
              ))}
            </ul>
            {canOperate && b!.state === "reserved" && (
              <Button
                disabled={
                  busy ||
                  detail.attempts.some(
                    (a) =>
                      a.kind === "settle" &&
                      !["expired", "failed"].includes(a.status),
                  )
                }
                onClick={() => action(`/settlements/${b!.id}/prepare`)}
              >
                Prepare treasury funding
              </Button>
            )}
            <details>
              <summary className="cursor-pointer text-sm text-slate-400">
                Agreement and source evidence
              </summary>
              {canOperate && (
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => action(`/settlements/${b!.id}/maintenance`)}
                >
                  Maintain contract records
                </Button>
              )}
              <dl className="mt-3 space-y-2 break-all text-xs">
                <dt>Batch</dt>
                <dd>{b!.id}</dd>
                <dt>Track</dt>
                <dd>{b!.trackId}</dd>
                <dt>Agreement version {b!.version}</dt>
                <dd>
                  {b!.agreementId} · {b!.proposalHash}
                </dd>
                <dt>USDC issuer</dt>
                <dd>{b!.config.assetIssuer}</dd>
                <dt>Contract</dt>
                <dd>{b!.config.contractId}</dd>
                <dt>Network</dt>
                <dd>{b!.config.networkPassphrase}</dd>
                <dt>Source</dt>
                <dd>
                  {b!.sourceType} · {b!.sourceId}
                </dd>
              </dl>
            </details>
          </section>
          {detail.attempts
            .filter((a) => a.kind !== "claim")
            .map((a) => (
              <section key={a.id} className={`${panel} space-y-4`}>
                <h3 className="font-semibold capitalize">
                  {a.kind === "settle"
                    ? "Treasury funding"
                    : a.kind === "restore"
                      ? "Restore archived records"
                      : a.kind === "maintain"
                        ? "Maintain contract records"
                        : "Expired claim recovery"}
                </h3>
                <div className="flex items-center gap-2 text-sm">
                  {["submitting", "submitted"].includes(a.status) && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  <span role="status">{a.status.replaceAll("_", " ")}</span>
                </div>
                {a.error && <p className="text-sm text-amber-200">{a.error}</p>}
                {a.status === "awaiting_signatures" && (
                  <>
                    <div>
                      <p className="text-sm">
                        {a.signedBy.length} of 2 treasury signatures
                      </p>
                      <div className="mt-2 h-2 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{
                            width: `${Math.min(a.signedBy.length / 2, 1) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">
                      Transaction expires{" "}
                      {new Date(a.expiresAt).toLocaleString()}
                    </p>
                    {canOperate && (
                      <>
                        <Button variant="outline" onClick={() => download(a)}>
                          Download transaction to sign
                        </Button>
                        <label className="block text-sm">
                          Signed transaction XDR
                          <textarea
                            value={signed[a.id] ?? ""}
                            onChange={(e) =>
                              setSigned((v) => ({
                                ...v,
                                [a.id]: e.target.value,
                              }))
                            }
                            className="mt-2 min-h-24 w-full rounded-lg border border-white/15 bg-black/20 p-3 font-mono text-xs"
                          />
                        </label>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            disabled={busy || !signed[a.id]?.trim()}
                            variant="outline"
                            onClick={() =>
                              action(
                                `/settlements/attempts/${a.id}/signatures`,
                                { signedTransaction: signed[a.id] },
                              )
                            }
                          >
                            Add verified signature
                          </Button>
                          <Button
                            disabled={busy || a.signedBy.length < 2}
                            onClick={() =>
                              action(`/settlements/attempts/${a.id}/submit`)
                            }
                          >
                            Submit authorized transaction
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
                <details>
                  <summary className="cursor-pointer text-sm text-slate-400">
                    Transaction evidence
                  </summary>
                  <p className="mt-2 break-all font-mono text-xs">
                    {a.transactionHash}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {a.signers.map((s) => (
                      <li key={s} className="break-all">
                        {a.signedBy.includes(s) ? "Signed" : "Awaiting"} · {s}
                      </li>
                    ))}
                  </ul>
                </details>
                {a.status === "confirmed" && (
                  <a
                    className="text-sm text-emerald-300 underline"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://stellar.expert/explorer/${a.networkPassphrase.includes("Test SDF") ? "testnet" : "public"}/tx/${a.transactionHash}`}
                  >
                    View confirmed transaction · ledger {a.ledger}
                  </a>
                )}
              </section>
            ))}
          <details className={panel}>
            <summary>Audit history</summary>
            <ol className="mt-3 space-y-2 text-sm">
              {detail.events.map((e) => (
                <li key={e.id}>
                  {new Date(e.created_at).toLocaleString()} ·{" "}
                  {e.action.replaceAll("_", " ")}
                </li>
              ))}
            </ol>
          </details>
        </>
      ) : (
        <>
          {canOperate && (
            <section className={`${panel} space-y-4`}>
              <h2 className="text-lg font-semibold">Prepare a settlement</h2>
              {!sources.length ? (
                <p className="text-sm text-slate-400">
                  No approved, unreserved earnings sources.
                </p>
              ) : (
                <div className="grid gap-2">
                  {sources.map((s) => (
                    <button
                      key={`${s.trackId}:${s.sourceType}:${s.sourceId}`}
                      className={`rounded-lg border p-3 text-left text-sm ${source === s ? "border-emerald-400" : "border-white/10"}`}
                      onClick={() => {
                        setSource(s);
                        setPreview(null);
                      }}
                    >
                      <span className="capitalize">
                        {s.sourceType.replaceAll("_", " ")}
                      </span>
                      <span className="ml-2 text-slate-400">
                        {s.allocations} allocations
                      </span>
                      <span className="mt-1 block break-all text-xs text-slate-400">
                        {s.trackId} · {s.sourceId}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {source && (
                <>
                  <label className="block text-sm">
                    Claim deadline, UTC
                    <input
                      type="datetime-local"
                      value={expiry}
                      onChange={(e) => {
                        setExpiry(e.target.value);
                        setPreview(null);
                      }}
                      className="ml-3 rounded-lg border border-white/15 bg-black/20 p-2"
                    />
                  </label>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const r = await httpClient.post<{
                          batch: SettlementBatch;
                        }>(
                          "/settlements/preview",
                          {
                            trackId: source.trackId,
                            sourceType: source.sourceType,
                            sourceId: source.sourceId,
                            expiresAt: new Date(`${expiry}:00Z`).toISOString(),
                          },
                          token,
                        );
                        setPreview(r.batch);
                      })
                    }
                  >
                    Review allocations
                  </Button>
                </>
              )}
              {preview && (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <p className="font-semibold">
                    {money(preview.fundedUnits)} USDC · Agreement v
                    {preview.version}
                  </p>
                  {preview.allocations.map((a) => (
                    <p key={a.index} className="break-all text-sm">
                      {money(a.amountUnits)} USDC → {a.beneficiary}
                    </p>
                  ))}
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await httpClient.post(
                          "/settlements/reserve",
                          {
                            previewId: preview.id,
                            source: {
                              trackId: preview.trackId,
                              sourceType: preview.sourceType,
                              sourceId: preview.sourceId,
                              expiresAt: preview.expiresAt,
                            },
                          },
                          token,
                        );
                        await load(preview.id);
                        setPreview(null);
                      })
                    }
                  >
                    Reserve reviewed earnings
                  </Button>
                </div>
              )}
            </section>
          )}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Settlement history</h2>
            {loading ? (
              <p role="status">Loading settlements…</p>
            ) : !items.length ? (
              <p className="text-sm text-slate-400">
                No settlements prepared yet.
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  className={`${panel} flex w-full flex-wrap justify-between gap-3 text-left`}
                  onClick={() => run(() => load(item.id))}
                >
                  <span>{money(item.fundedUnits)} USDC</span>
                  <span className="capitalize text-emerald-300">
                    {item.state}
                  </span>
                  <span className="w-full text-xs text-slate-400">
                    Agreement v{item.version} ·{" "}
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </button>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}
