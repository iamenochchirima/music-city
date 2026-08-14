"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  PaymentRecord,
  SubscriptionRecord,
  TrackSummary,
  UserProfile,
} from "@music-city/shared";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { paymentsApi } from "@/features/payments/lib/payments-api";
import { subscriptionsApi } from "@/features/subscriptions/lib/subscriptions-api";
import { usersApi } from "@/features/users/lib/users-api";
import { WalletOverviewCard } from "@/features/wallet/components/wallet-overview-card";
import { clientEnv } from "@/lib/config/env";

const formatIntent = (intent?: "listener" | "artist" | "both") => {
  switch (intent) {
    case "listener":
      return "Listener";
    case "artist":
      return "Artist";
    case "both":
      return "Listener + artist";
    default:
      return "Member";
  }
};

const compactWalletAddress = (walletAddress: string) =>
  `${walletAddress.slice(0, 5)}…${walletAddress.slice(-4)}`;

const activityLabel = (track: TrackSummary) => {
  if (track.playbackReady) {
    return "Ready to play";
  }

  switch (track.status) {
    case "awaiting_upload":
      return "Waiting for upload";
    case "uploaded":
      return "Uploaded";
    case "processing":
      return "Processing";
    case "published":
      return "Published";
    case "failed":
      return "Needs attention";
    default:
      return "Draft";
  }
};

