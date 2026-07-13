import LandingPage from "@/app/page";
import { PageContainer } from "@/components/common/page-container";
import { PageHero } from "@/components/common/page-hero";
import { AccountOverview } from "@/features/account/components/account-overview";
import { AccountPlaylistsOverview } from "@/features/account/components/account-playlists-overview";
import { PlaylistManageOverview } from "@/features/account/components/playlist-manage-overview";
import { ArtistsOverview } from "@/features/artists/components/artists-overview";
import { ArtistDetailOverview } from "@/features/artists/components/artist-detail-overview";
import { AuthPanel } from "@/features/auth/components/auth-panel";
import { BecomeArtistOverview } from "@/features/become-artist/components/become-artist-overview";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { DashboardCreateOverview } from "@/features/dashboard/components/dashboard-create-overview";
import { DashboardTracksOverview } from "@/features/dashboard/components/dashboard-tracks-overview";
import { ArtistAnalyticsOverview } from "@/features/dashboard/components/artist-analytics-overview";
import { DashboardReleasesOverview } from "@/features/dashboard/components/dashboard-releases-overview";
import { DashboardRevenueOverview } from "@/features/dashboard/components/dashboard-revenue-overview";
import { ReleaseManageOverview } from "@/features/dashboard/components/release-manage-overview";
import { StudioShell } from "@/features/dashboard/components/studio-shell";
import { TrackManageOverview } from "@/features/dashboard/components/track-manage-overview";
import { DiscoverOverview } from "@/features/discover/components/discover-overview";
import { MarketplaceOverview } from "@/features/marketplace/components/marketplace-overview";
import { PlaylistDetailOverview } from "@/features/music/components/playlist-detail-overview";
import { PlaylistsOverview } from "@/features/music/components/playlists-overview";
import { ReleaseDetailOverview } from "@/features/music/components/release-detail-overview";
import { ReleasesOverview } from "@/features/music/components/releases-overview";
import { TrackDetailOverview } from "@/features/music/components/track-detail-overview";
import { TrackGrid } from "@/features/music/components/track-grid";
import { tracksApi } from "@/features/music/lib/tracks-api";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";
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

const StudioSection = ({
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
  <StudioShell eyebrow={eyebrow} title={title} description={description}>
    {children}
  </StudioShell>
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
    <StudioSection
      eyebrow="Track"
      title="Manage release access"
      description="Control whether this song stays private, becomes subscriber-only, or goes fully public."
    >
      <TrackManageOverview trackId={trackId} />
    </StudioSection>
  );
};

const DashboardReleasesPage = () => (
  <StudioSection
    eyebrow="Studio"
    title="Release management"
    description="Create, organize, and publish singles, EPs, and albums."
  >
    <DashboardReleasesOverview />
  </StudioSection>
);

const DashboardReleasePage = () => {
  const { releaseId = "" } = useParams();

  return (
    <StudioSection
      eyebrow="Release"
      title="Manage release"
      description="Control metadata, track order, and publish state for this release."
    >
      <ReleaseManageOverview releaseId={releaseId} />
    </StudioSection>
  );
};

const DashboardAnalyticsPage = () => (
  <StudioSection
    eyebrow="Studio"
    title="Artist analytics"
    description="Track your streams, followers, listeners, and top performing songs."
  >
    <ArtistAnalyticsOverview />
  </StudioSection>
);

const DashboardCreatePage = () => (
  <StudioSection
    eyebrow="Studio"
    title="Create music"
    description="Upload a new track, assign it to a release, and prepare it for publishing."
  >
    <DashboardCreateOverview />
  </StudioSection>
);

const DashboardTracksPage = () => (
  <StudioSection
    eyebrow="Studio"
    title="Track catalog"
    description="Manage playback readiness, access rules, and day-to-day catalog operations."
  >
    <DashboardTracksOverview />
  </StudioSection>
);

const DashboardRevenuePage = () => (
  <StudioSection
    eyebrow="Studio"
    title="Revenue"
    description="Review purchases, subscription unlocks, and the current monetization mix across your catalog."
  >
    <DashboardRevenueOverview />
  </StudioSection>
);

const ReleasePage = () => {
  const { releaseId = "" } = useParams();

  return (
    <PageSection
      eyebrow="Release"
      title="Release details"
      description="Explore the full tracklist and play music from this release."
    >
      <ReleaseDetailOverview releaseId={releaseId} />
    </PageSection>
  );
};

const ArtistPage = () => {
  const { artistId = "" } = useParams();

  return (
    <PageSection
      eyebrow="Artist"
      title="Artist profile"
      description="Browse releases, singles, and tracks from this artist."
    >
      <ArtistDetailOverview artistId={artistId} />
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

const PublicPlaylistPage = () => {
  const { playlistId = "" } = useParams();

  return (
    <PageSection
      eyebrow="Playlists"
      title="Playlist details"
      description="Listen through a saved sequence of tracks."
    >
      <PlaylistDetailOverview playlistId={playlistId} />
    </PageSection>
  );
};

const AccountPlaylistsPage = () => (
  <PageSection
    eyebrow="Account"
    title="Your playlists"
    description="Create and manage your personal listening collections."
  >
    <AccountPlaylistsOverview />
  </PageSection>
);

const AccountPlaylistManagePage = () => {
  const { playlistId = "" } = useParams();

  return (
    <PageSection
      eyebrow="Account"
      title="Manage playlist"
      description="Edit metadata and organize the tracks inside this playlist."
    >
      <PlaylistManageOverview playlistId={playlistId} />
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
    <Route path="/account/playlists" element={<AccountPlaylistsPage />} />
    <Route
      path="/account/playlists/:playlistId"
      element={<AccountPlaylistManagePage />}
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
    <Route path="/artists/:artistId" element={<ArtistPage />} />
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
          <div className="space-y-8">
            <BecomeArtistOverview />
            <ArtistAccessGate action="upload and release music" />
          </div>
        </PageSection>
      }
    />
    <Route
      path="/dashboard"
      element={
        <StudioSection
          eyebrow="Studio"
          title="Your music studio"
          description="Create music, manage your catalog, and monitor performance from one workspace."
        >
          <DashboardOverview />
        </StudioSection>
      }
    />
    <Route path="/dashboard/create" element={<DashboardCreatePage />} />
    <Route path="/dashboard/analytics" element={<DashboardAnalyticsPage />} />
    <Route path="/dashboard/tracks" element={<DashboardTracksPage />} />
    <Route path="/dashboard/releases" element={<DashboardReleasesPage />} />
    <Route path="/dashboard/revenue" element={<DashboardRevenuePage />} />
    <Route
      path="/dashboard/releases/:releaseId"
      element={<DashboardReleasePage />}
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
      path="/releases"
      element={
        <PageSection
          eyebrow="Releases"
          title="Explore releases"
          description="Browse albums, EPs, and singles across Music City."
        >
          <ReleasesOverview />
        </PageSection>
      }
    />
    <Route path="/releases/:releaseId" element={<ReleasePage />} />
    <Route
      path="/playlists"
      element={
        <PageSection
          eyebrow="Playlists"
          title="Explore playlists"
          description="Browse listening paths built by the Music City community."
        >
          <PlaylistsOverview />
        </PageSection>
      }
    />
    <Route path="/playlists/:playlistId" element={<PublicPlaylistPage />} />
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
