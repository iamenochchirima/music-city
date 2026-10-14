"use client";

import { useEffect, useMemo, useState } from "react";
import type { PaymentIntentRecord, WalletAccount } from "@music-city/shared";
import { AlertCircle, LoaderCircle, ShieldCheck } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { ActionBar } from "@/components/studio/action-bar";
import { Button } from "@/components/ui/button";
import { walletApi } from "@/features/wallet/lib/wallet-api";
import { useAuth } from "@/hooks/use-auth";

const formatAmount = (value: string) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 7,
  }).format(Number(value));

const shortenAddress = (value: string) =>
  `${value.slice(0, 8)}…${value.slice(-8)}`;

type ArtistPaymentReviewDialogProps = {
  intent: PaymentIntentRecord | null;
  isPaying: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ArtistPaymentReviewDialog = ({
  intent,
  isPaying,
  onCancel,
  onConfirm,
}: ArtistPaymentReviewDialogProps) => {
  const { session } = useAuth();
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!intent || !session?.token) {
      setAccount(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void walletApi
      .getMe(session.token)
      .then((nextAccount) => {
        if (!cancelled) {
          setAccount(nextAccount);
        }
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load wallet balances.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [intent, session?.token]);

  const paymentBalance = useMemo(() => {
    if (!intent) {
      return null;
    }

    return (
      account?.balances.find(
        (balance) =>
          balance.assetCode === intent.assetCode &&
          (balance.assetIssuer ?? "") === (intent.assetIssuer ?? ""),
      ) ?? null
    );
  }, [account?.balances, intent]);

  if (!intent) {
    return null;
  }

  const hasEnoughBalance =
    Boolean(paymentBalance) &&
    Number(paymentBalance?.availableAmount ?? "0") >= Number(intent.amount);
  const isBalancePending = isLoading || (!account && !error);
  const canConfirm =
    Boolean(account?.exists) &&
    !isBalancePending &&
    !error &&
    hasEnoughBalance &&
    !isPaying;

  return (
    <Dialog
      title="Confirm first-upload payment"
      description="Review the amount and wallet balances before confirming."
      busy={isPaying}
      onClose={onCancel}
      className="max-w-xl"
    >
      <div className="space-y-2 border-b border-border pb-5">
        <p className="text-sm text-muted-foreground">You will pay</p>
        <p className="mt-1 text-3xl font-semibold text-foreground">
          {formatAmount(intent.amount)} {intent.assetCode}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          One-time payment to activate music uploads. The exact Stellar amount
          includes the transaction’s unique reference.
        </p>
      </div>

      <dl className="divide-y divide-border">
        <div className="flex items-center justify-between gap-4 py-3 text-sm">
          <dt className="text-muted-foreground">From</dt>
          <dd className="font-medium text-foreground">
            {shortenAddress(intent.walletAddress)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3 text-sm">
          <dt className="text-muted-foreground">To Music City treasury</dt>
          <dd className="font-medium text-foreground">
            {shortenAddress(intent.destinationAddress)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3 text-sm">
          <dt className="text-muted-foreground">Available to spend</dt>
          <dd className="font-medium text-foreground">
            {isBalancePending
              ? "Loading…"
              : paymentBalance
                ? `${formatAmount(paymentBalance.availableAmount)} ${paymentBalance.assetCode}`
                : `No ${intent.assetCode} balance`}
          </dd>
        </div>
      </dl>

      {account?.balances.length ? (
        <div className="mt-5">
          <p className="text-sm font-medium text-muted-foreground">
            Wallet balances
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {account.balances.map((balance) => (
              <span
                key={balance.assetKey}
                className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground"
              >
                {formatAmount(balance.availableAmount)} {balance.assetCode}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {error || (!isBalancePending && !hasEnoughBalance) ? (
        <div role="alert" className="flex gap-3 text-sm leading-6 text-warning">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            {error ??
              (!account?.exists
                ? "This Stellar account is not funded on the current network."
                : `You need at least ${formatAmount(intent.amount)} ${intent.assetCode} available to continue.`)}
          </p>
        </div>
      ) : null}

      <ActionBar>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          autoFocus
          disabled={isPaying}
        >
          Cancel
        </Button>
        <Button type="button" disabled={!canConfirm} onClick={onConfirm}>
          {isPaying ? (
            <LoaderCircle
              className="mr-2 size-4 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <ShieldCheck className="mr-2 size-4" aria-hidden="true" />
          )}
          {isPaying
            ? "Confirming on Stellar…"
            : `Confirm ${formatAmount(intent.amount)} ${intent.assetCode}`}
        </Button>
      </ActionBar>
      <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
        No funds move until you select Confirm. Your wallet may ask for one
        final approval.
      </p>
    </Dialog>
  );
};
