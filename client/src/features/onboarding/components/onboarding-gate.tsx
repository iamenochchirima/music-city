"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";
import { OnboardingForm } from "./onboarding-form";

export const OnboardingGate = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout, refreshSessionProfile } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [session?.walletAddress]);

  const shouldShow = useMemo(() => {
    if (!session || session.onboardingStatus === "complete") {
      return false;
    }

    return pathname !== "/onboarding" && !dismissed;
  }, [dismissed, pathname, session]);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-label="Music City onboarding"
      >
        <OnboardingForm
          mode="modal"
          onCompleted={(_, destination) => {
            void refreshSessionProfile().then(() => router.push(destination));
          }}
        />

        <div className="mt-5 flex justify-end gap-4">
          {session?.onboardingStep !== "identity" && session?.onboardingStep !== "intent" ? (
            <button
              type="button"
              className="text-xs text-slate-500 underline-offset-4 hover:text-white hover:underline"
              onClick={() => setDismissed(true)}
            >
              Continue later
            </button>
          ) : null}
          <button
            type="button"
            className="text-xs text-slate-500 underline-offset-4 hover:text-white hover:underline"
            onClick={() => void logout()}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};
