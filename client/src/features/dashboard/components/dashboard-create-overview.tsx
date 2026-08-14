"use client";

import { useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { TrackCreateForm } from "./track-create-form";

export const DashboardCreateOverview = () => {
  const { session } = useAuth();
  const [createdCount, setCreatedCount] = useState(0);

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
            Add the details, audio, and artwork for a track.
          </p>
        </div>
        {createdCount > 0 ? (
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
            {createdCount} upload{createdCount === 1 ? "" : "s"} completed in this
            session.
          </div>
        ) : null}
      </div>

      <TrackCreateForm onCreated={() => setCreatedCount((current) => current + 1)} />
    </div>
  );
};
