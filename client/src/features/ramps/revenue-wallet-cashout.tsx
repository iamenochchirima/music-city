"use client";

import { useDynamicContext, useUserWallets } from "@dynamic-labs/sdk-react-core";
import { useEffect, useState } from "react";
import type { WalletAccount } from "@music-city/shared";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useStellarAuthorization } from "@/features/wallet/lib/use-stellar-authorization";
import { resolveStellarWallet } from "@/features/wallet/lib/resolve-stellar-wallet";
import { WalletRampActivity } from "@/features/ramps/wallet-ramp-activity";
import { walletApi } from "@/features/wallet/lib/wallet-api";
import { clientEnv } from "@/lib/config/env";

const formatUsdc = (value: string) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 7 }).format(
    Number(value),
  );

export function RevenueWalletCashout() {
  const { session } = useAuth();
  const { primaryWallet } = useDynamicContext();
  const wallets = useUserWallets();
  const authorizeWallet = useStellarAuthorization();
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setAccount(null);
    if (!session?.token) {
      setLoading(false);
      return;
    }

    void walletApi
      .getMe(session.token)
      .then((result) => {
        if (active) setAccount(result);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.token, retry]);

  if (!session?.token) return null;

  const usdc = account?.balances.find(
    (balance) =>
      balance.assetCode === clientEnv.stellarTestnetUsdcCode &&
      balance.assetIssuer === clientEnv.stellarTestnetUsdcIssuer,
  );
  const wallet = resolveStellarWallet(
    session.walletAddress,
    primaryWallet,
    wallets,
  );
  const sign = wallet
    ? async (transaction: string) => {
        await authorizeWallet(wallet);
        return wallet.signTransaction(transaction);
      }
    : undefined;

  return (
    <section
      aria-labelledby="wallet-cashout-title"
      className="space-y-4 rounded-xl border border-border p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="wallet-cashout-title" className="font-semibold">
            Wallet funds
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Spendable USDC is separate from unclaimed earnings.
          </p>
        </div>
        <div className="text-right" aria-live="polite">
          <p className="text-sm text-muted-foreground">Spendable</p>
          <p className="mt-1 text-lg font-semibold">
            {loading ? "Loading…" : `${formatUsdc(usdc?.availableAmount ?? "0")} USDC`}
          </p>
        </div>
      </div>
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span>Could not load your wallet balance.</span>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </Button>
        </div>
      )}
      <WalletRampActivity
        token={session.token}
        sign={sign}
        spendableUsdc={usdc?.availableAmount ?? "0"}
        showTransactions={false}
      />
      <div className="flex justify-end">
        <Button variant="link" asChild className="h-auto p-0">
          <Link to="/account">View wallet and transaction history</Link>
        </Button>
      </div>
    </section>
  );
}
