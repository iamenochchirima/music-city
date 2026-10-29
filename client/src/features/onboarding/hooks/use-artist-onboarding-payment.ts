"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArtistActivationQuote, PaymentIntentRecord } from "@music-city/shared";

import { useStellarCheckout } from "@/features/payments/hooks/use-stellar-checkout";
import { paymentsApi } from "@/features/payments/lib/payments-api";
import { useAuth } from "@/hooks/use-auth";

export const useArtistOnboardingPayment = () => {
  const { session, refreshSessionProfile } = useAuth();
  const runCheckout = useStellarCheckout();
  const [isPaid, setIsPaid] = useState(
    session?.artistAccess ?? false,
  );
  const [activationQuote, setActivationQuote] =
    useState<ArtistActivationQuote | null>(null);
  const [isChecking, setIsChecking] = useState(Boolean(session?.token));
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    setIsPaid(session?.artistAccess ?? false);
  }, [session?.artistAccess]);

  useEffect(() => {
    if (!session?.token) {
      setIsChecking(false);
      setActivationQuote(null);
      return;
    }

    let cancelled = false;
    setIsChecking(true);

    void paymentsApi
      .getArtistOnboardingFeeStatus(session.token)
      .then((status) => {
        if (!cancelled) {
          setIsPaid(status.artistAccess);
          setActivationQuote(status);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setIsChecking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  const prepare = useCallback(async () => {
    if (!session?.token) {
      throw new Error("Connect your wallet first");
    }

    setIsPreparing(true);

    try {
      const activation = await paymentsApi.getArtistOnboardingFeeStatus(session.token);
      setActivationQuote(activation);
      setIsPaid(activation.artistAccess);
      if (activation.status === "eligible" || activation.status === "sponsored") {
        throw new Error("Music City has covered your artist activation fee");
      }
      if (activation.artistAccess) {
        throw new Error("Artist onboarding has already been unlocked");
      }
      return await paymentsApi.createArtistOnboardingFeeIntent(session.token);
    } finally {
      setIsPreparing(false);
    }
  }, [session?.token]);

  const refreshStatus = useCallback(async () => {
    if (!session?.token) return null;

    setIsChecking(true);
    try {
      const activation = await paymentsApi.getArtistOnboardingFeeStatus(session.token);
      setActivationQuote(activation);
      setIsPaid(activation.artistAccess);
      await refreshSessionProfile().catch(() => undefined);
      return activation;
    } finally {
      setIsChecking(false);
    }
  }, [refreshSessionProfile, session?.token]);

  const complete = useCallback(async (intent: PaymentIntentRecord) => {
    if (!session?.token) {
      throw new Error("Connect your wallet first");
    }

    setIsPaying(true);

    try {
      const txHash = await runCheckout(intent);
      await paymentsApi.confirm(session.token, {
        intentId: intent.id,
        txHash,
      });
      setIsPaid(true);
      await refreshSessionProfile().catch(() => undefined);
    } finally {
      setIsPaying(false);
    }
  }, [refreshSessionProfile, runCheckout, session?.token]);

  return {
    isChecking,
    isPaid,
    activationQuote,
    isPaying,
    isPreparing,
    prepare,
    refreshStatus,
    complete,
  };
};
