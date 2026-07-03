"use client";

import { useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { TrackCreateForm } from "./track-create-form";

export const DashboardCreateOverview = () => {
  const { session } = useAuth();
  const [createdCount, setCreatedCount] = useState(0);

  if (!session) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Connect your wallet before creating music.
      </div>
    );
  }

  if (!session.profileComplete) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Complete onboarding before uploading your first track.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-7">
        <p className="text-sm uppercase tracking-[0.28em] text-emerald-400">
          Create
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          Start a new upload
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
          Move from draft to released music in one place. Add track details, credits,
          release placement, cover art, and audio without leaving the studio.
        </p>
        {createdCount > 0 ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            {createdCount} upload{createdCount === 1 ? "" : "s"} completed in this
            session.
          </div>
        ) : null}
      </div>

      <TrackCreateForm onCreated={() => setCreatedCount((current) => current + 1)} />
    </div>
  );
};
