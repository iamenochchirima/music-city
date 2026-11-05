import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { httpClient } from "@/lib/api/http-client";
import type { RampDirection, RampProvider } from "@music-city/shared";
import { rampProviderName, validateRampProviderUrl } from "./provider-handoff";

export function ResumeFundingDialog({ token, orderId, provider, direction = "buy", available, onClose, onChanged }: {
  token: string; orderId: string; provider: RampProvider; direction?: RampDirection; available: boolean; onClose: () => void; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const lock = useRef(false);
  async function prepare() {
    if (lock.current || uncertain || !available) return;
    lock.current = true; setBusy(true);
    try {
      const result = await httpClient.post<{ url: string }>(`/ramps/${encodeURIComponent(orderId)}/launch`, {}, token);
      setUrl(validateRampProviderUrl(provider, direction, result.url));
    } catch { setUncertain(true); }
    finally { lock.current = false; setBusy(false); onChanged(); }
  }
  async function cancel() {
    if (lock.current || uncertain) return;
    lock.current = true; setBusy(true);
    try { await httpClient.post(`/ramps/${encodeURIComponent(orderId)}/cancel`, {}, token); setCancelled(true); }
    catch { setUncertain(true); }
    finally { lock.current = false; setBusy(false); onChanged(); }
  }
  return <Dialog title={direction === "buy" ? "Add funds" : "Cash out"} onClose={onClose} busy={busy}>
    <div className="space-y-4">
      <p>{cancelled ? (direction === "buy" ? "Funding request cancelled." : "Cash-out request cancelled.") : uncertain ? "Check this transaction in your history before trying again." : opened ? "Check your transaction history for updates." : url ? `Continue to ${rampProviderName(provider)} to complete this request.` : available ? `Continue this transaction with ${rampProviderName(provider)}.` : "This payment option is unavailable."}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button>
        {!url && !uncertain && !cancelled && <Button type="button" variant="outline" disabled={busy} onClick={() => void cancel()}>{direction === "buy" ? "Cancel funding" : "Cancel cash-out"}</Button>}
        {!url && !uncertain && !cancelled && available && <Button type="button" disabled={busy} onClick={() => void prepare()}>{busy ? "Preparing…" : "Continue"}</Button>}
        {url && !opened && <Button asChild><a href={url} target="_blank" rel="noopener noreferrer" onClick={(event) => { if (lock.current) { event.preventDefault(); return; } lock.current = true; setOpened(true); onChanged(); }}>Continue to provider</a></Button>}
      </div>
    </div>
  </Dialog>;
}
