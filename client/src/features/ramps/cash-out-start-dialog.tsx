import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { httpClient } from "@/lib/api/http-client";
import { isDefinitivelyRejectedRequest } from "./request-outcome";
import { rampProviderName, validateRampProviderUrl } from "./provider-handoff";
import type { RampProvider } from "@music-city/shared";

export type CashOutRoute = {
  provider: RampProvider; direction: "sell"; assetCode: "USDC"; assetIssuer: string;
  market: { country: string; currency: string; method: string };
  amountDecimals: number; minUnits: string; maxUnits: string;
};
const labels: Record<string, string> = { bank: "Bank transfer", card: "Card", cash_pickup: "Cash pickup", mobile_money: "Mobile money" };
function country(code: string) {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch { return code; }
}
function units(value: string): bigint | null {
  if (value.length > 28 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,7})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole + fraction.padEnd(7, "0"));
}
function displayUnits(value: string) {
  const padded = value.padStart(8, "0");
  const fraction = padded.slice(-7).replace(/0+$/, "");
  return `${padded.slice(0, -7)}${fraction ? `.${fraction}` : ""}`;
}
function validAmount(value: string, route: CashOutRoute, available: string) {
  try {
    const requested = units(value), balance = units(available);
    return requested !== null && balance !== null && requested > 0n && route.amountDecimals === 7 &&
      requested <= balance && requested >= BigInt(route.minUnits) && requested <= BigInt(route.maxUnits);
  } catch { return false; }
}

export function CashOutStartDialog({ token, routes, available, onClose, onChanged }: {
  token: string; routes: CashOutRoute[]; available: string; onClose: () => void; onChanged: () => void;
}) {
  const [index, setIndex] = useState(0), [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null), [opened, setOpened] = useState(false), [uncertain, setUncertain] = useState(false);
  const [createUncertain, setCreateUncertain] = useState(false);
  const requestId = useRef(crypto.randomUUID()), lock = useRef(false), balanceId = useId();
  const route = routes[index];
  async function start() {
    if (!route || !validAmount(amount, route, available) || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    let orderId: string;
    try {
      const result = await httpClient.post<{ order: { id: string } }>("/ramps", { requestId: requestId.current, provider: route.provider, direction: "sell", assetCode: "USDC", market: route.market, amount }, token);
      orderId = result.order.id;
      setCreateUncertain(false);
      onChanged();
    } catch (cause) {
      if (!isDefinitivelyRejectedRequest(cause)) {
        setCreateUncertain(true);
        setError("We couldn't confirm whether this cash-out started. Retry safely with the same details or check your transaction history.");
        onChanged();
      } else {
        setCreateUncertain(false);
        requestId.current = crypto.randomUUID();
        setError("Could not start this cash-out. Check the details and try again.");
      }
      setBusy(false); lock.current = false; return;
    }
    try {
      const result = await httpClient.post<{ url: string }>(`/ramps/${encodeURIComponent(orderId)}/launch`, {}, token);
      setUrl(validateRampProviderUrl(route.provider, "sell", result.url));
    } catch { setUncertain(true); setError("Check this cash-out in transactions before trying again."); }
    finally { setBusy(false); lock.current = false; onChanged(); }
  }
  return <Dialog title="Cash out" onClose={onClose} busy={busy}>
    {url ? <div className="space-y-4"><p>{opened ? "Check your transactions for updates." : `Continue to ${rampProviderName(route.provider)} to set up your cash-out.`}</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Close</Button>{!opened && <Button asChild><a href={url} target="_blank" rel="noopener noreferrer" onClick={(event) => { if (lock.current) { event.preventDefault(); return; } lock.current = true; setOpened(true); onChanged(); }}>Continue to provider</a></Button>}</div></div> : <div className="space-y-5">
      <fieldset disabled={busy || uncertain || createUncertain}><legend className="mb-2 text-sm font-medium">Choose a payout option</legend><div className="grid gap-2">{routes.map((option, i) => <label key={`${option.provider}-${option.market.country}-${option.market.currency}-${option.market.method}`} className={`cursor-pointer rounded-md border p-3 text-left text-sm focus-within:ring-2 focus-within:ring-ring ${index === i ? "border-primary bg-primary/10" : "border-border"}`}><input className="sr-only" type="radio" name="cashout-option" checked={index === i} onChange={() => { setIndex(i); setError(null); requestId.current = crypto.randomUUID(); }} /><span className="font-medium">{country(option.market.country)} · {option.market.currency} · {labels[option.market.method] ?? option.market.method}</span><span className="mt-1 block text-muted-foreground">{rampProviderName(option.provider)}</span></label>)}</div></fieldset>
      <label className="block space-y-2 text-sm"><span>Amount in USDC</span><Input aria-label="Amount in USDC" aria-describedby={balanceId} inputMode="decimal" value={amount} disabled={busy || uncertain || createUncertain} onChange={(event) => { setAmount(event.target.value); setError(null); requestId.current = crypto.randomUUID(); }} /><span id={balanceId} className="block text-muted-foreground">{available} USDC available{route ? ` · ${displayUnits(route.minUnits)}–${displayUnits(route.maxUnits)} USDC per cash-out` : ""}</span></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button><Button type="button" disabled={!route || busy || uncertain || !validAmount(amount, route, available)} onClick={() => void start()}>{busy ? createUncertain ? "Checking…" : "Preparing…" : createUncertain ? "Retry safely" : "Continue"}</Button></div>
    </div>}
  </Dialog>;
}