export const AccountOverview = () => {
  const { session, refreshSessionProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [onboardingState, setOnboardingState] = useState<Awaited<ReturnType<typeof usersApi.getOnboardingState>>>(null);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingIntent, setIsUpdatingIntent] = useState(false);

  useEffect(() => {
    const token = session?.token;

    if (!token) {
      setProfile(null);
      setTracks([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [nextProfile, nextOnboardingState, nextTracks, nextPayments, nextSubscriptions] = await Promise.all([
          usersApi.getMe(token),
          usersApi.getOnboardingState(token),
          tracksApi.listMyTracks(token),
          paymentsApi.listMine(token),
          subscriptionsApi.listMine(token),
        ]);

        if (!cancelled) {
          setProfile(nextProfile ?? null);
          setOnboardingState(nextOnboardingState);
          setTracks(Array.isArray(nextTracks) ? nextTracks : []);
          setPayments(Array.isArray(nextPayments) ? nextPayments : []);
          setSubscriptions(Array.isArray(nextSubscriptions) ? nextSubscriptions : []);
        }
      } catch (error) {
        if (!cancelled) {
          setProfile(null);
          setOnboardingState(null);
          setTracks([]);
          setPayments([]);
          setSubscriptions([]);
          setLoadError(error instanceof Error ? error.message : "Failed to load account.");
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

  const updateIntent = async (primaryIntent: "listener" | "artist" | "both") => {
    if (!session?.token || primaryIntent === (profile?.primaryIntent ?? session.primaryIntent)) {
      return;
    }

    setIsUpdatingIntent(true);
    try {
      const nextProfile = await usersApi.updateProfile(session.token, { primaryIntent });
      setProfile(nextProfile);
      await refreshSessionProfile();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to update account intent.");
    } finally {
      setIsUpdatingIntent(false);
    }
  };

  if (!session) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
        Log in to view your account.
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-sm text-slate-400">Loading your account...</div>;
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-100">
        {loadError}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <Card className="border-white/10 bg-white/5 text-white shadow-none">
        {profile?.headerImageUrl ? (
          <div className="h-40 overflow-hidden rounded-t-xl border-b border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.headerImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <CardHeader>
          <div className="flex items-center gap-4">
            {profile?.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profileImageUrl}
                alt=""
                className="size-16 rounded-full object-cover ring-2 ring-emerald-300/40"
              />
            ) : (
              <div className="size-16 rounded-full bg-gradient-to-br from-emerald-300/40 to-slate-950 ring-1 ring-white/10" />
            )}
            <CardTitle className="text-2xl">Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Name</p>
            <p className="text-base text-white">
              {profile?.displayName ?? session.displayName}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Account</p>
            <p className="text-base text-white">
              {formatIntent(profile?.primaryIntent ?? session.primaryIntent)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Artist access</p>
            <p className="text-base text-white">
              {profile?.artistAccess || session.artistAccess
                ? "Onboarding fee paid"
                : "Not unlocked"}
            </p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Email</p>
            <p className="text-base text-white">
              {profile?.email || session.email || "Not added"}
            </p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Wallet</p>
            <p className="text-base text-white" title={session.walletAddress}>
              {compactWalletAddress(session.walletAddress)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Location</p>
            <p className="text-base text-white">{profile?.location || "Not added"}</p>
          </div>
        </CardContent>
        </Card>

        {onboardingState ? (
          <Card className="border-white/10 bg-white/5 text-white shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">Profile completion</CardTitle>
                  <p className="mt-1 text-sm text-slate-400">
                    Optional details you can add whenever you are ready.
                  </p>
                </div>
                <span className="text-2xl font-semibold text-emerald-300">
                  {onboardingState.profileCompletion.percentage}%
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${onboardingState.profileCompletion.percentage}%` }}
                />
              </div>
              {onboardingState.profileCompletion.missing.length > 0 ? (
                <p className="text-sm text-slate-300">
                  Still available: {onboardingState.profileCompletion.missing.slice(0, 4).map((item) => item.replaceAll("_", " ")).join(", ")}.
                </p>
              ) : (
                <p className="text-sm text-emerald-200">Your profile has all available details.</p>
              )}
              <Button
                asChild
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/onboarding">Review profile details</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {profile ? (
          <Card className="border-white/10 bg-white/5 text-white shadow-none">
            <CardHeader>
              <CardTitle className="text-2xl">How you use Music City</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-400">
                Change your starting point any time. Artist tools remain separately access-controlled.
              </p>
              <div className="grid gap-2">
                {(
                  [
                    ["listener", "I’m here to listen"],
                    ["artist", "I release music"],
                    ["both", "Both"],
                  ] as const
                ).map(([intent, label]) => (
                  <Button
                    key={intent}
                    type="button"
                    variant={profile.primaryIntent === intent ? "default" : "outline"}
                    className={profile.primaryIntent === intent
                      ? "justify-start bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                      : "justify-start border-white/10 bg-white/5 text-white hover:bg-white/10"}
                    onClick={() => void updateIntent(intent)}
                    disabled={isUpdatingIntent}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        {clientEnv.isDynamicConfigured ? <WalletOverviewCard /> : null}

        <Card className="border-white/10 bg-white/5 text-white shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-2xl">Activity</CardTitle>
              <Button
                asChild
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/account/playlists">Manage playlists</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Tracks
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {tracks.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Published
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {tracks.filter((track) => track.status === "published").length}
              </p>
            </div>
          </CardContent>
        </Card>

        {profile?.primaryIntent === "artist" || profile?.primaryIntent === "both" ? (
          <Card className="border-white/10 bg-white/5 text-white shadow-none">
            <CardHeader>
                  <CardTitle className="text-2xl">Music City Pass</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Model
                  </p>
                  <p className="mt-2 text-base font-medium text-white">
                    Music City Pass
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Published tracks
                  </p>
                  <p className="mt-2 text-base font-medium text-white">
                    {tracks.filter((track) => track.visibility === "published").length}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Member benefit
                  </p>
                  <p className="mt-2 text-base font-medium text-white">
                    Ad-free listening
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-white/10 bg-white/5 text-white shadow-none">
          <CardHeader>
            <CardTitle className="text-2xl">Recent track activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tracks.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
                Your recent activity will appear here after you create a track.
              </div>
            ) : (
              tracks.slice(0, 5).map((track) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                >
                  <div className="space-y-1">
                    <p className="text-base font-medium text-white">{track.title}</p>
                    <p className="text-sm text-slate-400">{track.genre}</p>
                  </div>
                  <p className="text-sm text-emerald-300">{activityLabel(track)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 text-white shadow-none">
          <CardHeader>
            <CardTitle className="text-2xl">Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
                No payments yet.
              </div>
            ) : (
              payments.slice(0, 6).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                >
                  <div className="space-y-1">
                    <p className="text-base font-medium text-white">
                      {payment.productType === "track_purchase"
                        ? "Track purchase"
                        : payment.productType === "platform_subscription"
                          ? "Music City Pass"
                          : "Artist onboarding fee"}
                    </p>
                    <p className="text-sm text-slate-400">
                      {payment.amount} {payment.assetCode}
                    </p>
                  </div>
                  <p className="text-sm text-emerald-300">
                    {payment.waived || payment.amount === "0" ? "Waived" : "Confirmed"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 text-white shadow-none">
          <CardHeader>
            <CardTitle className="text-2xl">Subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscriptions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
                No active subscriptions yet.
              </div>
            ) : (
              subscriptions.slice(0, 6).map((subscription) => (
                <div
                  key={subscription.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                >
                  <div className="space-y-1">
                    <p className="text-base font-medium text-white">Music City Pass</p>
                    <p className="text-sm text-slate-400">
                      Ends {new Date(subscription.endsAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm text-emerald-300">{subscription.status}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};
