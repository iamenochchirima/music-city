"use client";

import { useEffect, useState } from "react";
import { Download, LoaderCircle, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import type { TrackSummary } from "@music-city/shared";

import { Button } from "@/components/ui/button";
import { useStellarCheckout } from "@/features/payments/hooks/use-stellar-checkout";
import { paymentsApi } from "@/features/payments/lib/payments-api";
import { useAuth } from "@/hooks/use-auth";
import { clientEnv } from "@/lib/config/env";

const priceLabel = (track: TrackSummary) =>
  track.purchasePrice
    ? `${track.purchasePrice} ${track.purchaseAssetCode ?? "USDC"}`
    : null;

/**
 * Buy or download action shown inline on the normal music listings. Ownership
 * is decided by the page (one payments request), so this only renders state.
 */
export const TrackSaleButton = ({
  track,
  owned = false,
  onPurchased,
}: {
  track: TrackSummary;
  owned?: boolean;
  onPurchased?: () => void;
}) => {
  const { session } = useAuth();
  const runCheckout = useStellarCheckout();
  const [purchased, setPurchased] = useState(owned);
  const [busy, setBusy] = useState<"buy" | "download" | null>(null);

  useEffect(() => {
    if (owned) setPurchased(true);
  }, [owned]);

  const download = async () => {
    if (!session?.token) {
      toast.error("Sign in with your Stellar wallet first.");
      return;
    }

    try {
      setBusy("download");
      const { blob, filename } = await paymentsApi.downloadTrack(
        session.token,
        track.id,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        filename ?? `${track.artistName ?? "Music City"} - ${track.title}`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to download this song",
      );
    } finally {
      setBusy(null);
    }
  };

  const buy = async () => {
    if (!session?.token) {
      toast.error("Sign in with your Stellar wallet first.");
      return;
    }

    try {
      setBusy("buy");
      const intent = await paymentsApi.createTrackPurchaseIntent(
        session.token,
        track.id,
      );
      const txHash = await runCheckout(intent);
      await paymentsApi.confirm(session.token, { intentId: intent.id, txHash });
      setPurchased(true);
      toast.success("Track unlocked.");
      onPurchased?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to complete purchase",
      );
    } finally {
      setBusy(null);
    }
  };

  if (purchased) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        disabled={busy === "download"}
        onClick={(event) => {
          event.stopPropagation();
          void download();
        }}
      >
        {busy === "download" ? (
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Download
      </Button>
    );
  }

  if (!clientEnv.trackPurchasesEnabled || !track.purchaseEnabled) {
    return null;
  }

  return (
    <Button
      size="sm"
      className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
      disabled={busy === "buy"}
      onClick={(event) => {
        event.stopPropagation();
        void buy();
      }}
    >
      {busy === "buy" ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <ShoppingBag className="mr-2 h-4 w-4" />
      )}
      {priceLabel(track) ? `Buy ${priceLabel(track)}` : "Buy track"}
    </Button>
  );
};
