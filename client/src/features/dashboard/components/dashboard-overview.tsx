"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReleaseSummary, TrackSummary } from "@music-city/shared";
import {
  AlertCircle,
  AudioLines,
  CheckCircle2,
  Disc3,
  ListMusic,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { releasesApi } from "@/features/music/lib/releases-api";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
import { useAuth } from "@/hooks/use-auth";

type StudioSnapshot = {
  tracks: TrackSummary[];
  releases: ReleaseSummary[];
};

export const DashboardOverview = () => {
  const { session } = useAuth();
  const [snapshot, setSnapshot] = useState<StudioSnapshot>({ tracks: [], releases: [] });
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      if (
        !session?.token ||
        session.onboardingStatus !== "complete" ||
        (session.primaryIntent !== "artist" && session.primaryIntent !== "both")
      ) {
        setIsLoadingSnapshot(false);
        return;
      }

      try {
        const [tracks, releases] = await Promise.all([
          tracksApi.listMyTracks(session.token),
          releasesApi.listMyReleases(session.token),
        ]);

        if (!cancelled) {
          setSnapshot({ tracks, releases });
        }
      } catch {
        // The overview remains useful if a secondary snapshot request fails.
      } finally {
        if (!cancelled) {
          setIsLoadingSnapshot(false);
        }
      }
    };

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, [session?.onboardingStatus, session?.primaryIntent, session?.token]);

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

  const liveReleases = snapshot.releases.filter((release) => release.status === "published").length;
  const draftReleases = snapshot.releases.filter((release) => release.status === "draft");
  const processingTracks = snapshot.tracks.filter((track) => !track.playbackReady);
  const totalPlays = snapshot.tracks.reduce((total, track) => total + track.plays, 0);
  const actions: Array<{
    label: string;
    detail: string;
    href: string;
    icon: typeof AlertCircle;
    tone: string;
  }> = [];

  if (session.profileCompletion && !session.profileCompletion.requiredComplete) {
    actions.push({
      label: "Finish your artist profile",
      detail: "Complete the required details before publishing.",
      href: "/account",
      icon: UserRound,
      tone: "text-amber-200",
    });
  }

  if (processingTracks.length > 0) {
    actions.push({
      label: "Audio still processing",
      detail: `${processingTracks.length} track${processingTracks.length === 1 ? "" : "s"} waiting for playback readiness.`,
      href: "/dashboard/tracks",
      icon: AudioLines,
      tone: "text-sky-200",
    });
  }

  if (draftReleases.length > 0) {
    actions.push({
      label: "Finish a release draft",
      detail: `${draftReleases.length} draft${draftReleases.length === 1 ? "" : "s"} still need artwork, tracks, or review.`,
      href: `/dashboard/releases/${draftReleases[0].id}`,
      icon: Disc3,
      tone: "text-amber-200",
    });
  }

  if (snapshot.tracks.length > 0 && liveReleases === 0) {
    actions.push({
      label: "Put your music in front of listeners",
      detail: "Create a release from your uploaded tracks.",
      href: "/dashboard/releases",
      icon: ListMusic,
      tone: "text-emerald-200",
    });
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

      <section className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          Workspace snapshot
        </p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Tracks", value: snapshot.tracks.length, icon: AudioLines },
            { label: "Live releases", value: liveReleases, icon: Disc3 },
            { label: "Total plays", value: totalPlays.toLocaleString(), icon: ListMusic },
            { label: "Needs attention", value: actions.length, icon: AlertCircle },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
                  <Icon className="h-4 w-4 text-emerald-300/80" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {isLoadingSnapshot ? "—" : stat.value}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Next actions</p>
            <h3 className="mt-1 text-lg font-semibold text-white">
              {actions.length > 0 ? "Keep your workspace moving" : "You’re all caught up"}
            </h3>
          </div>
          {actions.length === 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : null}
        </div>

        {actions.length > 0 ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {actions.map((action) => {
              const Icon = action.icon;

              return (
                <Link key={action.href} href={action.href} className="flex items-start gap-3 rounded-lg border border-white/10 bg-slate-950/35 px-3 py-3 transition hover:border-emerald-400/30 hover:bg-white/[0.04]">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${action.tone}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-white">{action.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{action.detail}</span>
                  </span>
                  <span className="ml-auto text-sm text-slate-500">→</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Your releases and tracks are in good shape. Start something new whenever you’re ready.</p>
        )}
      </section>
    </div>
  );
};
