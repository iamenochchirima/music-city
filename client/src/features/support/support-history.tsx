import { useEffect, useState } from "react";
import type { SupportPayment } from "@music-city/shared";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { supportApi, supportAmount, supportReceiptUrl } from "./support-api";
import { SupportDialog } from "./support-dialog";
export function SupportHistory() {
  const { session } = useAuth();
  const [items, setItems] = useState<SupportPayment[]>([]),
    [review, setReview] = useState<SupportPayment | null>(null),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setItems([]);
    setLoading(true);
    setError("");
    setReview(null);
    if (!session?.token) {
      setLoading(false);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const payments = await supportApi.list(session.token!);
        if (!alive) return;
        setItems(payments);
        setError("");
        const active = payments.filter((p) =>
          ["prepared", "submitting"].includes(p.status),
        );
        for (const p of active) {
          try {
            await supportApi.get(session.token!, p.id);
          } catch {}
        }
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error ? e.message : "Could not load support history",
          );
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [session?.token]);
  if (!session) return <p>Sign in to see your support history.</p>;
  return (
    <div className="mx-auto max-w-[800px] space-y-6">
      <h1 className="text-2xl font-semibold">Support history</h1>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading support...</p>
      ) : !items.length ? (
        <p className="text-muted-foreground">
          Your sent and received support will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((p) => {
            const sent = p.sender === session.walletAddress;
            const status =
              p.status === "prepared"
                ? "Awaiting your approval"
                : p.status === "submitting"
                  ? "Confirming"
                  : p.status === "confirmed"
                    ? sent
                      ? "Sent"
                      : "Received"
                    : p.status === "cancelled"
                      ? "Cancelled"
                      : p.status === "expired"
                        ? "Expired"
                        : "Failed";
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-4 py-5"
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    {sent ? `To ${p.recipient.name}` : `From ${p.senderName}`}
                  </p>
                  <p>{supportAmount(p.amount)} USDC</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(p.createdAt).toLocaleString()} ·{" "}
                    {p.recipient.target.kind === "artist"
                      ? "Artist support"
                      : "Contributor support"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-2 text-sm">
                    {p.status === "submitting" && (
                      <LoaderCircle className="size-4 animate-spin" />
                    )}
                    {status}
                  </span>
                  {sent && p.status === "prepared" && (
                    <Button variant="outline" onClick={() => setReview(p)}>
                      Review
                    </Button>
                  )}
                  {p.status === "confirmed" && (
                    <a
                      className="text-sm underline"
                      href={supportReceiptUrl(p)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View receipt
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {review && (
        <SupportDialog
          recipient={review.recipient}
          initialPayment={review}
          onClose={() => setReview(null)}
        />
      )}
    </div>
  );
}
