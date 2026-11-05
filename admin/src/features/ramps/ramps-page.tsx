import { useEffect, useState } from "react";
import { useAdminAuth } from "@/features/auth/providers/admin-auth-provider";
import { httpClient } from "@/lib/api/http-client";
import { Button } from "@/components/ui/button";

type Order = {
  id: string; userId: string; walletAddress: string; provider: string; direction: string;
  environment: string; network: string; assetCode: string;
  market: { country: string; currency: string; method: string };
  amount: { units: string; decimals: number; currency: string };
  providerState: string; chainState: string; providerTransactionId: string | null;
  createdAt: string; updatedAt: string;
};
type Detail = {
  order: Order;
  events: { source: string; kind: string; created_at: string }[];
  attempts: { transaction_hash: string; state: string; created_at: string; submission_count: number; last_error_code: string | null }[];
  deliveries: { transaction_hash: string; operation_id: string; ledger: string; asset_units: string }[];
  receipts: { kind: string; transaction_hash: string; ledger: string; fee_charged: string }[];
  job: { attempts: number; last_error_code: string | null; due_at: string } | null;
};
function amount(value: Order["amount"]) {
  const digits = value.units.padStart(value.decimals + 1, "0");
  return `${value.decimals ? `${digits.slice(0, -value.decimals)}.${digits.slice(-value.decimals)}` : digits} ${value.currency}`;
}
const readable = (value: string) => value.replaceAll("_", " ");
const panel = "rounded-xl border border-white/10 bg-white/[0.025] p-5";

