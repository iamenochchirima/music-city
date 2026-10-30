import { PageContainer } from "@/components/common/page-container";
import { PageHero } from "@/components/common/page-hero";
import { MarketplaceOverview } from "@/features/marketplace/components/marketplace-overview";

export default function MarketplacePage() {
  return (
    <section className="py-16 sm:py-24">
      <PageContainer>
        <div className="space-y-12">
          <PageHero
            eyebrow="Subscription"
            title="Subscribe to Music City"
            description="Unlock subscriber-only releases across the platform."
          />
          <MarketplaceOverview />
        </div>
      </PageContainer>
    </section>
  );
}
