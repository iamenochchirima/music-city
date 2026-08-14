"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { TrackCreateForm } from "./track-create-form";

export const DashboardCreateOverview = () => {
  const { session } = useAuth();
  const [createdCount, setCreatedCount] = useState(0);
  const [createMode, setCreateMode] = useState<"choose" | "track">("choose");

  if (!session) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-slate-300">
        Connect your wallet before creating music.
      </div>
    );
  }

  if (session.onboardingStatus !== "complete") {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-slate-300">
        Complete onboarding before uploading your first track.
      </div>
    );
  }

  if (session.primaryIntent !== "artist" && session.primaryIntent !== "both") {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-slate-300">
        Create an artist profile before uploading music.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">
            Create
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            New upload
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Save a recording, then place it on a release when it is ready.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Tracks are recordings. Releases are what listeners see.
          </p>
        </div>
        {createdCount > 0 ? (
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
            {createdCount} upload{createdCount === 1 ? "" : "s"} completed in this
            session.
          </div>
        ) : null}
      </div>

      {createMode === "choose" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] p-5 text-left transition hover:border-emerald-300/60 hover:bg-emerald-400/10"
            onClick={() => setCreateMode("track")}
          >
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
              Recording
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">Upload a track</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Save one recording as a draft, then add it to a Single, EP, or album.
            </p>
            <span className="mt-4 inline-flex text-sm font-medium text-emerald-200">Start with audio →</span>
          </button>

          <Link
            href="/dashboard/releases"
            className="rounded-xl border border-white/10 bg-white/[0.025] p-5 text-left transition hover:border-white/20 hover:bg-white/[0.05]"
          >
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              Publishing
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">Create a release</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Build a Single, EP, or album with artwork, a release date, and a tracklist.
            </p>
            <span className="mt-4 inline-flex text-sm font-medium text-slate-200">Open release workspace →</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <Button type="button" variant="ghost" className="px-0 text-slate-400 hover:bg-transparent hover:text-white" onClick={() => setCreateMode("choose")}>
            ← Back to create options
          </Button>
          <TrackCreateForm
            onCreated={() => setCreatedCount((current) => current + 1)}
            onClose={() => setCreateMode("choose")}
          />
        </div>
      )}
    </div>
  );
};
