"use client";

import { useState } from "react";
import { useDynamicContext, useUserWallets } from "@dynamic-labs/sdk-react-core";

import { useAuth } from "@/hooks/use-auth";
import { resolveStellarWallet } from "@/features/wallet/lib/resolve-stellar-wallet";
import { useStellarAuthorization } from "@/features/wallet/lib/use-stellar-authorization";

import { agreementApi } from "./agreement-api";

/** Creates and signs a 100% owner agreement when a song has no contributors. */
export const useOwnerSaleAgreement = () => {
  const { session } = useAuth();
  const { primaryWallet } = useDynamicContext();
  const wallets = useUserWallets();
  const authorize = useStellarAuthorization();
  const [busy, setBusy] = useState(false);

  const start = async (trackId: string) => {
    if (!session?.token) throw new Error("Sign in first");
    setBusy(true);
    try {
      const result = await agreementApi.ownerSale(session.token, trackId);

      if (result.status === "ready") return { status: "ready" as const };
      if (result.status === "existing")
        return { status: "existing" as const, agreementId: result.agreementId! };

      const challenge = result.challenge!;
      const wallet = resolveStellarWallet(
        session.walletAddress,
        primaryWallet,
        wallets,
      );
      if (!wallet) throw new Error("Connect your linked Stellar wallet");

      await authorize(wallet);
      const signedTransaction = await wallet.signTransaction(
        challenge.transaction,
      );
      await agreementApi.respond(session.token, result.agreementId!, {
        challengeId: challenge.id,
        signedTransaction,
      });
      return { status: "ready" as const };
    } finally {
      setBusy(false);
    }
  };

  return { start, busy };
};
