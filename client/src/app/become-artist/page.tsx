import { PageContainer } from "@/components/common/page-container";
import { PageHero } from "@/components/common/page-hero";
import { BecomeArtistOverview } from "@/features/become-artist/components/become-artist-overview";
import { ArtistAccessGate } from "@/features/onboarding/components/artist-access-gate";

export default function BecomeArtistPage() {
  return (
    <section className="py-16 sm:py-24">
      <PageContainer>
        <div className="space-y-12">
          <PageHero
            eyebrow="Artist setup"
            title="Set up your artist account"
            description="Get ready to upload music, manage releases, and control access."
          />
          <BecomeArtistOverview />
          <ArtistAccessGate action="upload and release music" />
        </div>
      </PageContainer>
    </section>
  );
}
