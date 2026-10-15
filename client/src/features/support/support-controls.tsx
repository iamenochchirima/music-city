import { useEffect, useState } from "react";
import type { SupportRecipient } from "@music-city/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supportApi } from "./support-api";
import { SupportDialog } from "./support-dialog";
export function SupportButton({ recipient }: { recipient: SupportRecipient }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  if (session?.walletAddress === recipient.walletAddress) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Support
      </Button>
      {open && (
        <SupportDialog recipient={recipient} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
export function ArtistSupport({ artistId }: { artistId: string }) {
  const [recipient, setRecipient] = useState<SupportRecipient | null>(null);
  useEffect(() => {
    let alive = true;
    setRecipient(null);
    void supportApi
      .artist(artistId)
      .then((r) => {
        if (alive) setRecipient(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [artistId]);
  return recipient ? <SupportButton recipient={recipient} /> : null;
}
export function TrackSupport({ trackId }: { trackId: string }) {
  const [recipients, setRecipients] = useState<SupportRecipient[]>([]);
  useEffect(() => {
    let alive = true;
    setRecipients([]);
    void supportApi
      .recipients(trackId)
      .then((items) => {
        if (alive) setRecipients(items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [trackId]);
  if (!recipients.length) return null;
  return (
    <section className="space-y-4 rounded-xl border border-border p-5">
      <h3 className="text-lg font-semibold">Support</h3>
      <ul className="divide-y divide-border">
        {recipients.map((r) => (
          <li
            key={r.walletAddress}
            className="flex items-center justify-between gap-4 py-3"
          >
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-sm text-muted-foreground">{r.role}</p>
            </div>
            <SupportButton recipient={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}
