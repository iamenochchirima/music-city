"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
import { useAuth } from "@/hooks/use-auth";

export const DashboardOverview = () => {
  const { session } = useAuth();

  if (!session) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
        Connect your wallet before using the studio.
      </div>
    );
  }

  if (session.onboardingStatus !== "complete") {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
        Complete onboarding before creating tracks.
      </div>
    );
  }

  if (session.primaryIntent !== "artist" && session.primaryIntent !== "both") {
    return <ArtistAccessGate action="use the studio" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">
            Studio
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Your workspace
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Create, manage, and measure your music.
          </p>
        </div>
        <Button asChild className="bg-emerald-400 text-slate-950 hover:bg-emerald-300">
          <Link href="/dashboard/create">New track</Link>
        </Button>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          Studio tools
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["Tracks", "Catalog", "/dashboard/tracks"],
            ["Releases", "Discography", "/dashboard/releases"],
            ["Analytics", "Audience", "/dashboard/analytics"],
            ["Revenue", "Payments", "/dashboard/revenue"],
            ["Account", "Artist profile", "/account"],
          ].map(([label, detail, href]) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 transition hover:border-emerald-400/30 hover:bg-white/[0.05]"
            >
              <span className="font-medium text-white">{label}</span>
              <span className="text-sm text-slate-500">{detail} →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
