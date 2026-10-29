import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { httpClient } from "@/lib/api/http-client";
import { isDefinitivelyRejectedRequest } from "./request-outcome";

export type FundingRoute = {
  provider: "moonpay" | "moneygram"; direction: "buy"; assetCode: "USDC" | "XLM";
  market: { country: string; currency: string; method: string };
  amountDecimals: number; minUnits: string; maxUnits: string;
};
const methodLabels: Record<string, string> = { card: "Card", bank: "Bank transfer", apple_pay: "Apple Pay", google_pay: "Google Pay", cash_deposit: "Cash deposit", cash_pickup: "Cash pickup", mobile_money: "Mobile money" };
function country(code: string) {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch { return code; }
}
function validAmount(amount: string, route: FundingRoute) {
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(amount) || amount.length > 40) return false;
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > route.amountDecimals) return false;
  const value = BigInt(`${whole}${fraction.padEnd(route.amountDecimals, "0")}`);
  return value > 0n && value >= BigInt(route.minUnits) && value <= BigInt(route.maxUnits);
}
function formatLimit(units: string, decimals: number) {
  const digits = units.padStart(decimals + 1, "0");
  return decimals ? `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}` : digits;
}

export function AddFundsDialog({ token, routes, onClose, onChanged }: { token: string; routes: FundingRoute[]; onClose: () => void; onChanged: () => void }) {
  const [index, setIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [createUncertain, setCreateUncertain] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const rangeId = useId();
  const lock = useRef(false);
  const route = routes[index];
  async function continueToProvider() {
    if (!route || !validAmount(amount, route) || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    let orderId: string;
    try {
      const result = await httpClient.post<{ order: { id: string } }>("/ramps", { requestId: requestId.current, provider: route.provider, direction: "buy", assetCode: route.assetCode, market: route.market, amount }, token);
      orderId = result.order.id;
      setCreateUncertain(false);
      onChanged();
    } catch (cause) {
      if (!isDefinitivelyRejectedRequest(cause)) {
        setCreateUncertain(true);
        setError("We couldn't confirm whether this transaction started. Retry safely with the same details or check your transaction history.");
        onChanged();
      } else {
        setCreateUncertain(false);
        requestId.current = crypto.randomUUID();
        setError("Could not start this transaction. Check the details and try again.");
      }
      setBusy(false); lock.current = false; return;
    }
    try {
      const result = await httpClient.post<{ url: string }>(`/ramps/${encodeURIComponent(orderId)}/launch`, {}, token);
      const destination = new URL(result.url);
      if (route.provider !== "moonpay" || destination.origin !== "https://buy-sandbox.moonpay.com" || destination.username || destination.password)
        throw new Error("Invalid provider destination");
      setUrl(destination.href);
    } catch {
      setUncertain(true);
      setError("Check this transaction in your history before trying again.");
    } finally { setBusy(false); lock.current = false; onChanged(); }
  }
  return <Dialog title="Add funds" onClose={onClose} busy={busy}>
    {url ? <div className="space-y-4"><p>{opened ? "Check your transaction history for updates." : `Continue to ${route.provider === "moonpay" ? "MoonPay" : "MoneyGram"} to complete your purchase.`}</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Close</Button>{!opened && <Button asChild><a href={url} target="_blank" rel="noopener noreferrer" onClick={(event) => { if (lock.current) { event.preventDefault(); return; } lock.current = true; setOpened(true); onChanged(); }}>Continue to provider</a></Button>}</div></div> : <div className="space-y-5">
      <fieldset disabled={busy || uncertain || createUncertain}><legend className="mb-2 text-sm font-medium">Choose a payment option</legend><div className="grid gap-2">{routes.map((option, i) => <label key={`${option.provider}-${option.market.country}-${option.market.currency}-${option.market.method}-${option.assetCode}`} className={`cursor-pointer rounded-md border p-3 text-left text-sm focus-within:ring-2 focus-within:ring-ring ${index === i ? "border-primary bg-primary/10" : "border-border"}`}><input className="sr-only" type="radio" name="funding-option" checked={index === i} onChange={() => { setIndex(i); setError(null); requestId.current = crypto.randomUUID(); }} /><span className="font-medium">{country(option.market.country)} · {option.market.currency} · {methodLabels[option.market.method] ?? option.market.method}</span><span className="mt-1 block text-muted-foreground">{option.provider === "moonpay" ? "MoonPay" : "MoneyGram"} · {option.assetCode}</span></label>)}</div></fieldset>
      {route && <label className="block space-y-2 text-sm"><span>Amount in {route.market.currency}</span><Input aria-label={`Amount in ${route.market.currency}`} aria-describedby={rangeId} inputMode="decimal" value={amount} disabled={busy || uncertain || createUncertain} onChange={(event) => { setAmount(event.target.value); setError(null); requestId.current = crypto.randomUUID(); }} /><span id={rangeId} className="block text-muted-foreground">{formatLimit(route.minUnits, route.amountDecimals)}–{formatLimit(route.maxUnits, route.amountDecimals)} {route.market.currency}</span></label>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button><Button type="button" disabled={!route || busy || uncertain || !validAmount(amount, route)} onClick={() => void continueToProvider()}>{busy ? createUncertain ? "Checking…" : "Preparing…" : createUncertain ? "Retry safely" : "Continue"}</Button></div>
    </div>}
  </Dialog>;
}
