import { useEffect, useRef, useState } from "react";
import type { CashOutQuote } from "@music-city/shared";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { httpClient } from "@/lib/api/http-client";

type Transfer = { id: string; quoteId: string; transactionHash: string; transaction: string | null; networkFeeStroops: string | null; state: string; expiresAt: string; unavailableReason?: string };
type QuoteResult = { quote: CashOutQuote; expiresAt: string };
function amount(value: { units: string; decimals: number; currency: string }) {
  const digits = value.units.padStart(value.decimals + 1, "0");
  const fraction = value.decimals ? digits.slice(-value.decimals) : "";
  const displayFraction = ["USDC", "XLM"].includes(value.currency) ? fraction.replace(/0+$/, "") : fraction;
  const whole = value.decimals ? digits.slice(0, -value.decimals) : digits;
  return `${whole}${displayFraction ? `.${displayFraction}` : ""} ${value.currency}`;
}
function feeTotal(quote: CashOutQuote, networkFee: string | null) {
  if (!networkFee) return null;
  const totals = new Map<string, { currency: string; units: bigint; decimals: number }>();
  const fees = [...quote.fees, { kind: "network" as const, amount: { currency: "XLM", units: networkFee, decimals: 7 }, includedInDebit: false }];
  for (const fee of fees) {
    if (!/^\d+$/.test(fee.amount.units)) return null;
    const key = `${fee.amount.currency}:${fee.amount.decimals}`;
    const current = totals.get(key);
    totals.set(key, {
      currency: fee.amount.currency,
      units: (current?.units ?? 0n) + BigInt(fee.amount.units),
      decimals: fee.amount.decimals,
    });
  }
  return [...totals.values()].map((value) => amount({ ...value, units: value.units.toString() })).join(" + ");
}

