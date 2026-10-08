"use client";

import { useCallback } from "react";

import type { PaymentIntentRecord } from "@music-city/shared";

import { useAuth } from "@/hooks/use-auth";
import { sendFreighterPayment } from "@/features/wallet/lib/freighter";

export const useStellarCheckout = () => {
  const { session } = useAuth();

  return useCallback(
    async (intent: PaymentIntentRecord): Promise<string> => {
      if (!session?.walletAddress) {
        throw new Error("A Stellar wallet is required to complete this payment.");
      }

      const txHash = await sendFreighterPayment({
        accountAddress: session.walletAddress,
        destinationAddress: intent.destinationAddress,
        amount: intent.amount,
        assetCode: intent.assetCode,
        assetIssuer: intent.assetIssuer,
      });

      if (!txHash) {
        throw new Error("Wallet did not return a Stellar transaction hash.");
      }

      return txHash;
    },
    [session?.walletAddress],
  );
};
