"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlatformSubscriptionPlan } from "@music-city/shared";
import { Ticket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { subscriptionsApi } from "@/features/subscriptions/lib/subscriptions-api";

export const MarketplaceOverview = () => {
  const [platformPlan, setPlatformPlan] = useState<PlatformSubscriptionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);

    try {
      const nextPlatformPlan = await subscriptionsApi.getPlatformPlan();
      setPlatformPlan(nextPlatformPlan);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load subscription",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (isLoading) {
    return <div className="text-sm text-slate-400">Loading marketplace...</div>;
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="platform-subscription-title" className="space-y-4">
        <div className="space-y-1">
          <h2 id="platform-subscription-title" className="text-2xl font-semibold text-white">Subscription</h2>
          <p className="text-sm text-slate-400">
            One subscription unlocks every subscriber-only release across the platform.
          </p>
        </div>
        <Card className="border-white/10 bg-white/5 text-white shadow-none">
          <CardHeader className="space-y-2">
            <p className="text-sm text-slate-300">
              {platformPlan?.description ??
                "One subscription unlocks every subscriber-only release across Music City."}
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-emerald-300">
              {platformPlan
                ? `${platformPlan.price} ${platformPlan.assetCode} every ${platformPlan.periodDays} days`
                : "Loading price..."}
            </div>
            <Button
              asChild
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            >
              <Link href="/subscribe">
                <Ticket className="mr-2 h-4 w-4" />
                View subscription
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
