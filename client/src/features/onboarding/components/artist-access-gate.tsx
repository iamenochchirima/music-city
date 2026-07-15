"use client";

import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

type ArtistAccessGateProps = {
  action: string;
};

export const ArtistAccessGate = ({ action }: ArtistAccessGateProps) => {
  const router = useRouter();
  const { session } = useAuth();
  const hasArtistProfile = session?.role === "artist";

  const handleContinue = () => {
    if (!session?.token) {
      router.push("/auth");
      return;
    }

    if (hasArtistProfile) {
      router.push("/dashboard");
      return;
    }

    router.push("/onboarding");
  };

  return (
    <section className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/[0.07] p-6 sm:p-8">
        <span className="flex size-11 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-medium uppercase tracking-[0.28em] text-emerald-400">
          Artist access
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          {!session
            ? "Log in to unlock your artist studio"
            : hasArtistProfile
              ? "Your artist studio is ready"
              : "Finish setting up your artist profile"}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
          {!session
            ? `Log in with your wallet to set up an artist profile and ${action}.`
            : hasArtistProfile
              ? `Continue to the studio to ${action}.`
              : `Complete your artist profile before you ${action}.`}
        </p>
        <Button
          type="button"
          className="mt-6 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          onClick={handleContinue}
        >
          {!session
            ? "Log in to continue"
            : hasArtistProfile
              ? "Open artist studio"
              : "Finish artist setup"}
        </Button>
      </section>
  );
};