export function CashOutReview({ token, orderId, sign, onClose, onChanged }: {
  token: string; orderId: string; sign: (transaction: string) => Promise<string>; onClose: () => void; onChanged: () => void;
}) {
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const locked = useRef(false);
  const base = `/ramps/${encodeURIComponent(orderId)}/cashout`;
  async function refresh(quiet = false) {
    if (!quiet) setReady(false);
    const result = await httpClient.get<{ transfer: Transfer | null }>(`${base}/transfer`, token);
    setTransfer(result.transfer);
    if (result.transfer?.state === "prepared") {
      const value = await httpClient.get<QuoteResult>(`${base}/quotes/${encodeURIComponent(result.transfer.quoteId)}`, token);
      setQuote(value);
    } else setQuote(null);
    setReady(true);
  }
  useEffect(() => { void refresh().catch(() => setError("Could not load this cash-out. Try again.")); }, [token, orderId]);
  useEffect(() => {
    if (!ready || busy || !transfer || !["submitting", "unknown"].includes(transfer.state)) return;
    const timer = window.setInterval(() => { void refresh(true).then(onChanged).catch(() => {}); }, 5000);
    return () => window.clearInterval(timer);
  }, [ready, busy, transfer?.state, transfer?.id, token, orderId]);
  const networkFee = transfer?.networkFeeStroops && /^\d+$/.test(transfer.networkFeeStroops)
    ? amount({ units: transfer.networkFeeStroops, decimals: 7, currency: "XLM" }) : null;
  const total = quote ? feeTotal(quote.quote, transfer?.networkFeeStroops && /^\d+$/.test(transfer.networkFeeStroops) ? transfer.networkFeeStroops : null) : null;
  async function authorize() {
    if (locked.current || !ready || !transfer?.transaction || !quote || !networkFee) return;
    if (Date.now() >= Math.min(Date.parse(transfer.expiresAt), Date.parse(quote.expiresAt))) { setError("This quote has expired. Start again for a new quote."); return; }
    locked.current = true; setBusy(true); setError(null);
    try {
      const latest = (await httpClient.get<{ transfer: Transfer | null }>(`${base}/transfer`, token)).transfer;
      if (!latest || latest.state !== "prepared" || latest.id !== transfer.id || latest.quoteId !== transfer.quoteId ||
          latest.transactionHash !== transfer.transactionHash || latest.transaction !== transfer.transaction ||
          latest.networkFeeStroops !== transfer.networkFeeStroops || latest.expiresAt !== transfer.expiresAt) {
        setReady(false);
        await refresh(); onChanged();
        setError("Cash-out changed. Check its current status.");
        return;
      }
      const expires = Math.min(Date.parse(latest.expiresAt), Date.parse(quote.expiresAt));
      if (!Number.isFinite(expires) || Date.now() >= expires) {
        setError("This quote has expired. Start again for a new quote.");
        return;
      }
      setSigning(true);
      const signedXdr = await sign(latest.transaction!);
      setSigning(false);
      setReady(false);
      await httpClient.post(`${base}/transfer/${encodeURIComponent(transfer.id)}/authorize`, { signedXdr }, token);
      await refresh(); onChanged();
    } catch {
      setSigning(false);
      setReady(false);
      try { await refresh(); onChanged(); setError("Check the status before trying again."); }
      catch { setError("Could not check the transfer. Try again before taking another action."); }
    } finally { setBusy(false); locked.current = false; }
  }
  async function cancel() {
    if (locked.current || !ready || !transfer || transfer.state !== "prepared") return;
    locked.current = true; setBusy(true); setReady(false); setError(null);
    try {
      await httpClient.post(`${base}/transfer/${encodeURIComponent(transfer.id)}/cancel`, {}, token);
      await refresh(); onChanged();
    } catch {
      try { await refresh(); onChanged(); setError("Check the status before trying again."); }
      catch { setError("Could not check the transfer. Try again before taking another action."); }
    } finally { setBusy(false); locked.current = false; }
  }
  return <Dialog title="Cash-out" onClose={onClose} busy={busy} suspended={signing}>
    {!ready && !error && <p role="status">Loading…</p>}
    {error && <div role="alert" className="space-y-3"><p>{error}</p>{!ready && <Button type="button" variant="outline" onClick={() => { setError(null); void refresh().catch(() => setError("Could not load this cash-out. Try again.")); }}>Try again</Button>}</div>}
    {ready && transfer?.state === "prepared" && quote && <div className="space-y-5">
      <dl className="space-y-3 text-sm"><div className="flex justify-between gap-4"><dt>Send</dt><dd>{amount({ units: quote.quote.debitUnits, decimals: 7, currency: "USDC" })}</dd></div>
        <div className="flex justify-between gap-4"><dt>Receive</dt><dd>{amount(quote.quote.receive)}</dd></div>
        <div className="flex justify-between gap-4"><dt>To</dt><dd className="text-right">{quote.quote.destinationLabel}</dd></div>
        <div className="flex justify-between gap-4"><dt>Provider</dt><dd>{quote.quote.provider === "moonpay" ? "MoonPay" : "MoneyGram"}</dd></div>
        <div className="flex justify-between gap-4 font-medium"><dt>Total fees</dt><dd className="text-right">{total ?? "Unavailable"}</dd></div></dl>
      <details className="rounded-md border border-white/10 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">Fee breakdown</summary>
        <dl className="mt-3 space-y-2">
          {quote.quote.fees.map((fee, index) => <div key={index} className="flex justify-between gap-4"><dt>{fee.kind === "network" ? "Provider network fee" : fee.kind === "provider" ? "Provider fee" : "Other fee"}{fee.includedInDebit ? " (included)" : ""}</dt><dd>{amount(fee.amount)}</dd></div>)}
          <div className="flex justify-between gap-4"><dt>Stellar network fee</dt><dd>{networkFee ?? "Unavailable"}</dd></div>
        </dl>
      </details>
      <details className="rounded-md border border-white/10 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">Technical details</summary>
        <dl className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-4">
          <dt className="text-muted-foreground">Stellar network</dt><dd>{quote.quote.network === "stellar:testnet" ? "Stellar Testnet" : "Stellar Public Network"}</dd>
          <dt className="text-muted-foreground">Sending wallet</dt><dd className="break-all">{quote.quote.walletAddress}</dd>
          <dt className="text-muted-foreground">Provider reference</dt><dd className="break-all">{quote.quote.providerTransactionId}</dd>
          <dt className="text-muted-foreground">Prepared transaction hash</dt><dd className="break-all">{transfer.transactionHash}</dd>
        </dl>
      </details>
      <p className="text-sm text-muted-foreground">{transfer.transaction ? `Quote expires ${new Date(Math.min(Date.parse(transfer.expiresAt), Date.parse(quote.expiresAt))).toLocaleString()}.` : transfer.unavailableReason ?? "This cash-out is no longer available."}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Close</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void cancel()}>Cancel cash-out</Button><Button type="button" disabled={busy || !networkFee || !transfer.transaction} onClick={() => void authorize()}>Confirm cash-out</Button></div>
    </div>}
    {ready && transfer?.state !== "prepared" && <div className="space-y-4"><p role="status">{!transfer ? "No transfer to review." : transfer.state === "confirmed" ? "Transfer confirmed. Check your payout status in transactions." : transfer.state === "failed" ? "Transfer failed." : transfer.state === "expired" ? "Transfer expired." : transfer.state === "cancelled" ? "Cash-out cancelled." : "Checking your transfer."}</p><Button type="button" variant="outline" onClick={onClose}>Done</Button></div>}
  </Dialog>;
}
