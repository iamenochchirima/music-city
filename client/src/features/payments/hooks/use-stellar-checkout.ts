"use client";

import { createContext, createElement, useCallback, useContext, type ReactNode } from "react";
import { useDynamicContext, useUserWallets } from "@dynamic-labs/sdk-react-core";

import type { PaymentIntentRecord } from "@music-city/shared";

import { useAuth } from "@/hooks/use-auth";
import {
  ensureActiveStellarAccount,
  resolveStellarWallet,
} from "@/features/wallet/lib/resolve-stellar-wallet";

type Checkout = (intent: PaymentIntentRecord) => Promise<string>;
const StellarCheckoutContext = createContext<Checkout | null>(null);

export const useStellarCheckout = () => {
  const checkout = useContext(StellarCheckoutContext);
  return useCallback(async (intent: PaymentIntentRecord) => {
    if (!checkout) throw new Error("Wallet payments require a configured Dynamic provider.");
    return checkout(intent);
  }, [checkout]);
};

export const StellarCheckoutProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useAuth();
  const { primaryWallet } = useDynamicContext();
  const userWallets = useUserWallets();

  const checkout = useCallback(
    async (intent: PaymentIntentRecord): Promise<string> => {
      const stellarWallet = resolveStellarWallet(
        session?.walletAddress,
        primaryWallet,
        userWallets,
      );

      if (!stellarWallet) {
        throw new Error("A Stellar wallet is required to complete this payment.");
      }

      const walletAddress = stellarWallet.address;

      if (!walletAddress) {
        throw new Error("Connected Stellar wallet address is missing.");
      }

      await ensureActiveStellarAccount(stellarWallet);

      const txHash = await stellarWallet.sendBalance({
        amount: intent.amount,
        toAddress: intent.destinationAddress,
        token:
          intent.assetCode.toUpperCase() === "XLM" && !intent.assetIssuer
            ? undefined
            : {
                address: `${intent.assetCode}:${intent.assetIssuer ?? ""}`,
              },
      });

      if (!txHash) {
        throw new Error("Wallet did not return a Stellar transaction hash.");
      }

      return txHash;
    },
    [primaryWallet, session?.walletAddress, userWallets],
  );
  return createElement(StellarCheckoutContext.Provider, { value: checkout }, children);
};
