import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { httpClient } from "@/lib/api/http-client";
import { CashOutReview } from "./cash-out-review";
import { AddFundsDialog, type FundingRoute } from "./add-funds-dialog";
import { ResumeFundingDialog } from "./resume-funding-dialog";
import { CashOutStartDialog, type CashOutRoute } from "./cash-out-start-dialog";
import { CashOutQuoteDialog } from "./cash-out-quote-dialog";
import type { RampProvider } from "@music-city/shared";
import { rampProviderName } from "./provider-handoff";

type Order = {
  id: string; direction: "buy" | "sell"; provider: RampProvider; providerState: string; chainState: string; launchRequested: boolean; providerStarted: boolean;
  amount: { currency: string; units: string; decimals: number }; assetCode: string; market: { country: string; currency: string; method: string }; createdAt: string; updatedAt?: string;
};
const providerStatus: Record<string, string> = {
  created: "Not started", awaiting_user: "Action needed", processing: "Processing", ready_for_pickup: "Ready for pickup",
  completed: "Provider completed", failed: "Failed", cancelled: "Cancelled", refund_pending: "Refund pending", refunded: "Refunded", refund_failed: "Refund failed", unknown: "Checking status",
};
const chainStatus: Record<string, string> = {
  unobserved: "Transfer unconfirmed", prepared: "Transfer prepared", submitting: "Transfer pending", confirmed: "Transfer confirmed", failed: "Transfer failed", unknown: "Checking transfer", expired: "Transfer expired",
};
const methodLabel: Record<string, string> = { card: "Card", bank: "Bank transfer", apple_pay: "Apple Pay", google_pay: "Google Pay", cash_pickup: "Cash pickup", cash_deposit: "Cash deposit", mobile_money: "Mobile money" };
function money(value: Order["amount"]) {
  const digits = value.units.padStart(value.decimals + 1, "0");
  return `${value.decimals ? `${digits.slice(0, -value.decimals)}.${digits.slice(-value.decimals)}` : digits} ${value.currency}`;
}
function providerLabel(order: Order) {
  if ((order.launchRequested || order.providerStarted) && order.providerState === "created") return "Checking status";
  return providerStatus[order.providerState] ?? "Checking status";
}
function chainLabel(order: Order) {
  return chainStatus[order.chainState] ?? "Checking transfer";
}
function showsChainState(order: Order) {
  return order.launchRequested || order.providerStarted || order.chainState !== "unobserved" || !["created", "cancelled"].includes(order.providerState);
}

type WalletRampActivityProps = { token: string; sign?: (transaction: string) => Promise<string>; spendableUsdc?: string; showTransactions?: boolean };

export function WalletRampActivity(props: WalletRampActivityProps) {
  return <WalletRampSession key={props.token} {...props} />;
}

