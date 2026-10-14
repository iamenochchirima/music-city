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
  const hasArtistIntent =
    session?.primaryIntent === "artist" || session?.primaryIntent === "both";
  const hasArtistAccess = Boolean(session?.artistAccess);

  const handleContinue = () => {
    if (!session?.token) {
      router.push("/auth");
      return;
    }

    if (hasArtistIntent) {
      router.push("/dashboard");
      return;
    }

    router.push("/onboarding");
  };

  return (
    <section className="rounded-lg border border-border bg-card p-6 sm:p-8">
      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <LockKeyhole className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-5 text-sm font-medium text-muted-foreground">
        Artist access
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-foreground">
        {!session
          ? "Log in to unlock your artist studio"
          : hasArtistIntent && hasArtistAccess
            ? "Your artist studio is ready"
            : hasArtistIntent
              ? "Unlock your artist studio"
              : "Choose your artist path"}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        {!session
          ? `Log in with your wallet to set up an artist profile and ${action}.`
          : hasArtistIntent && hasArtistAccess
            ? `Continue to the studio to ${action}.`
            : hasArtistIntent
              ? `Complete artist access before you ${action}.`
              : `Choose an artist path before you ${action}.`}
      </p>
      <Button type="button" className="mt-6" onClick={handleContinue}>
        {!session
          ? "Log in to continue"
          : hasArtistIntent && hasArtistAccess
            ? "Open artist studio"
            : hasArtistIntent
              ? "Open artist setup"
              : "Set up artist profile"}
      </Button>
    </section>
  );
};
