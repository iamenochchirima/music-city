"use client";

import { NotificationSettings } from "@/features/notifications/notification-settings";

import Image from "next/image";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  ArtistActivationQuote,
  PaymentRecord,
  SubscriptionRecord,
  TrackSummary,
  UserProfile,
} from "@music-city/shared";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { paymentsApi } from "@/features/payments/lib/payments-api";
import { subscriptionsApi } from "@/features/subscriptions/lib/subscriptions-api";
import { usersApi } from "@/features/users/lib/users-api";
import { WalletOverviewCard } from "@/features/wallet/components/wallet-overview-card";
import { sponsorshipsApi } from "@/features/sponsorships/sponsorships-api";
import { ArtistActivationSummary } from "@/features/sponsorships/artist-activation-summary";

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
  const [activationQuote, setActivationQuote] = useState<ArtistActivationQuote | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingIntent, setIsUpdatingIntent] = useState(false);

  useEffect(() => {
    const token = session?.token;

    if (!token) {
      setProfile(null);
      setTracks([]);
      setActivationQuote(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [nextProfile, nextOnboardingState, nextTracks, nextPayments, nextSubscriptions, nextActivationQuote] = await Promise.all([
          usersApi.getMe(token),
          usersApi.getOnboardingState(token),
          tracksApi.listMyTracks(token),
          paymentsApi.listMine(token),
          subscriptionsApi.listMine(token),
          sponsorshipsApi.getMyArtistActivation(token),
        ]);

        if (!cancelled) {
          setProfile(nextProfile ?? null);
          setOnboardingState(nextOnboardingState);
          setTracks(Array.isArray(nextTracks) ? nextTracks : []);
          setPayments(Array.isArray(nextPayments) ? nextPayments : []);
          setSubscriptions(Array.isArray(nextSubscriptions) ? nextSubscriptions : []);
          setActivationQuote(nextActivationQuote);
        }
      } catch (error) {
        if (!cancelled) {
          setProfile(null);
          setOnboardingState(null);
          setTracks([]);
          setPayments([]);
          setSubscriptions([]);
          setActivationQuote(null);
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
      setActivationQuote(await sponsorshipsApi.getMyArtistActivation(session.token));
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

  const artistAccess = profile?.artistAccess || session.artistAccess;
  const disclosure = "border-t border-white/10 py-4";
  const summary = "w-fit cursor-pointer text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section aria-label="Profile" className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {profile?.profileImageUrl ? <Image src={profile.profileImageUrl} sizes="48px" maxWidth={144} alt="" className="size-12 rounded-full object-cover" /> : null}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">{profile?.displayName ?? session.displayName}</h2>
            <p className="break-words text-sm text-slate-400">{profile?.email || session.email || formatIntent(profile?.primaryIntent ?? session.primaryIntent)}</p>
          </div>
        </div>
        <Button asChild variant="outline"><Link href="/onboarding">Edit profile</Link></Button>
      </section>

      <WalletOverviewCard />

      <nav aria-label="Account links" className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        {[
          ["/dashboard/revenue", "Your earnings"],
          ["/account/agreements", "Royalty agreements"],
          ["/account/playlists", "My playlists"],
          ["/account/support", "Support history"],
          ["/account/referrals", "Invite artists"],
          ...(artistAccess ? [["/dashboard", "Artist studio"]] : []),
        ].map(([href,label])=><Link key={href} href={href!} className="w-fit rounded text-emerald-300 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">{label}</Link>)}
      </nav>

      <div>
        <details className={disclosure}>
          <summary className={summary}>Profile and preferences</summary>
          <div className="mt-4 space-y-5 text-sm">
            <dl className="grid grid-cols-2 gap-4 text-slate-400">
              <div><dt>Account type</dt><dd className="mt-1 text-white">{formatIntent(profile?.primaryIntent ?? session.primaryIntent)}</dd></div>
              <div><dt>Artist access</dt><dd className="mt-1 text-white">{artistAccess ? "Active" : "Not activated"}</dd></div>
              <div><dt>Location</dt><dd className="mt-1 text-white">{profile?.location || "Not added"}</dd></div>
              <div><dt>Wallet</dt><dd className="mt-1 text-white" title={session.walletAddress}>{compactWalletAddress(session.walletAddress)}</dd></div>
            </dl>
            {onboardingState && <div className="flex flex-wrap items-center justify-between gap-3 text-slate-400"><p>Profile {onboardingState.profileCompletion.percentage}% complete</p><Link href="/onboarding" className="text-emerald-300 hover:underline">Review profile details</Link></div>}
            {profile && <fieldset disabled={isUpdatingIntent} className="space-y-3">
              <legend className="mb-2 text-sm text-slate-400">How you use Music City</legend>
              <div className="flex flex-wrap gap-2">{([["listener","Listener"],["artist","Artist"],["both","Both"]] as const).map(([intent,label])=><Button key={intent} type="button" aria-pressed={profile.primaryIntent===intent} variant={profile.primaryIntent===intent ? "default" : "outline"} onClick={()=>void updateIntent(intent)}>{label}</Button>)}</div>
            </fieldset>}
            {profile && session.token && <NotificationSettings key={profile.id} profile={profile} token={session.token} onSaved={next=>{setProfile(next);void refreshSessionProfile();}} />}
          </div>
        </details>

        {activationQuote && (activationQuote.status!=="payment_required" || profile?.primaryIntent==="artist" || profile?.primaryIntent==="both") && <details className={disclosure}><summary className={summary}>Artist activation</summary><div className="mt-4"><ArtistActivationSummary quote={activationQuote} /></div></details>}

        <details className={disclosure}>
          <summary className={summary}>Payments and subscriptions</summary>
          <div className="mt-4 space-y-5 text-sm">
            <section aria-label="Payments"><h3 className="font-medium text-white">Payments</h3>{payments.length ? <ul className="mt-2 divide-y divide-white/10">{payments.slice(0,6).map(payment=><li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-white">{payment.productType==="track_purchase" ? "Track purchase" : payment.productType==="platform_subscription" ? "Subscription" : "Artist activation"}</p><p className="mt-1 text-slate-400">{payment.amount} {payment.assetCode}</p></div><span className="text-slate-400">{payment.waived || payment.amount==="0" ? "Waived" : "Confirmed"}</span></li>)}</ul> : <p className="mt-2 text-slate-400">No payments yet.</p>}</section>
            <section aria-label="Subscriptions"><h3 className="font-medium text-white">Subscriptions</h3>{subscriptions.length ? <ul className="mt-2 divide-y divide-white/10">{subscriptions.slice(0,6).map(subscription=><li key={subscription.id} className="flex flex-wrap justify-between gap-3 py-3"><p className="text-slate-400">Ends {new Date(subscription.endsAt).toLocaleDateString()}</p><span className="text-white">{subscription.status}</span></li>)}</ul> : <p className="mt-2 text-slate-400">No subscriptions yet.</p>}</section>
          </div>
        </details>

        {tracks.length>0 && <details className={disclosure}><summary className={summary}>Track activity · {tracks.length}</summary><ul className="mt-3 divide-y divide-white/10 text-sm">{tracks.slice(0,5).map(track=><li key={track.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><p className="min-w-0 break-words text-white">{track.title}</p><span className="text-slate-400">{activityLabel(track)}</span></li>)}</ul></details>}
      </div>
    </div>
  );
};
