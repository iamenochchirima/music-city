import { useEffect, useState } from "react";
import type { SupportPayment } from "@music-city/shared";
import { useAdminAuth } from "@/features/auth/providers/admin-auth-provider";
import { httpClient } from "@/lib/api/http-client";
import { Button } from "@/components/ui/button";
export function AdminSupportPage() {
  const { session } = useAdminAuth();
  const [items, setItems] = useState<SupportPayment[]>([]),
    [error, setError] = useState("");
  const [events, setEvents] = useState<
    { id: string; action: string; created_at: string }[]
  >([]);
  useEffect(() => {
    if (!session?.token) return;
    let alive = true;
    const load = () =>
      httpClient
        .get<{ items: SupportPayment[] }>("/support", session.token)
        .then((r) => {
          if (alive) {
            setItems(r.items);
            setError("");
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [session?.token]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Fan support</h1>
      {error && <p role="alert">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {["From", "To", "Amount", "Status", "Receipt"].map((h) => (
                <th key={h} className="p-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-white/10">
                <td className="p-4">
                  <p>{p.senderName}</p>
                  <p className="font-mono text-xs text-slate-400">
                    {p.sender.slice(0, 8)}…{p.sender.slice(-4)}
                  </p>
                </td>
                <td className="p-4">
                  <p>{p.recipient.name}</p>
                  <p className="text-slate-400">{p.recipient.target.kind}</p>
                </td>
                <td className="p-4">{p.amount} USDC</td>
                <td className="p-4">
                  {p.status}
                  <p className="text-xs text-slate-400">{p.error}</p>
                </td>
                <td className="space-y-2 p-4">
                  {(p.status === "confirmed" || p.status === "failed") && (
                    <a
                      className="block underline"
                      href={`https://stellar.expert/explorer/${p.networkPassphrase.includes("Test SDF") ? "testnet" : "public"}/tx/${p.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View receipt
                    </a>
                  )}
                  <Button
                    variant="outline"
                    onClick={() =>
                      void httpClient
                        .get<{ items: typeof events }>(
                          `/support/${p.id}/events`,
                          session?.token,
                        )
                        .then((r) => setEvents(r.items))
                        .catch((e) => setError(e.message))
                    }
                  >
                    History
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <p className="p-4 text-slate-400">No support payments yet.</p>
        )}
      </div>
      {events.length > 0 && (
        <section className="space-y-3 rounded-xl border border-white/10 p-5">
          <h2 className="font-semibold">Payment history</h2>
          <ol>
            {events.map((e) => (
              <li
                key={e.id}
                className="flex justify-between gap-4 py-2 text-sm"
              >
                <span>{e.action.replaceAll("_", " ")}</span>
                <span>{new Date(e.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
