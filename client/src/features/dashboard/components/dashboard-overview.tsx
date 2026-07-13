"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
import { useAuth } from "@/hooks/use-auth";

export const DashboardOverview = () => {
  const { session } = useAuth();

  if (!session) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-sm text-slate-300">
        Connect your wallet before using the studio.
      </div>
    );
  }

  if (!session.profileComplete) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-sm text-slate-300">
        Complete onboarding before creating tracks.
      </div>
    );
  }

  if (session.role !== "artist" || !session.artistOnboardingFeePaid) {
    return <ArtistAccessGate action="use the studio" />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-7">
        <p className="text-sm uppercase tracking-[0.28em] text-emerald-400">
          Studio home
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          Everything you need to release and measure your music
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
          Use the studio to upload tracks, package releases, watch stream activity,
          and review revenue signals without hopping across separate pages.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Create</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Upload new music</h3>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            Open the guided upload flow for new tracks, metadata, cover art, and audio.
          </p>
          <Button
            asChild
            className="mt-5 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          >
            <Link href="/dashboard/create">Open create</Link>
          </Button>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Catalog</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Manage tracks</h3>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            Review playback status, change access, and keep your song catalog clean.
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-5 border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href="/dashboard/tracks">Open tracks</Link>
          </Button>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Performance</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Analytics and revenue</h3>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            Track audience growth, streams, purchases, and monetization setup.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              asChild
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <Link href="/dashboard/analytics">Analytics</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <Link href="/dashboard/revenue">Revenue</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Releases</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Build your discography</h3>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            Organize tracks into singles, EPs, and albums, then publish complete projects.
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-5 border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href="/dashboard/releases">Manage releases</Link>
          </Button>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Account</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Artist identity</h3>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            Keep your public profile, wallet setup, and listener-facing presence up to date.
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-5 border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href="/account">Open account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
