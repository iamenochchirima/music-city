"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDynamicContext, useUserWallets } from "@dynamic-labs/sdk-react-core";
import { ArrowLeft, CheckCircle2, LoaderCircle, Ticket } from "lucide-react";
import { toast } from "sonner";

import type {
  PlatformSubscriptionPlan,
  SubscriptionRecord,
  TrackSummary,
  WalletAccount,
} from "@music-city/shared";

import { Button } from "@/components/ui/button";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { paymentsApi } from "@/features/payments/lib/payments-api";
import { useStellarCheckout } from "@/features/payments/hooks/use-stellar-checkout";
import { subscriptionsApi } from "@/features/subscriptions/lib/subscriptions-api";
import { walletApi } from "@/features/wallet/lib/wallet-api";
import {
  ensureActiveStellarAccount,
  resolveStellarWallet,
} from "@/features/wallet/lib/resolve-stellar-wallet";
import { useAuth } from "@/hooks/use-auth";
import { clientEnv } from "@/lib/config/env";

const formatAmountLabel = (plan: PlatformSubscriptionPlan | null) => {
  if (!plan) {
    return "Membership unavailable";
  }

  return `${plan.price} ${plan.assetCode}`;
};

const formatPeriodLabel = (periodDays: number) => {
  if (periodDays === 30) {
    return "Billed every 30 days";
  }

  if (periodDays === 7) {
    return "Billed every 7 days";
  }

  return `Billed every ${periodDays} days`;
};

const describeWalletError = (caughtError: unknown, fallback: string) => {
  if (!(caughtError instanceof Error)) {
    return fallback;
  }

  const candidate = caughtError as Error & {
    response?: {
      data?: {
        detail?: string;
        extras?: {
          result_codes?: {
            transaction?: string;
            operations?: string[];
          };
        };
      };
    };
    cause?: {
      response?: {
        data?: {
          detail?: string;
          extras?: {
            result_codes?: {
              transaction?: string;
              operations?: string[];
            };
          };
        };
      };
    };
  };

  const payload = candidate.response?.data ?? candidate.cause?.response?.data;
  const transactionCode = payload?.extras?.result_codes?.transaction;
  const operationCode = payload?.extras?.result_codes?.operations?.[0];
  const detail = payload?.detail?.trim();

  if (operationCode === "op_low_reserve") {
    return "Your wallet needs a little more XLM reserve before it can add USDC.";
  }

  if (operationCode === "op_already_exists") {
    return "USDC is already enabled for this wallet. Refresh and try again.";
  }

  if (operationCode === "op_no_issuer") {
    return "The configured USDC issuer was not found on Stellar testnet.";
  }

  if (transactionCode || operationCode) {
    return `Stellar rejected the request: ${[transactionCode, operationCode]
      .filter(Boolean)
      .join(" / ")}.`;
  }

  if (detail) {
    return detail;
  }

  if (caughtError.message.trim()) {
    return caughtError.message;
  }

  return fallback;
};

