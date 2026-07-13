"use client";

import { useEffect, useMemo, useState } from "react";
import type { PaymentRecord, SubscriptionRecord, TrackSummary } from "@music-city/shared";

import { paymentsApi } from "@/features/payments/lib/payments-api";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
import { subscriptionsApi } from "@/features/subscriptions/lib/subscriptions-api";
import { useAuth } from "@/hooks/use-auth";

const StatTile = ({ label, value, hint }: { label: string; value: string; hint: string }) => (
  <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-5">
    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
    <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    <p className="mt-2 text-sm text-slate-400">{hint}</p>
  </div>
);

const sumAmounts = (items: PaymentRecord[]) =>
  items.reduce((sum, item) => sum + Number.parseFloat(item.amount), 0);

export const DashboardRevenueOverview = () => {
  const { session } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = session?.token;

    if (!token) {
      setPayments([]);
      setSubscriptions([]);
      setTracks([]);
      setIsLoading(false);
      return;
    }

    if (session?.role !== "artist") {
      setPayments([]);
      setSubscriptions([]);
      setTracks([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [nextPayments, nextSubscriptions, nextTracks] = await Promise.all([
          paymentsApi.listMine(token),
          subscriptionsApi.listMine(token),
          tracksApi.listMyTracks(token),
        ]);

        if (!cancelled) {
          setPayments(nextPayments);
          setSubscriptions(nextSubscriptions);
          setTracks(nextTracks);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load revenue",
          );
          setPayments([]);
          setSubscriptions([]);
          setTracks([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  const metrics = useMemo(() => {
    const confirmedPayments = payments.filter(
      (payment) =>
        payment.status === "confirmed" &&
        (payment.productType === "track_purchase" ||
          payment.productType === "platform_subscription"),
    );
    const trackSales = confirmedPayments.filter(
      (payment) => payment.productType === "track_purchase",
    );
    const subscriptionSales = confirmedPayments.filter(
      (payment) => payment.productType === "platform_subscription",
    );
    const activeSubscriptions = subscriptions.filter(
      (subscription) => subscription.status === "active",
    );

    return {
      grossRevenue: sumAmounts(confirmedPayments),
      trackRevenue: sumAmounts(trackSales),
      subscriptionRevenue: sumAmounts(subscriptionSales),
      trackSalesCount: trackSales.length,
      subscriptionSalesCount: subscriptionSales.length,
      activeSubscriptions: activeSubscriptions.length,
      publishedTracks: tracks.filter((track) => track.access !== "private").length,
      privateTracks: tracks.filter((track) => track.access === "private").length,
      recentPayments: [...confirmedPayments].sort(
        (left, right) => Date.parse(right.confirmedAt) - Date.parse(left.confirmedAt),
      ),
    };
  }, [payments, subscriptions, tracks]);

  if (!session) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Connect your wallet before viewing revenue.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Loading revenue...
      </div>
    );
  }

  if (session.role !== "artist" || !session.artistOnboardingFeePaid) {
    return <ArtistAccessGate action="view artist revenue" />;
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-8 text-red-100">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-7">
        <p className="text-sm uppercase tracking-[0.28em] text-emerald-400">
          Revenue
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          Sales and unlock performance
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
          Monitor one-time purchases, platform subscription unlocks, and how your
          monetized catalog is currently set up. This gives the studio a real revenue
          surface now, even before deeper royalty rollups land.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Gross revenue"
          value={metrics.grossRevenue.toFixed(2)}
          hint="Confirmed payments across purchases and subscriptions"
        />
        <StatTile
          label="Track sales"
          value={metrics.trackSalesCount.toLocaleString()}
          hint={`${metrics.trackRevenue.toFixed(2)} from one-time purchases`}
        />
        <StatTile
          label="Subscription sales"
          value={metrics.subscriptionSalesCount.toLocaleString()}
          hint={`${metrics.subscriptionRevenue.toFixed(2)} from platform subscriptions`}
        />
        <StatTile
          label="Active subs"
          value={metrics.activeSubscriptions.toLocaleString()}
          hint="Current memberships on your account"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              Recent confirmed payments
            </p>
            <h3 className="text-2xl font-semibold text-white">Payment feed</h3>
          </div>

          {metrics.recentPayments.length === 0 ? (
            <div className="mt-6 text-sm text-slate-400">
              No confirmed payments yet.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {metrics.recentPayments.slice(0, 10).map((payment) => (
                <div
                  key={payment.id}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 md:grid-cols-[minmax(0,1.3fr)_120px_110px]"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white">
                      {payment.productType === "track_purchase"
                        ? "Track purchase"
                        : payment.productType === "platform_subscription"
                          ? "Platform subscription"
                          : "Artist onboarding fee"}
                    </p>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {payment.trackId || payment.walletAddress}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Amount
                    </p>
                    <p className="mt-1 text-white">
                      {payment.amount} {payment.assetCode}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Confirmed
                    </p>
                    <p className="mt-1 text-white">
                      {new Date(payment.confirmedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
            Monetization setup
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Catalog mix</h3>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
              <span className="text-slate-300">Published tracks</span>
              <span className="font-semibold text-white">
                {metrics.publishedTracks}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
              <span className="text-slate-300">Unpublished tracks</span>
              <span className="font-semibold text-white">
                {metrics.privateTracks}
              </span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm leading-7 text-slate-300">
              Listener subscriptions are handled at the platform level. This area can
              absorb deeper royalties and payout reporting next without changing the
              studio structure again.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