function WalletRampSession({ token, sign, spendableUsdc = "0", showTransactions = true }: WalletRampActivityProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Order[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [resume, setResume] = useState<Order | null>(null);
  const [detail, setDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [detailRetry, setDetailRetry] = useState(0);
  const [routesRetry, setRoutesRetry] = useState(0);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError, setRoutesError] = useState(false);
  const [funding, setFunding] = useState(false);
  const [cashOut, setCashOut] = useState(false);
  const [cashOutRoutes, setCashOutRoutes] = useState<CashOutRoute[]>([]);
  const [routes, setRoutes] = useState<FundingRoute[]>([]);
  const detailId = searchParams.get("ramp");
  useEffect(() => {
    let active = true;
    setRoutesLoading(true);
    setRoutesError(false);
    setRoutes([]); setCashOutRoutes([]);
    void httpClient.get<{ routes: Array<FundingRoute | CashOutRoute> }>("/ramps/capabilities", token).then((result) => {
      if (active && Array.isArray(result.routes)) {
        setRoutes(result.routes.filter((route): route is FundingRoute => route.direction === "buy"));
        setCashOutRoutes(result.routes.filter((route): route is CashOutRoute => route.direction === "sell" && route.assetCode === "USDC"));
      }
    }).catch(() => {
      if (active) setRoutesError(true);
    }).finally(() => {
      if (active) setRoutesLoading(false);
    });
    return () => { active = false; };
  }, [token, routesRetry]);
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
  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      setDetailError(false);
      setDetailLoading(false);
      return;
    }
    let active = true;
    let pending = false;
    async function loadDetail() {
      if (pending) return;
      pending = true;
      try {
        const result = await httpClient.get<{ order: Order }>(`/ramps/${encodeURIComponent(detailId!)}`, token);
        if (result.order.id !== detailId) throw new Error("Unexpected transaction");
        if (active) {
          setDetail(result.order);
          setDetailError(false);
          setItems((current) => current.map((item) => item.id === result.order.id ? result.order : item));
        }
      } catch {
        if (active) setDetailError(true);
      } finally {
        if (active) setDetailLoading(false);
        pending = false;
      }
    }
    setDetail((current) => current?.id === detailId ? current : null);
    setDetailError(false);
    setDetailLoading(true);
    void loadDetail();
    const timer = window.setInterval(() => void loadDetail(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [detailId, detailRetry, token]);
  function routeMatches(item: Order, route: FundingRoute | CashOutRoute) {
    if (route.provider !== item.provider || route.direction !== item.direction || route.assetCode !== item.assetCode ||
        route.market.country !== item.market?.country || route.market.currency !== item.market?.currency ||
        route.market.method !== item.market?.method || route.amountDecimals !== item.amount.decimals) return false;
    try { return BigInt(item.amount.units) >= BigInt(route.minUnits) && BigInt(item.amount.units) <= BigInt(route.maxUnits); }
    catch { return false; }
  }
  const resumeAvailable = resume !== null && (resume.direction === "buy" ? routes : cashOutRoutes).some((route) => routeMatches(resume, route));
  const unresolved = items.some((item) => (item.launchRequested || item.providerStarted) &&
    (["created", "awaiting_user", "processing", "ready_for_pickup", "refund_pending", "refund_failed", "unknown"].includes(item.providerState) ||
      ["submitting", "unknown"].includes(item.chainState) || (item.providerState === "completed" && item.chainState !== "confirmed")));
  function closeDetail() {
    const next = new URLSearchParams(searchParams);
    next.delete("ramp");
    setSearchParams(next, { replace: true });
  }
  function manageDetail() {
    if (!detail) return;
    const selected = detail;
    closeDetail();
    setResume(selected);
  }
  return <section aria-label="Funding and cash-out" className="space-y-3 border-t border-white/10 pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-medium text-white">Funding and cash-out</h3>
        {routesLoading ? (
          <p role="status" className="mt-1 text-sm text-slate-400">Checking available options…</p>
        ) : routesError ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span>Could not check provider availability.</span>
            <Button type="button" variant="outline" onClick={() => setRoutesRetry((value) => value + 1)}>Try again</Button>
          </div>
        ) : routes.length === 0 && cashOutRoutes.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">Add funds and cash out aren't available yet. Your wallet balance is unchanged.</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!routes.length || unresolved || error || loading} onClick={() => setFunding(true)}>Add funds</Button><Button type="button" variant="outline" disabled={!cashOutRoutes.length || !sign || !/[1-9]/.test(spendableUsdc) || unresolved || error || loading} onClick={() => setCashOut(true)}>Cash out</Button></div>
    </div>
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-slate-300">Could not load transaction history. <Button type="button" variant="outline" onClick={() => setRetry((value) => value + 1)}>Try again</Button></div>}
    {unresolved && <p className="text-sm text-slate-400">Check your pending transaction before starting another.</p>}
    {showTransactions && items.length > 0 && <div className="space-y-2">
      <h4 className="text-sm font-medium text-white">Transactions</h4>
      <ul className="divide-y divide-white/10">
        {items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <div>
            <p className="font-medium text-white">{item.direction === "buy" ? "Add funds" : "Cash-out"} · {money(item.amount)}</p>
            <p className="mt-1 text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-slate-300">{providerLabel(item)}{showsChainState(item) && <> · {chainLabel(item)}</>}</p>
            <Button type="button" variant="outline" aria-label={`View ${item.direction === "buy" ? "funding" : "cash-out"} ${money(item.amount)}`} onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set("ramp", item.id);
              setSearchParams(next);
            }}>View</Button>
            {item.providerState === "created" && !item.launchRequested && !item.providerStarted && <Button type="button" variant="outline" disabled={unresolved || loading || error} onClick={() => setResume(item)}>Manage</Button>}
            {item.direction === "sell" && item.providerStarted && ["awaiting_user", "processing"].includes(item.providerState) && item.chainState === "unobserved" && sign && cashOutRoutes.some((route) => routeMatches(item, route)) && <Button type="button" variant="outline" disabled={loading || error} onClick={() => setQuoteId(item.id)}>Get quote</Button>}
            {item.direction === "sell" && item.chainState === "prepared" && sign && <Button type="button" variant="outline" onClick={() => setReviewId(item.id)}>Review cash-out</Button>}
          </div>
        </li>)}
      </ul>
    </div>}
    {detailId && <Dialog title={detail?.direction === "sell" ? "Cash-out details" : detail ? "Funding details" : "Transaction details"} onClose={closeDetail}>
      {detailLoading && !detail && <p role="status" className="text-sm text-muted-foreground">Loading transaction…</p>}
      {detailError && <div role="alert" className="space-y-3 text-sm"><p>{detail ? "Could not refresh. Showing the last saved status." : "Could not load this transaction."}</p><Button type="button" variant="outline" onClick={() => setDetailRetry((value) => value + 1)}>Try again</Button></div>}
      {detail && <div className="space-y-4 text-sm">
        <p className="font-medium text-white">{money(detail.amount)} · {detail.market.country} · {methodLabel[detail.market.method] ?? detail.market.method}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">Provider</dt><dd>{rampProviderName(detail.provider)}</dd>
          <dt className="text-muted-foreground">Provider status</dt><dd>{providerLabel(detail)}</dd>
          <dt className="text-muted-foreground">Stellar status</dt><dd>{chainLabel(detail)}</dd>
          <dt className="text-muted-foreground">Started</dt><dd>{new Date(detail.createdAt).toLocaleString()}</dd>
          {detail.updatedAt && <><dt className="text-muted-foreground">Updated</dt><dd>{new Date(detail.updatedAt).toLocaleString()}</dd></>}
        </dl>
        {detailLoading && <p role="status" className="text-muted-foreground">Refreshing status…</p>}
        {detail.providerState === "completed" && detail.chainState !== "confirmed" && <p role="status" className="text-muted-foreground">Provider completion is recorded; Stellar delivery is still being checked.</p>}
        {detail.providerState === "refund_failed" && <p role="alert" className="text-destructive">The provider could not return the funds. Contact support; no refund is confirmed.</p>}
        {detail.direction === "sell" && detail.chainState === "confirmed" && detail.providerState !== "completed" && <p role="status" className="text-muted-foreground">The Stellar transfer is confirmed; provider payout is still being checked.</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" disabled={detailLoading} onClick={() => setDetailRetry((value) => value + 1)}>{detailLoading ? "Refreshing…" : "Refresh status"}</Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {detail.providerState === "created" && !detail.launchRequested && !detail.providerStarted && <Button type="button" onClick={manageDetail}>Manage transaction</Button>}
            <Button type="button" variant="outline" onClick={closeDetail}>Close</Button>
          </div>
        </div>
      </div>}
    {!detail && <div className="flex justify-end"><Button type="button" variant="outline" onClick={closeDetail}>Close</Button></div>}
    </Dialog>}
    {quoteId && <CashOutQuoteDialog token={token} orderId={quoteId} onClose={() => setQuoteId(null)} onChanged={() => setRetry((value) => value + 1)} onPrepared={() => { setReviewId(quoteId); setQuoteId(null); }} />}
    {reviewId && sign && <CashOutReview token={token} orderId={reviewId} sign={sign} onClose={() => setReviewId(null)} onChanged={() => setRetry((value) => value + 1)} />}
    {cashOut && cashOutRoutes.length > 0 && <CashOutStartDialog token={token} routes={cashOutRoutes} available={spendableUsdc} onClose={() => setCashOut(false)} onChanged={() => setRetry((value) => value + 1)} />}
    {funding && routes.length > 0 && <AddFundsDialog token={token} routes={routes} onClose={() => setFunding(false)} onChanged={() => setRetry((value) => value + 1)} />}
    {resume && <ResumeFundingDialog token={token} orderId={resume.id} provider={resume.provider} direction={resume.direction} available={resumeAvailable} onClose={() => setResume(null)} onChanged={() => setRetry((value) => value + 1)} />}
  </section>;
}