export function AdminRampsPage() {
  const { session } = useAdminAuth();
  const token = session?.token;
  const [items, setItems] = useState<Order[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestProviderEvent = detail?.events.find((event) => event.source === "provider_api" && ["status_conflict", "status_observed"].includes(event.kind));
  const providerConflict = detail?.order.providerState === "unknown" && latestProviderEvent?.kind === "status_conflict";
  useEffect(() => {
    if (!token) return;
    let active = true;
    let pending = false;
    const controller = new AbortController();
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const list = await httpClient.get<{ items: Order[] }>("/ramps", token, controller.signal);
        const current = selected ? await httpClient.get<Detail>(`/ramps/${encodeURIComponent(selected)}`, token, controller.signal) : null;
        if (active) { setItems(list.items); setDetail(current); setError(null); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load transactions");
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    }
    setLoading(true);
    setDetail(null);
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [token, selected]);
  return (
    <main className="space-y-6 p-4 text-slate-100 md:p-8">
      <header><h1 className="text-2xl font-semibold">Funding and cash-out</h1><p className="mt-2 text-sm text-slate-400">Transaction history and reconciliation</p></header>
      {selected && <Button variant="outline" onClick={() => setSelected(null)}>Back to transactions</Button>}
      {error && <p role="alert" className="rounded-xl border border-red-400/30 p-4 text-red-200">{error}</p>}
      {loading && <p role="status" className="text-sm text-slate-400">Loading transactions…</p>}
      {!loading && !error && selected && detail ? <>
        <section className={`${panel} space-y-5`} aria-label="Transaction details">
          <div><h2 className="text-xl font-semibold">{amount(detail.order.amount)}</h2><p className="mt-1 text-sm text-slate-400">{detail.order.direction === "buy" ? "Funding" : "Cash-out"} · {detail.order.provider} · {detail.order.environment}</p></div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[["Provider status", readable(detail.order.providerState)], ["Chain status", readable(detail.order.chainState)], ["Market", `${detail.order.market.country} · ${detail.order.market.currency} · ${readable(detail.order.market.method)}`], ["Asset and network", `${detail.order.assetCode} · ${detail.order.network}`], ["User", detail.order.userId], ["Wallet", detail.order.walletAddress], ["Provider reference", detail.order.providerTransactionId ?? "Not available"]].map(([label, value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd className="mt-1 break-all">{value}</dd></div>)}
          </dl>
          {providerConflict && <p role="status" className="rounded-lg border border-amber-400/30 p-3 text-sm text-amber-200">Provider statuses conflict. Check with the provider before taking further action.</p>}
          {detail.order.providerState === "refund_failed" && <p role="alert" className="rounded-lg border border-red-400/30 p-3 text-sm text-red-200">The provider could not return the funds. Do not mark this transaction refunded; follow up with the provider.</p>}
          {detail.job?.last_error_code && !(providerConflict && detail.job.last_error_code === "provider_status_conflict") && <p role="status" className="rounded-lg border border-amber-400/30 p-3 text-sm text-amber-200">Reconciliation needs attention: {readable(detail.job.last_error_code)} · {detail.job.attempts} attempts</p>}
          <div><h3 className="font-medium">Chain attempts</h3>{detail.attempts.length ? <ul className="mt-2 space-y-2 text-sm text-slate-300">{detail.attempts.map((attempt) => <li key={attempt.transaction_hash} className="break-all">{readable(attempt.state)} · {attempt.transaction_hash}{attempt.last_error_code && <> · {readable(attempt.last_error_code)}</>}{attempt.state === "confirmed" && /^[a-f0-9]{64}$/.test(attempt.transaction_hash) && detail.order.network === "stellar:testnet" && <> · <a className="underline" target="_blank" rel="noreferrer" href={`https://stellar.expert/explorer/testnet/tx/${attempt.transaction_hash}`}>View receipt</a></>}</li>)}</ul> : <p className="mt-2 text-sm text-slate-400">No chain attempts yet.</p>}</div>
          {detail.receipts.length > 0 && <div><h3 className="font-medium">Transfer receipts</h3><ul className="mt-2 space-y-2 text-sm text-slate-300">{detail.receipts.map((receipt) => <li key={`${receipt.transaction_hash}:${receipt.kind}`} className="break-all">{readable(receipt.kind)} · ledger {receipt.ledger} · fee {receipt.fee_charged} stroops{receipt.kind === "cashout_transfer_failed" && /^[a-f0-9]{64}$/.test(receipt.transaction_hash) && detail.order.network === "stellar:testnet" && <> · <a className="underline" target="_blank" rel="noreferrer" href={`https://stellar.expert/explorer/testnet/tx/${receipt.transaction_hash}`}>View receipt</a></>}</li>)}</ul></div>}
          {detail.deliveries.length > 0 && <div><h3 className="font-medium">Received transfers</h3><ul className="mt-2 space-y-2 text-sm text-slate-300">{detail.deliveries.map((delivery) => <li key={`${delivery.transaction_hash}:${delivery.operation_id}`} className="break-all">{delivery.transaction_hash} · ledger {delivery.ledger}{/^[a-f0-9]{64}$/.test(delivery.transaction_hash) && detail.order.network === "stellar:testnet" && <> · <a className="underline" target="_blank" rel="noreferrer" href={`https://stellar.expert/explorer/testnet/tx/${delivery.transaction_hash}`}>View receipt</a></>}</li>)}</ul></div>}
          <div><h3 className="font-medium">Activity</h3>{detail.events.length ? <ul className="mt-2 space-y-2 text-sm text-slate-300">{detail.events.map((event, index) => <li key={`${event.created_at}-${index}`}>{readable(event.kind)} · {new Date(event.created_at).toLocaleString()}</li>)}</ul> : <p className="mt-2 text-sm text-slate-400">No activity yet.</p>}</div>
        </section>
      </> : !loading && !error && !selected ? <section className={panel} aria-label="Transactions">
        {items.length ? <ul className="divide-y divide-white/10">{items.map((item) => <li key={item.id}><button type="button" onClick={() => setSelected(item.id)} className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"><span><span className="block font-medium">{amount(item.amount)}</span><span className="mt-1 block text-sm text-slate-400">{item.direction === "buy" ? "Funding" : "Cash-out"} · {item.provider} · {new Date(item.createdAt).toLocaleString()}</span></span><span className="text-sm text-slate-300">{readable(item.providerState)} · chain {readable(item.chainState)}</span></button></li>)}</ul> : <p className="text-sm text-slate-400">No transactions yet.</p>}
      </section> : null}
    </main>
  );
}
