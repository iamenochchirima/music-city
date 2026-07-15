"use client";

import { useEffect, useMemo, useState } from "react";
import type { PaymentIntentRecord, WalletAccount } from "@music-city/shared";
import { AlertCircle, LoaderCircle, ShieldCheck, WalletCards, X } from "lucide-react";

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

  useEffect(() => {
    if (!intent) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPaying) {
        onCancel();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [intent, isPaying, onCancel]);

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
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="artist-payment-review-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPaying) {
          onCancel();
        }
      }}
    >
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#090d1d] p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
              <WalletCards className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-emerald-400">
                Review payment
              </p>
              <h2
                id="artist-payment-review-title"
                className="mt-1 text-2xl font-semibold text-white"
              >
                Confirm first-upload payment
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/10 p-2 text-slate-400 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onCancel}
            disabled={isPaying}
            aria-label="Cancel payment review"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-5">
          <p className="text-sm text-slate-400">You will pay</p>
          <p className="mt-1 text-3xl font-semibold text-white">
            {formatAmount(intent.amount)} {intent.assetCode}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            One-time payment to activate music uploads. The exact Stellar amount includes the transaction’s unique reference.
          </p>
        </div>

        <dl className="mt-5 divide-y divide-white/10 rounded-2xl border border-white/10 bg-slate-950/55 px-4">
          <div className="flex items-center justify-between gap-4 py-3 text-sm">
            <dt className="text-slate-400">From</dt>
            <dd className="font-medium text-white">
              {shortenAddress(intent.walletAddress)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3 text-sm">
            <dt className="text-slate-400">To Music City treasury</dt>
            <dd className="font-medium text-white">
              {shortenAddress(intent.destinationAddress)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3 text-sm">
            <dt className="text-slate-400">Available to spend</dt>
            <dd className="font-medium text-white">
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
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              Wallet balances
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {account.balances.map((balance) => (
                <span
                  key={balance.assetKey}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300"
                >
                  {formatAmount(balance.availableAmount)} {balance.assetCode}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {error || (!isBalancePending && !hasEnoughBalance) ? (
          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              {error ??
                (!account?.exists
                  ? "This Stellar account is not funded on the current network."
                  : `You need at least ${formatAmount(intent.amount)} ${intent.assetCode} available to continue.`)}
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={onCancel}
            disabled={isPaying}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            disabled={!canConfirm}
            onClick={onConfirm}
            autoFocus
          >
            {isPaying ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="mr-2 size-4" aria-hidden="true" />
            )}
            {isPaying
              ? "Confirming on Stellar…"
              : `Confirm ${formatAmount(intent.amount)} ${intent.assetCode}`}
          </Button>
        </div>
        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          No funds move until you select Confirm. Your wallet may ask for one final approval.
        </p>
      </div>
    </div>
  );
};
