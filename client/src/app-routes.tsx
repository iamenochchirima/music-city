import LandingPage from "@/app/page";
import { PageContainer } from "@/components/common/page-container";
import { PageHero } from "@/components/common/page-hero";
import { AccountOverview } from "@/features/account/components/account-overview";
import { ArtistsOverview } from "@/features/artists/components/artists-overview";
import { AuthPanel } from "@/features/auth/components/auth-panel";
import { BecomeArtistOverview } from "@/features/become-artist/components/become-artist-overview";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { TrackManageOverview } from "@/features/dashboard/components/track-manage-overview";
import { DiscoverOverview } from "@/features/discover/components/discover-overview";
import { MarketplaceOverview } from "@/features/marketplace/components/marketplace-overview";
import { TrackDetailOverview } from "@/features/music/components/track-detail-overview";
import { TrackGrid } from "@/features/music/components/track-grid";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { OnboardingForm } from "@/features/onboarding/components/onboarding-form";
import { PlatformSubscriptionOverview } from "@/features/subscriptions/components/platform-subscription-overview";
import { useEffect, useState } from "react";
import { Routes, Route, useParams, useSearchParams } from "react-router-dom";
import type { TrackSummary } from "@music-city/shared";

const PageSection = ({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section className="py-16 sm:py-24">
    <PageContainer>
      <div className="space-y-12">
        <PageHero eyebrow={eyebrow} title={title} description={description} />
        {children}
      </div>
    </PageContainer>
  </section>
);

const StreamPage = () => {
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextTracks = await tracksApi.listTracks();

        if (!cancelled) {
          setTracks(nextTracks);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageSection
      eyebrow="Streaming"
      title="Listen now"
      description="Play tracks from the latest releases on Music City."
    >
      {isLoading ? (
        <div className="text-sm text-slate-400">Loading tracks...</div>
      ) : (
        <TrackGrid tracks={tracks} />
      )}
    </PageSection>
  );
};

const StreamTrackPage = () => {
  const { trackId = "" } = useParams();

  return (
    <PageSection
      eyebrow="Streaming"
      title="Track details"
      description="View release details and start playback from the catalog."
    >
      <TrackDetailOverview trackId={trackId} />
    </PageSection>
  );
};

const DashboardTrackPage = () => {
  const { trackId = "" } = useParams();

  return (
    <PageSection
      eyebrow="Track"
      title="Manage release access"
      description="Control whether this song stays private, becomes subscriber-only, or goes fully public."
    >
      <TrackManageOverview trackId={trackId} />
    </PageSection>
  );
};

const SubscribePage = () => {
  const [searchParams] = useSearchParams();
  const trackId = searchParams.get("trackId") ?? undefined;

  return (
    <PageSection
      eyebrow="Subscriptions"
      title="Subscribe"
      description="Unlock subscriber-only tracks with one Music City Pass."
    >
      <PlatformSubscriptionOverview trackId={trackId} />
    </PageSection>
  );
};

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route
      path="/account"
      element={
        <PageSection
          eyebrow="Account"
          title="Your account"
          description="View your profile, wallet, and recent activity."
        >
          <AccountOverview />
        </PageSection>
      }
    />
    <Route
      path="/artists"
      element={
        <PageSection
          eyebrow="Artists"
          title="Discover artists"
          description="Browse artist profiles and explore the music they release on Music City."
        >
          <ArtistsOverview />
        </PageSection>
      }
    />
    <Route path="/subscribe" element={<SubscribePage />} />
    <Route
      path="/auth"
      element={
        <section className="py-16 sm:py-24">
          <PageContainer>
            <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
              <PageHero
                eyebrow="Authentication"
                title="Log in to Music City"
                description="Use email or social login to access your account."
              />
              <AuthPanel />
            </div>
          </PageContainer>
        </section>
      }
    />
    <Route
      path="/become-artist"
      element={
        <PageSection
          eyebrow="Artist setup"
          title="Set up your artist account"
          description="Get ready to upload music, manage releases, and control access."
        >
          <BecomeArtistOverview />
        </PageSection>
      }
    />
    <Route
      path="/dashboard"
      element={
        <PageSection
          eyebrow="Dashboard"
          title="Your music"
          description="Create a track and upload your first release."
        >
          <DashboardOverview />
        </PageSection>
      }
    />
    <Route path="/dashboard/tracks/:trackId" element={<DashboardTrackPage />} />
    <Route
      path="/discover"
      element={
        <PageSection
          eyebrow="Discover"
          title="Discover music"
          description="Browse featured tracks and find something new to play."
        >
          <DiscoverOverview />
        </PageSection>
      }
    />
    <Route
      path="/marketplace"
      element={
        <PageSection
          eyebrow="Marketplace"
          title="Explore the marketplace"
          description="Browse releases, discover drops, and unlock access to music."
        >
          <MarketplaceOverview />
        </PageSection>
      }
    />
    <Route
      path="/onboarding"
      element={
        <PageSection
          eyebrow="Onboarding"
          title="Set up your profile"
          description="Choose how you want to appear on Music City so we can tailor your dashboard and public profile."
        >
          <OnboardingForm />
        </PageSection>
      }
    />
    <Route path="/stream" element={<StreamPage />} />
    <Route path="/stream/:trackId" element={<StreamTrackPage />} />
    <Route
      path="*"
      element={
        <section className="py-24">
          <PageContainer>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-300">
              Page not found.
            </div>
          </PageContainer>
        </section>
      }
    />
  </Routes>
);
