import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { httpClient } from "@/lib/api/http-client";
import { CashOutReview } from "./cash-out-review";
import { AddFundsDialog, type FundingRoute } from "./add-funds-dialog";
import { ResumeFundingDialog } from "./resume-funding-dialog";

type Order = {
  id: string; direction: "buy" | "sell"; provider: string; providerState: string; chainState: string; launchRequested: boolean; providerStarted: boolean;
  amount: { currency: string; units: string; decimals: number }; assetCode: string; market: { country: string; currency: string; method: string }; createdAt: string;
};
const providerStatus: Record<string, string> = {
  created: "Not started", awaiting_user: "Action needed", processing: "Processing", ready_for_pickup: "Ready for pickup",
  completed: "Provider completed", failed: "Failed", cancelled: "Cancelled", refund_pending: "Refund pending", refunded: "Refunded", unknown: "Checking status",
};
const chainStatus: Record<string, string> = {
  unobserved: "Transfer unconfirmed", prepared: "Transfer prepared", submitting: "Transfer pending", confirmed: "Transfer confirmed", failed: "Transfer failed", unknown: "Checking transfer", expired: "Transfer expired",
};
function money(value: Order["amount"]) {
  const digits = value.units.padStart(value.decimals + 1, "0");
  return `${value.decimals ? `${digits.slice(0, -value.decimals)}.${digits.slice(-value.decimals)}` : digits} ${value.currency}`;
}

export function WalletRampActivity({ token, sign }: { token: string; sign?: (transaction: string) => Promise<string> }) {
  const [items, setItems] = useState<Order[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [resume, setResume] = useState<Order | null>(null);
  const [funding, setFunding] = useState(false);
  const [routes, setRoutes] = useState<FundingRoute[]>([]);
  useEffect(() => {
    let active = true;
    setRoutes([]);
    void httpClient.get<{ routes: FundingRoute[] }>("/ramps/capabilities", token).then((result) => {
      if (active && Array.isArray(result.routes)) setRoutes(result.routes.filter((route) => route.direction === "buy"));
    }).catch(() => {});
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    let active = true;
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const result = await httpClient.get<{ items: Order[] }>("/ramps", token);
        if (active) { setItems(result.items); setError(false); }
      } catch {
        if (active) setError(true);
      } finally { if (active) setLoading(false); pending = false; }
    }
    setLoading(true);
    setError(false);
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token, retry]);
  const resumeAvailable = resume !== null && routes.some((route) => {
    if (route.provider !== resume.provider || route.assetCode !== resume.assetCode ||
        route.market.country !== resume.market?.country || route.market.currency !== resume.market?.currency ||
        route.market.method !== resume.market?.method || route.amountDecimals !== resume.amount.decimals) return false;
    try { return BigInt(resume.amount.units) >= BigInt(route.minUnits) && BigInt(resume.amount.units) <= BigInt(route.maxUnits); }
    catch { return false; }
  });
  const unresolved = items.some((item) => (item.launchRequested || item.providerStarted) &&
    (["created", "awaiting_user", "processing", "ready_for_pickup", "refund_pending", "unknown"].includes(item.providerState) ||
      ["submitting", "unknown"].includes(item.chainState) || (item.providerState === "completed" && item.chainState !== "confirmed")));
  return <section aria-label="Funding and cash-out" className="space-y-3 border-t border-white/10 pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-medium text-white">Funding and cash-out</h3>{routes.length === 0 && <p className="mt-1 text-sm text-slate-400">MoonPay and MoneyGram are unavailable</p>}</div>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!routes.length || unresolved || error || loading} onClick={() => setFunding(true)}>Add funds</Button><Button type="button" variant="outline" disabled>Cash out</Button></div>
    </div>
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-slate-300">Could not load transaction history. <Button type="button" variant="outline" onClick={() => setRetry((value) => value + 1)}>Try again</Button></div>}
    {unresolved && <p className="text-sm text-slate-400">Check your pending transaction before starting another.</p>}
    {items.length > 0 && <div className="space-y-2"><h4 className="text-sm font-medium text-white">Transactions</h4><ul className="divide-y divide-white/10">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium text-white">{item.direction === "buy" ? "Add funds" : "Cash-out"} · {money(item.amount)}</p><p className="mt-1 text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</p></div><div className="flex flex-wrap items-center gap-3"><p className="text-slate-300">{(item.launchRequested || item.providerStarted) && item.providerState === "created" ? "Checking status" : providerStatus[item.providerState] ?? "Checking status"}{(item.launchRequested || item.providerStarted || item.chainState !== "unobserved" || !["created", "cancelled"].includes(item.providerState)) && <> · {chainStatus[item.chainState] ?? "Checking transfer"}</>}</p>{item.direction === "buy" && item.provider === "moonpay" && item.providerState === "created" && !item.launchRequested && !item.providerStarted && <Button type="button" variant="outline" disabled={unresolved || loading || error} onClick={() => setResume(item)}>Manage</Button>}{item.direction === "sell" && item.chainState === "prepared" && sign && <Button type="button" variant="outline" onClick={() => setReviewId(item.id)}>Review cash-out</Button>}</div></li>)}</ul></div>}
    {reviewId && sign && <CashOutReview token={token} orderId={reviewId} sign={sign} onClose={() => setReviewId(null)} onChanged={() => setRetry((value) => value + 1)} />}
    {funding && routes.length > 0 && <AddFundsDialog token={token} routes={routes} onClose={() => setFunding(false)} onChanged={() => setRetry((value) => value + 1)} />}
    {resume && <ResumeFundingDialog token={token} orderId={resume.id} provider={resume.provider} available={resumeAvailable} onClose={() => setResume(null)} onChanged={() => setRetry((value) => value + 1)} />}
  </section>;
}
