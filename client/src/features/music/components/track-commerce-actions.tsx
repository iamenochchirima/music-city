"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, LoaderCircle, Play, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import type { ArtistPublicProfile, TrackSummary } from "@music-city/shared";

import { Button } from "@/components/ui/button";
import { playbackApi } from "@/features/playback/lib/playback-api";
import { paymentsApi } from "@/features/payments/lib/payments-api";
import { useStellarCheckout } from "@/features/payments/hooks/use-stellar-checkout";
import { useGlobalPlayback } from "@/features/playback/providers/global-playback-provider";
import { useAuth } from "@/hooks/use-auth";

const formatAmountLabel = (amount?: string, assetCode?: string) => {
  if (!amount) {
    return null;
  }

  return `${amount} ${assetCode ?? "XLM"}`;
};

export const TrackCommerceActions = ({
  track,
  artistProfile,
  onUnlocked,
  hidePlay = false,
}: {
  track: TrackSummary;
  artistProfile?: ArtistPublicProfile | null;
  onUnlocked?: () => void | Promise<void>;
  hidePlay?: boolean;
}) => {
  const { session } = useAuth();
  const { activeTrackId, playTrack, setPlaybackQueue } = useGlobalPlayback();
  const runCheckout = useStellarCheckout();
  const [isBuying, setIsBuying] = useState(false);
  const buyButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!hidePlay && track.playbackReady) playbackApi.preloadTracks(session?.token, [track]);
  }, [hidePlay, track.id, track.playbackReady, session?.token]);
  const [purchased, setPurchased] = useState(false);
  const [checkingPurchase, setCheckingPurchase] = useState(false);
  useEffect(() => {
    let current = true;
    setPurchased(false);
    if (!session?.token || !track.purchaseEnabled) return;
    setCheckingPurchase(true);
    void paymentsApi
      .listMine(session.token)
      .then((items) => {
        if (current)
          setPurchased(
            items.some(
              (payment) =>
                payment.trackId === track.id &&
                payment.productType === "track_purchase" &&
                payment.status === "confirmed",
            ),
          );
      })
      .catch(() => {})
      .finally(() => {
        if (current) setCheckingPurchase(false);
      });
    return () => {
      current = false;
    };
  }, [session?.token, track.id, track.purchaseEnabled]);

  const purchaseLabel = useMemo(
    () => formatAmountLabel(track.purchasePrice, track.purchaseAssetCode),
    [track.purchaseAssetCode, track.purchasePrice],
  );

  const ensureSession = () => {
    if (!session?.token) {
      toast.error("Sign in with your Stellar wallet first.");
      return null;
    }

    return session.token;
  };

  const handleBuyTrack = async () => {
    const token = ensureSession();

    if (!token) {
      return;
    }

    try {
      setIsBuying(true);
      const intent = await paymentsApi.createTrackPurchaseIntent(
        token,
        track.id,
      );
      const txHash = await runCheckout(intent);
      await paymentsApi.confirm(token, {
        intentId: intent.id,
        txHash,
      });
      setPurchased(true);
      toast.success("Track unlocked.");
      await onUnlocked?.();
      if (activeTrackId !== track.id) setPlaybackQueue([track]);
      await playTrack(track);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to complete purchase",
      );
    } finally {
      setIsBuying(false);
      requestAnimationFrame(() => buyButton.current?.focus());
    }
  };

  const handlePlay = async () => {
    try {
      if (activeTrackId !== track.id) setPlaybackQueue([track]);
      await playTrack(track);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to start playback",
      );
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {!hidePlay ? (
        <Button
          className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          disabled={!track.playbackReady}
          onClick={() => void handlePlay()}
        >
          <Play className="mr-2 h-4 w-4 fill-current" />
          {activeTrackId === track.id ? "Playing" : "Play"}
        </Button>
      ) : null}

      {track.purchaseEnabled && purchased ? (
        <span className="inline-flex items-center gap-2 text-sm text-emerald-400">
          <Check className="h-4 w-4" />
          Purchased
        </span>
      ) : track.purchaseEnabled ? (
        <Button
          ref={buyButton}
          className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          disabled={isBuying || checkingPurchase}
          onClick={() => void handleBuyTrack()}
        >
          {isBuying ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShoppingBag className="mr-2 h-4 w-4" />
          )}
          {purchaseLabel ? `Buy ${purchaseLabel}` : "Buy track"}
        </Button>
      ) : null}
    </div>
  );
};
