import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { httpClient } from "@/lib/api/http-client";

export function CashOutQuoteDialog({ token, orderId, onClose, onChanged, onPrepared }: {
  token: string; orderId: string; onClose: () => void; onChanged: () => void; onPrepared: () => void;
}) {
  const [busy, setBusy] = useState(true), [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const locked = useRef(false), started = useRef(false);
  const base = `/ramps/${encodeURIComponent(orderId)}/cashout`;
  async function getQuote() {
    if (locked.current || uncertain) return;
    locked.current = true; setBusy(true); setError(null);
    let quote: { quote: { id: string }; confirmationHash: string };
    try {
      quote = await httpClient.post<typeof quote>(`${base}/quotes`, {}, token);
    } catch {
      setError("Quote not available yet. Try again later."); setBusy(false); locked.current = false; return;
    }
    try {
      await httpClient.post(`${base}/transfer`, { quoteId: quote.quote.id, confirmationHash: quote.confirmationHash }, token);
      onChanged(); onPrepared();
    } catch (error) {
      const known = error instanceof Error && (error as Error & { status?: number }).status === 409 && [
        "Your wallet has insufficient spendable USDC.", "Your wallet needs an active USDC trustline.",
        "Add XLM to cover the network fee.", "Network fee changed. Cancel and start again.",
      ].includes(error.message);
      if (known) setError(error.message);
      else { setUncertain(true); setError("Check this cash-out in transactions before trying again."); }
      onChanged();
    } finally { setBusy(false); locked.current = false; }
  }
  useEffect(() => {
    if (!started.current) { started.current = true; void getQuote(); }
  }, []);
  return <Dialog title="Cash out" onClose={onClose} busy={busy}>
    <div className="space-y-4">
      {busy && <p role="status">Getting quote…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button>
        {!busy && !uncertain && <Button type="button" onClick={() => void getQuote()}>Try again</Button>}
      </div>
    </div>
  </Dialog>;
}
