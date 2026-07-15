"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ArtistAnalyticsSummary } from "@music-city/shared";
import { BarChart3, Heart, Music2, Radio, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { engagementApi } from "@/features/engagement/lib/engagement-api";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
import { useAuth } from "@/hooks/use-auth";

const WINDOW_OPTIONS = [
  { label: "7D", value: 7 as const },
  { label: "30D", value: 30 as const },
  { label: "90D", value: 90 as const },
  { label: "Lifetime", value: "lifetime" as const },
];

const StatCard = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) => (
  <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <div className="text-emerald-300">{icon}</div>
    </div>
    <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
  </div>
);

export const ArtistAnalyticsOverview = () => {
  const { session } = useAuth();
  const [analytics, setAnalytics] = useState<ArtistAnalyticsSummary | null>(null);
  const [windowDays, setWindowDays] = useState<7 | 30 | 90 | "lifetime">(30);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAnalytics = async (refreshOnly = false) => {
    if (!session?.token) {
      setAnalytics(null);
      setIsLoading(false);
      return;
    }

    if (refreshOnly) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      setAnalytics(
        await engagementApi.getMyArtistAnalytics(
          session.token,
          windowDays === "lifetime" ? undefined : windowDays,
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load analytics",
      );
    } finally {
      if (refreshOnly) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, [session?.token, windowDays]);

  if (!session) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Log in to view artist analytics.
      </div>
    );
  }

  if (session.role !== "artist") {
    return <ArtistAccessGate action="view artist analytics" />;
  }

  if (isLoading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Loading analytics...
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-slate-300">
        Analytics are not available yet.
      </div>
    );
  }

  const maxStreams = Math.max(
    1,
    ...analytics.dailyStreams.map((item) => item.streams),
  );
  const maxFollowers = Math.max(
    1,
    ...analytics.dailyFollowers.map((item) => item.followers),
  );
  const selectedWindowLabel = analytics.selectedWindowDays
    ? `Last ${analytics.selectedWindowDays} days`
    : "Lifetime";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Artist analytics
          </p>
          <h2 className="text-3xl font-semibold text-white">Audience and stream health</h2>
          <p className="max-w-2xl text-sm leading-7 text-slate-300">
            Track how your songs are performing across streams, listeners, likes,
            and follows.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          disabled={isRefreshing}
          onClick={() => void loadAnalytics(true)}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total streams"
          value={analytics.totalStreams.toLocaleString()}
          icon={<Radio className="h-5 w-5" />}
        />
        <StatCard
          label="Unique listeners"
          value={analytics.uniqueListeners.toLocaleString()}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Track likes"
          value={analytics.totalLikes.toLocaleString()}
          icon={<Heart className="h-5 w-5" />}
        />
        <StatCard
          label="Track saves"
          value={analytics.totalSaves.toLocaleString()}
          icon={<Music2 className="h-5 w-5" />}
        />
        <StatCard
          label="Followers"
          value={analytics.followerCount.toLocaleString()}
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
                {selectedWindowLabel}
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                Stream trend
              </h3>
            </div>
            <div className="text-right text-sm text-slate-400">
              <p>
                {analytics.selectedWindowStreams.toLocaleString()} streams in window
              </p>
              <p>
                {analytics.selectedWindowUniqueListeners.toLocaleString()} listeners in
                window
              </p>
              <p>
                {analytics.followersGainedInSelectedWindow.toLocaleString()} followers
                gained
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {WINDOW_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={windowDays === option.value ? "default" : "outline"}
                className={
                  windowDays === option.value
                    ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                }
                onClick={() => setWindowDays(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="mt-8 flex items-end gap-2 overflow-x-auto pb-2">
            {analytics.dailyStreams.length === 0 ? (
              <div className="text-sm text-slate-400">
                No qualified streams yet.
              </div>
            ) : (
              analytics.dailyStreams.map((point) => (
                <div key={point.date} className="flex min-w-10 flex-col items-center gap-2">
                  <div
                    className="w-8 rounded-t-full bg-emerald-400/80"
                    style={{
                      height: `${Math.max(12, (point.streams / maxStreams) * 180)}px`,
                    }}
                  />
                  <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
                    {point.date.slice(5)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
            Catalog health
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Quick view</h3>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <span className="text-slate-300">Tracks in catalog</span>
              <span className="font-semibold text-white">{analytics.totalTracks}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <span className="text-slate-300">Published or playable</span>
              <span className="font-semibold text-white">
                {analytics.publishedTracks}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <span className="text-slate-300">Average likes per track</span>
              <span className="font-semibold text-white">
                {analytics.totalTracks > 0
                  ? (analytics.totalLikes / analytics.totalTracks).toFixed(1)
                  : "0.0"}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
            Follower growth
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Audience momentum</h3>

          <div className="mt-8 flex items-end gap-2 overflow-x-auto pb-2">
            {analytics.dailyFollowers.length === 0 ? (
              <div className="text-sm text-slate-400">
                No follower growth recorded yet.
              </div>
            ) : (
              analytics.dailyFollowers.map((point) => (
                <div key={point.date} className="flex min-w-12 flex-col items-center gap-2">
                  <div
                    className="w-8 rounded-t-full bg-sky-400/80"
                    style={{
                      height: `${Math.max(12, (point.followers / maxFollowers) * 180)}px`,
                    }}
                  />
                  <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
                    {point.date.slice(5)}
                  </p>
                  <p className="text-[0.65rem] text-slate-400">
                    +{point.newFollowers}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
            Top releases
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            Best performing projects
          </h3>

          {analytics.topReleases.length === 0 ? (
            <div className="mt-6 text-sm text-slate-400">
              No release analytics yet.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {analytics.topReleases.map((release) => (
                <div
                  key={release.releaseId}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 md:grid-cols-[minmax(0,1.4fr)_100px_100px_100px]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{release.title}</p>
                    <p className="mt-1 truncate text-sm uppercase tracking-[0.18em] text-slate-500">
                      {release.type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Streams
                    </p>
                    <p className="mt-1 text-white">{release.streams.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Likes
                    </p>
                    <p className="mt-1 text-white">{release.likes.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Saves
                    </p>
                    <p className="mt-1 text-white">{release.saves.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center gap-3">
          <Music2 className="h-5 w-5 text-emerald-300" />
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
              Top tracks
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-white">
              Best performing songs
            </h3>
          </div>
        </div>

        {analytics.topTracks.length === 0 ? (
          <div className="mt-6 text-sm text-slate-400">
            No track analytics yet.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {analytics.topTracks.map((track) => (
              <div
                key={track.trackId}
                className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 md:grid-cols-[minmax(0,1.4fr)_100px_100px_130px_110px]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{track.title}</p>
                  <p className="mt-1 truncate text-sm text-slate-500">
                    {track.releaseTitle || "Standalone release"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Streams
                  </p>
                  <p className="mt-1 text-white">{track.plays.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Likes
                  </p>
                  <p className="mt-1 text-white">{track.likes.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Saves / listeners
                  </p>
                  <p className="mt-1 text-white">
                    {track.saves.toLocaleString()} /{" "}
                    {track.uniqueListeners.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Completion
                  </p>
                  <p className="mt-1 text-white">{track.completionRate.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