export const PlatformSubscriptionOverview = ({
  trackId,
}: {
  trackId?: string;
}) => {
  const router = useRouter();
  const { session } = useAuth();
  const { primaryWallet } = useDynamicContext();
  const userWallets = useUserWallets();
  const runCheckout = useStellarCheckout();
  const [plan, setPlan] = useState<PlatformSubscriptionPlan | null>(null);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isAddingUsdcTrustline, setIsAddingUsdcTrustline] = useState(false);
  const [isTrustlineApprovalSlow, setIsTrustlineApprovalSlow] = useState(false);
  const trustlineApprovalTimerRef = useRef<number | null>(null);

  const stellarWallet = resolveStellarWallet(
    session?.walletAddress,
    primaryWallet,
    userWallets,
  );

  const load = async () => {
    setIsLoading(true);

    try {
      const [nextPlan, allTracks, mySubscriptions, walletAccount] = await Promise.all([
        subscriptionsApi.getPlatformPlan(),
        tracksApi.listTracks(),
        session?.token ? subscriptionsApi.listMine(session.token) : Promise.resolve([]),
        session?.token
          ? walletApi.getMe(session.token).catch(() => null)
          : Promise.resolve(null),
      ]);

      setPlan(nextPlan);
      setTracks(allTracks);
      setAccount(walletAccount);
      setSubscription(
        mySubscriptions.find(
          (item) => item.scope === "platform" && item.status === "active",
        ) ?? null,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load subscription page",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [session?.token]);

  useEffect(() => {
    return () => {
      if (trustlineApprovalTimerRef.current) {
        window.clearTimeout(trustlineApprovalTimerRef.current);
      }
    };
  }, []);

  const selectedTrack = useMemo(
    () => tracks.find((track) => track.id === trackId) ?? null,
    [trackId, tracks],
  );

  const hasRequiredTrustline = useMemo(() => {
    if (!plan || !account?.balances.length) {
      return false;
    }

    return account.balances.some(
      (balance) =>
        balance.assetCode === plan.assetCode &&
        (balance.assetIssuer ?? "") === (plan.assetIssuer ?? ""),
    );
  }, [account?.balances, plan]);

  const openSelectedTrack = () => {
    if (trackId) {
      router.push(`/stream/${trackId}`);
      return;
    }

    router.push("/stream");
  };

  const handleSubscribe = async () => {
    if (!session?.token) {
      toast.error("Sign in with your Stellar wallet first.");
      router.push("/auth");
      return;
    }

    if (!plan?.enabled) {
      toast.error("Music City Pass is not available right now.");
      return;
    }

    try {
      setIsSubscribing(true);
      const intent = await paymentsApi.createPlatformSubscriptionIntent(session.token);
      const txHash = await runCheckout(intent);
      await paymentsApi.confirm(session.token, {
        intentId: intent.id,
        txHash,
      });
      toast.success("Music City Pass activated.");
      await load();
      openSelectedTrack();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to complete subscription",
      );
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleEnableUsdc = async () => {
    if (!plan) {
      return;
    }

    if (!session?.token) {
      toast.error("Sign in with your Stellar wallet first.");
      router.push("/auth");
      return;
    }

    if (!stellarWallet) {
      toast.error("Connect a Stellar wallet first.");
      return;
    }

    if (!account?.exists) {
      toast.error("Fund this wallet with a little testnet XLM before enabling USDC.");
      return;
    }

    setIsAddingUsdcTrustline(true);
    setIsTrustlineApprovalSlow(false);

    trustlineApprovalTimerRef.current = window.setTimeout(() => {
      setIsTrustlineApprovalSlow(true);
    }, 5000);

    void stellarWallet.connector
      .connect()
      .then(async () => {
        await ensureActiveStellarAccount(stellarWallet);
        return stellarWallet.addTrustline({
          assetCode: plan.assetCode,
          assetIssuer: plan.assetIssuer ?? clientEnv.stellarTestnetUsdcIssuer,
        });
      })
      .then(async () => {
        toast.success("USDC is now enabled for this wallet.");
        await load();
      })
      .catch((caughtError: unknown) => {
        toast.error(describeWalletError(caughtError, "Unable to enable USDC."));
      })
      .finally(() => {
        if (trustlineApprovalTimerRef.current) {
          window.clearTimeout(trustlineApprovalTimerRef.current);
          trustlineApprovalTimerRef.current = null;
        }
        setIsAddingUsdcTrustline(false);
        setIsTrustlineApprovalSlow(false);
      });
  };

  if (isLoading) {
    return <div className="text-sm text-slate-400">Loading subscription...</div>;
  }

  if (!plan) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
        Subscription plan unavailable.
      </div>
    );
  }

  const amountLabel = formatAmountLabel(plan);
  const subscriberTrackCount = tracks.length;

  return (
    <div className="max-w-4xl space-y-8">
      <Button
        asChild
        variant="outline"
        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
      >
        <Link href={trackId ? `/stream/${trackId}` : "/stream"}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {trackId ? "Back to track" : "Back to streaming"}
        </Link>
      </Button>

      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-white sm:p-8">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">{plan.name}</p>
          <h2 className="text-3xl font-semibold sm:text-4xl">Subscribe</h2>
          <p className="max-w-2xl text-base text-slate-300">
            {selectedTrack
              ? `Unlock ${selectedTrack.title} and every other subscriber-only track with one pass.`
              : "One pass unlocks every subscriber-only track across Music City."}
          </p>
        </div>

        <div className="mt-8 grid gap-6 border-t border-white/10 pt-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                {amountLabel}
              </p>
              <p className="text-sm text-slate-400">{formatPeriodLabel(plan.periodDays)}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Payment</p>
                <p className="mt-2 text-base text-white">USDC on Stellar</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Access</p>
                <p className="mt-2 text-base text-white">
                  {subscriberTrackCount} locked {subscriberTrackCount === 1 ? "track" : "tracks"}
                </p>
              </div>
            </div>

            {selectedTrack ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">Selected track</p>
                <p className="mt-2 text-lg font-semibold text-white">{selectedTrack.title}</p>
                <p className="text-sm text-slate-200">{selectedTrack.artistName}</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
            {subscription ? (
              <>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <div className="flex items-center gap-2 text-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Active subscription</span>
                  </div>
                  <p className="mt-2 text-sm text-white">
                    Access ends {new Date(subscription.endsAt).toLocaleDateString()}.
                  </p>
                </div>

                <Button
                  className="w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  onClick={openSelectedTrack}
                >
                  {trackId ? "Open track" : "Go to stream"}
                </Button>
              </>
            ) : !session?.token ? (
              <>
                <p className="text-sm text-slate-300">
                  Sign in with your Stellar wallet to subscribe.
                </p>
                <Button
                  asChild
                  className="w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                >
                  <Link href="/auth">Sign in to subscribe</Link>
                </Button>
              </>
            ) : !plan.enabled ? (
              <p className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                Subscriptions are not available right now.
              </p>
            ) : !hasRequiredTrustline ? (
              <>
                <div className="space-y-2">
                  <p className="text-base font-medium text-white">Enable USDC first</p>
                  <p className="text-sm text-slate-400">
                    Add USDC to this wallet once, then you can subscribe.
                  </p>
                </div>
                <Button
                  className="w-full bg-white text-slate-950 hover:bg-slate-100"
                  disabled={isAddingUsdcTrustline}
                  onClick={() => void handleEnableUsdc()}
                >
                  {isAddingUsdcTrustline ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Enable USDC
                </Button>
                <p className="text-xs text-slate-500">
                  You need a little testnet XLM in the wallet for Stellar reserve and fees.
                </p>
                {isTrustlineApprovalSlow ? (
                  <p className="text-xs text-emerald-300">Approve the trustline in your wallet.</p>
                ) : null}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-base font-medium text-white">Ready to subscribe</p>
                  <p className="text-sm text-slate-400">
                    Pay with USDC and unlock playback right after confirmation.
                  </p>
                </div>
                <Button
                  className="w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  disabled={isSubscribing}
                  onClick={() => void handleSubscribe()}
                >
                  {isSubscribing ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Ticket className="mr-2 h-4 w-4" />
                  )}
                  Subscribe
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
