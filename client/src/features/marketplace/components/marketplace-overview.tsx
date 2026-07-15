"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlatformSubscriptionPlan, TrackSummary } from "@music-city/shared";
import { Ticket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrackCommerceActions } from "@/features/music/components/track-commerce-actions";
import { TrackThumbnail } from "@/features/music/components/track-table";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { subscriptionsApi } from "@/features/subscriptions/lib/subscriptions-api";

export const MarketplaceOverview = () => {
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [platformPlan, setPlatformPlan] = useState<PlatformSubscriptionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);

    try {
      const [nextTracks, nextPlatformPlan] = await Promise.all([
        tracksApi.listTracks(),
        subscriptionsApi.getPlatformPlan(),
      ]);

      setTracks(nextTracks.filter((track) => track.purchaseEnabled));
      setPlatformPlan(nextPlatformPlan);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load marketplace",
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
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-white">Support artists</h2>
          <p className="text-sm text-slate-400">
            Optional one-time purchases that support artists. Playback is available to everyone.
          </p>
        </div>
        {tracks.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
            No track purchases are live yet.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {tracks.map((track) => (
              <Card
                key={track.id}
                className="border-white/10 bg-white/5 text-white shadow-none"
              >
                <CardContent className="flex gap-4 p-5">
                  <TrackThumbnail track={track} />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-1">
                      <Link
                        href={`/stream/${track.id}`}
                        className="block truncate text-lg font-semibold hover:text-emerald-300"
                      >
                        {track.title}
                      </Link>
                      <p className="truncate text-sm text-slate-400">{track.artistName}</p>
                    </div>
                    <p className="text-sm text-slate-300">{track.description || track.genre}</p>
                    <TrackCommerceActions track={track} onUnlocked={load} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-white">Music City Pass</h2>
          <p className="text-sm text-slate-400">
            One membership unlocks every subscriber-only release across the platform.
          </p>
        </div>
        <Card className="border-white/10 bg-white/5 text-white shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">
              {platformPlan?.name ?? "Music City Pass"}
            </CardTitle>
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
                View membership
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
