import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import type {
  AdminTreasuryOverview,
  RoyaltyLedgerEntry,
  RoyaltyPayoutRecord,
} from "@music-city/shared";
import { useAdminAuth } from "@/features/auth/providers/admin-auth-provider";
import { httpClient } from "@/lib/api/http-client";
import { Button } from "@/components/ui/button";
const panel = "rounded-xl border border-white/10 p-5";
export function RoyaltyLedgerPage() {
  const { session } = useAdminAuth();
  const [entries, setEntries] = useState<RoyaltyLedgerEntry[]>([]),
    [payouts, setPayouts] = useState<RoyaltyPayoutRecord[]>([]),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [l, p] = await Promise.all([
      httpClient.get<{ items: RoyaltyLedgerEntry[] }>(
        "/royalties/ledger",
        session?.token,
      ),
      httpClient.get<{ items: RoyaltyPayoutRecord[] }>(
        "/royalties/payouts",
        session?.token,
      ),
    ]);
    setEntries(l.items);
    setPayouts(p.items);
  }, [session?.token]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function approve(entry: RoyaltyLedgerEntry) {
    setBusy(true);
    setError(null);
    try {
      const source = entries.filter(
        (e) =>
          e.trackId === entry.trackId &&
          e.sourceType === entry.sourceType &&
          e.sourceId === entry.sourceId &&
          e.status === "pending",
      );
      await httpClient.post(
        "/royalties/ledger/approve",
        { entryIds: source.map((e) => e.id) },
        session?.token,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve source");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="space-y-6 p-4 text-slate-100 md:p-8">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Royalty ledger</h1>
          <p className="mt-2 text-sm text-slate-400">
            Review recorded earnings before settlement.
          </p>
        </div>
        <NavLink
          className="text-emerald-300 underline"
          to="/console/settlements"
        >
          Open settlements
        </NavLink>
      </header>
      {error && (
        <p role="alert" className="text-red-200">
          {error}
        </p>
      )}
      <section className="space-y-3">
        {entries.length ? (
          entries.map((e) => (
            <article
              key={e.id}
              className={`${panel} flex flex-wrap items-center justify-between gap-3`}
            >
              <div>
                <p>
                  {e.netAmount} {e.assetCode} · {e.status}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-slate-400">
                  {e.recipientWalletAddress}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {e.sourceType.replaceAll("_", " ")} · {e.trackId}
                </p>
              </div>
              {e.status === "pending" && (
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => void approve(e)}
                >
                  Approve source earnings
                </Button>
              )}
            </article>
          ))
        ) : (
          <p className="text-sm text-slate-400">No recorded earnings yet.</p>
        )}
      </section>
      <section className={panel}>
        <h2 className="font-semibold">Historical payouts</h2>
        <p className="mt-2 text-sm text-slate-400">
          Retained records from before contract settlement.
        </p>
        <ul className="mt-4 space-y-3 text-sm">
          {payouts.map((p) => (
            <li key={p.id} className="break-all">
              {p.amount} {p.assetCode} · {p.status}
              <p className="text-xs text-slate-400">
                {p.recipientWalletAddress}
              </p>
              {p.txHash && <p className="font-mono text-xs">{p.txHash}</p>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
export function TreasuryAccountPage() {
  const { session } = useAdminAuth();
  const [detail, setDetail] = useState<AdminTreasuryOverview | null>(null),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void httpClient
      .get<AdminTreasuryOverview>("/treasury", session?.token)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [session?.token]);
  return (
    <main className="space-y-6 p-4 text-slate-100 md:p-8">
      <h1 className="text-2xl font-semibold">Payment receiving treasury</h1>
      {error && <p role="alert">{error}</p>}
      {detail && (
        <section className={`${panel} space-y-4`}>
          <p className="break-all font-mono text-sm">
            {detail.settings.walletAddress || "No receiving wallet configured"}
          </p>
          <ul className="space-y-3">
            {detail.account?.balances.map((b) => (
              <li key={b.assetKey}>
                {b.availableAmount} {b.assetCode}
              </li>
            ))}
          </ul>
          <NavLink
            className="text-sm text-emerald-300 underline"
            to="/console/settlements"
          >
            Manage threshold-authorized settlements
          </NavLink>
        </section>
      )}
    </main>
  );
}
