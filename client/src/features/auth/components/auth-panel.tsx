"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export const AuthPanel = () => {
  const router = useRouter();
  const {
    connectWallet,
    error,
    isLoading,
    session,
    walletSignInTimedOut,
  } = useAuth();

  useEffect(() => {
    if (!session || session.onboardingStatus !== "complete") {
      return;
    }

    router.push(session.primaryIntent === "artist" ? "/dashboard" : "/discover");
  }, [router, session?.onboardingStatus, session?.primaryIntent]);

  return (
    <Card className="border-white/10 bg-white/5 text-white shadow-none">
      <CardHeader className="space-y-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
          <Sparkles className="h-5 w-5" />
        </span>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm leading-7 text-slate-300">
          Connect Freighter and sign a short Stellar challenge to create your Music City profile. Sign-in does not submit a transaction or charge a fee.
        </p>

        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
          <div className="mb-2 flex items-center gap-2 text-emerald-300">
            <Shield className="h-4 w-4" />
            <span className="font-medium">Status</span>
          </div>
          {session ? (
            <p>Connected. Redirecting you now.</p>
          ) : (
            <p>Ready to connect a Stellar wallet.</p>
          )}
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <Button
          className="w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          onClick={() =>
            walletSignInTimedOut
              ? window.location.reload()
              : void connectWallet()
          }
          disabled={isLoading}
        >
          {walletSignInTimedOut
            ? "Reload to retry"
            : isLoading
              ? "Waiting for wallet..."
              : "Connect with Freighter"}
        </Button>
      </CardContent>
    </Card>
  );
};
