import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type {
  ArtistActivationQuote,
  SponsorshipAdminReport,
  SponsorshipCampaignUpdate,
  UserProfile,
} from "@music-city/shared";
import {
  artistActivationQuoteSchema,
  earlyUserSponsorshipTerms,
  sponsorshipAdminReportSchema,
  sponsorshipCampaignUpdateSchema,
} from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";
import { HttpError } from "../../utils/http-error.js";

type CampaignRow = {
  code: string;
  terms_revision: string;
  currency: string;
  original_amount_minor: number;
  discount_amount_minor: number;
  amount_due_minor: number;
  discount_percent: number;
  active: boolean;
};

type EligibilityRow = CampaignRow & {
  id: string;
  campaign_code: string;
  captured_at: Date | string;
};

const isArtistIntent = (intent: UserProfile["primaryIntent"]) =>
  intent === "artist" || intent === "both";

const iso = (value: Date | string | null | undefined) =>
  value == null ? null : new Date(value).toISOString();

export async function captureArtistSponsorshipEligibility(
  client: PoolClient,
  profile: UserProfile,
) {
  const campaign = (await client.query<CampaignRow>(
    "SELECT * FROM artist_sponsorship_campaigns WHERE code=$1 FOR SHARE",
    [earlyUserSponsorshipTerms.code],
  )).rows[0];
  if (!campaign?.active) return false;

  const id = randomUUID();
  const inserted = await client.query(
    `INSERT INTO artist_sponsorship_eligibilities
      (id,user_id,campaign_code,terms_revision,currency,original_amount_minor,discount_amount_minor,amount_due_minor,discount_percent)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id) DO NOTHING RETURNING id`,
    [id, profile.id, campaign.code, campaign.terms_revision, campaign.currency,
      campaign.original_amount_minor, campaign.discount_amount_minor,
      campaign.amount_due_minor, campaign.discount_percent],
  );
  if (inserted.rowCount) {
    await client.query(
      "INSERT INTO artist_sponsorship_events(campaign_code,user_id,action,actor) VALUES($1,$2,'eligibility_captured',$3)",
      [campaign.code, profile.id, `system:registration:${profile.id}`],
    );
    return true;
  }
  return false;
}

export async function redeemArtistSponsorship(
  client: PoolClient,
  profile: UserProfile,
) {
  if (profile.onboardingStatus !== "complete" || !isArtistIntent(profile.primaryIntent)) {
    return false;
  }
  const eligibility = (await client.query<EligibilityRow>(
    "SELECT * FROM artist_sponsorship_eligibilities WHERE user_id=$1 FOR UPDATE",
    [profile.id],
  )).rows[0];
  if (!eligibility) return false;

  const existing = await client.query(
    "SELECT id FROM artist_sponsorship_grants WHERE user_id=$1",
    [profile.id],
  );
  if (existing.rowCount) return false;

  const inserted = await client.query(
    `INSERT INTO artist_sponsorship_grants
      (id,eligibility_id,user_id,campaign_code,terms_revision,currency,original_amount_minor,discount_amount_minor,amount_due_minor,discount_percent)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(user_id) DO NOTHING RETURNING id`,
    [randomUUID(), eligibility.id, profile.id, eligibility.campaign_code,
      eligibility.terms_revision, eligibility.currency, eligibility.original_amount_minor,
      eligibility.discount_amount_minor, eligibility.amount_due_minor, eligibility.discount_percent],
  );
  if (!inserted.rowCount) return false;
  await client.query(
    "INSERT INTO artist_sponsorship_events(campaign_code,user_id,action,actor) VALUES($1,$2,'artist_activated',$3)",
    [eligibility.campaign_code, profile.id, `system:onboarding:${profile.id}`],
  );
  return true;
}

const normalPrice = () => ({
  currency: "USD" as const,
  originalAmountMinor: earlyUserSponsorshipTerms.originalAmountMinor,
});

export const sponsorshipsService = {
  async getMyActivation(walletAddress: string): Promise<ArtistActivationQuote> {
    const result = await databaseService.transaction(async (client) => {
      const row = (await client.query<{
        eligibility_id: string | null;
        eligibility_code: string | null;
        eligibility_revision: string | null;
        eligibility_currency: string | null;
        eligibility_original: number | null;
        eligibility_discount: number | null;
        eligibility_percent: number | null;
        eligibility_due: number | null;
        legacy_artist_access: string | null;
        grant_id: string | null;
        grant_code: string | null;
        grant_revision: string | null;
        grant_currency: string | null;
        grant_original: number | null;
        grant_discount: number | null;
        grant_percent: number | null;
        grant_due: number | null;
        activated_at: Date | string | null;
        payment_payload: { amount?: string; confirmedAt?: string; waived?: boolean } | null;
      }>(
        `SELECT e.id AS eligibility_id,e.campaign_code AS eligibility_code,e.terms_revision AS eligibility_revision,
          e.currency AS eligibility_currency,e.original_amount_minor AS eligibility_original,
          e.discount_amount_minor AS eligibility_discount,e.discount_percent AS eligibility_percent,e.amount_due_minor AS eligibility_due,
          g.id AS grant_id,g.campaign_code AS grant_code,g.terms_revision AS grant_revision,
          g.currency AS grant_currency,g.original_amount_minor AS grant_original,
          g.discount_amount_minor AS grant_discount,g.discount_percent AS grant_percent,g.amount_due_minor AS grant_due,g.activated_at,
          (SELECT p.payload FROM payments p WHERE p.wallet_address=u.wallet_address
            AND p.product_type='artist_onboarding_fee' AND p.payload->>'status'='confirmed'
            ORDER BY p.confirmed_at DESC,p.id DESC LIMIT 1) AS payment_payload,
          u.payload->>'artistAccess' AS legacy_artist_access
         FROM users u
         LEFT JOIN artist_sponsorship_eligibilities e ON e.user_id=u.id
         LEFT JOIN artist_sponsorship_grants g ON g.user_id=u.id
         WHERE u.wallet_address=$1`,
        [walletAddress],
      )).rows[0];

      if (row?.grant_id) {
        return {
          currency: "USD" as const,
          originalAmountMinor: Number(row.grant_original),
          discountAmountMinor: Number(row.grant_discount),
          discountPercent: Number(row.grant_percent),
          amountDueMinor: Number(row.grant_due),
          campaignCode: row.grant_code,
          termsRevision: row.grant_revision,
          status: "sponsored" as const,
          profileExists: true,
          artistAccess: true,
          activatedAt: iso(row.activated_at),
        };
      }

      const payment = row?.payment_payload;
      if (payment && Number(payment.amount ?? 0) > 0) {
        return {
          ...normalPrice(), discountAmountMinor: 0, discountPercent: 0, amountDueMinor: 0,
          campaignCode: null, termsRevision: null, status: "paid" as const,
          profileExists: true,
          artistAccess: true, activatedAt: payment.confirmedAt ?? null,
        };
      }
      if (payment) {
        return {
          ...normalPrice(), discountAmountMinor: 0, discountPercent: 0, amountDueMinor: 0,
          campaignCode: null, termsRevision: null, status: "legacy_free" as const,
          profileExists: true,
          artistAccess: true, activatedAt: payment.confirmedAt ?? null,
        };
      }
      // Older onboarding persisted free access directly on the profile as well as
      // creating a waived payment row. Preserve access for historical profiles
      // that have the persisted grant but no corresponding payment record.
      if (row?.legacy_artist_access === "true") {
        return {
          ...normalPrice(), discountAmountMinor: 0, discountPercent: 0, amountDueMinor: 0,
          campaignCode: null, termsRevision: null, status: "legacy_free" as const,
          profileExists: true, artistAccess: true, activatedAt: null,
        };
      }
      if (row?.eligibility_id) {
        return {
          currency: "USD" as const,
          originalAmountMinor: Number(row.eligibility_original),
          discountAmountMinor: Number(row.eligibility_discount),
          discountPercent: Number(row.eligibility_percent),
          amountDueMinor: Number(row.eligibility_due),
          campaignCode: row.eligibility_code,
          termsRevision: row.eligibility_revision,
          status: "eligible" as const,
          profileExists: true,
          artistAccess: false,
          activatedAt: null,
        };
      }
      return {
        ...normalPrice(), discountAmountMinor: 0, discountPercent: 0, amountDueMinor: earlyUserSponsorshipTerms.originalAmountMinor,
        campaignCode: null, termsRevision: null, status: "payment_required" as const,
        profileExists: Boolean(row), artistAccess: false, activatedAt: null,
      };
    });
    return artistActivationQuoteSchema.parse(result);
  },

  async getAdminReport(): Promise<SponsorshipAdminReport> {
    const report = await databaseService.transaction(async (client) => {
      const campaign = (await client.query<CampaignRow>(
        "SELECT * FROM artist_sponsorship_campaigns WHERE code=$1",
        [earlyUserSponsorshipTerms.code],
      )).rows[0];
      if (!campaign) throw new HttpError(503, "Early-user sponsorship campaign is missing");

      const counts = (await client.query<{ eligible: string; activated: string; waived: string }>(
        `SELECT COUNT(e.id)::text AS eligible,COUNT(g.id)::text AS activated,
          COALESCE(SUM(g.discount_amount_minor),0)::text AS waived
         FROM artist_sponsorship_eligibilities e
         LEFT JOIN artist_sponsorship_grants g ON g.eligibility_id=e.id
         WHERE e.campaign_code=$1`,
        [campaign.code],
      )).rows[0]!;
      const items = (await client.query<{
        id: string;
        wallet_address: string;
        display_name: string;
        captured_at: Date | string;
        activated_at: Date | string | null;
        inviter_name: string | null;
      }>(
        `SELECT e.user_id AS id,u.wallet_address,u.payload->>'displayName' AS display_name,e.captured_at,
          g.activated_at,i.payload->>'displayName' AS inviter_name
         FROM artist_sponsorship_eligibilities e
         JOIN users u ON u.id=e.user_id
         LEFT JOIN artist_sponsorship_grants g ON g.eligibility_id=e.id
         LEFT JOIN referrals r ON r.invitee_id=e.user_id
         LEFT JOIN users i ON i.id=r.inviter_id
         WHERE e.campaign_code=$1 ORDER BY e.captured_at DESC,e.user_id`,
        [campaign.code],
      )).rows;
      const events = (await client.query<{
        id: string;
        action: string;
        actor: string;
        reason: string | null;
        created_at: Date | string;
      }>(
        "SELECT id,action,actor,reason,created_at FROM artist_sponsorship_events WHERE campaign_code=$1 ORDER BY id DESC LIMIT 500",
        [campaign.code],
      )).rows;

      return {
        campaign: {
          code: campaign.code as typeof earlyUserSponsorshipTerms.code,
          termsRevision: campaign.terms_revision,
          currency: "USD" as const,
          originalAmountMinor: campaign.original_amount_minor,
          discountAmountMinor: campaign.discount_amount_minor,
          amountDueMinor: campaign.amount_due_minor,
          discountPercent: campaign.discount_percent,
          active: campaign.active,
          eligibleAccounts: Number(counts.eligible),
          activatedArtists: Number(counts.activated),
          pendingEligibility: Number(counts.eligible) - Number(counts.activated),
          totalFeesWaivedMinor: Number(counts.waived),
        },
        items: items.map((item) => ({
          id: item.id,
          walletAddress: item.wallet_address,
          displayName: item.display_name ?? "",
          capturedAt: new Date(item.captured_at).toISOString(),
          activatedAt: iso(item.activated_at),
          status: item.activated_at ? "sponsored" as const : "eligible" as const,
          inviterName: item.inviter_name,
        })),
        events: events.map((event) => ({
          id: Number(event.id), action: event.action, actor: event.actor,
          reason: event.reason, createdAt: new Date(event.created_at).toISOString(),
        })),
      };
    });
    return sponsorshipAdminReportSchema.parse(report);
  },

  async updateCampaign(actor: string, input: SponsorshipCampaignUpdate | unknown) {
    const parsed = sponsorshipCampaignUpdateSchema.parse(input);
    return databaseService.transaction(async (client) => {
      const campaign = (await client.query<CampaignRow>(
        "SELECT * FROM artist_sponsorship_campaigns WHERE code=$1 FOR UPDATE",
        [earlyUserSponsorshipTerms.code],
      )).rows[0];
      if (!campaign) throw new HttpError(503, "Early-user sponsorship campaign is missing");
      if (campaign.active === parsed.active) {
        throw new HttpError(409, `Early-user sponsorship is already ${parsed.active ? "active" : "paused"}`);
      }
      await client.query(
        "UPDATE artist_sponsorship_campaigns SET active=$2,updated_at=NOW() WHERE code=$1",
        [campaign.code, parsed.active],
      );
      await client.query(
        "INSERT INTO artist_sponsorship_events(campaign_code,action,actor,reason) VALUES($1,$2,$3,$4)",
        [campaign.code, parsed.active ? "campaign_resumed" : "campaign_paused", actor, parsed.reason],
      );
      return { active: parsed.active };
    });
  },

  async reconcile() {
    return databaseService.transaction(async (client) => {
      const profiles = (await client.query<{ payload: UserProfile }>(
        `SELECT u.payload FROM users u
         JOIN artist_sponsorship_eligibilities e ON e.user_id=u.id
         LEFT JOIN artist_sponsorship_grants g ON g.user_id=u.id
         WHERE g.id IS NULL AND u.onboarding_status='complete' AND u.primary_intent IN ('artist','both')
         ORDER BY e.captured_at,e.user_id FOR UPDATE OF e`,
      )).rows;
      let activated = 0;
      for (const row of profiles) {
        if (await redeemArtistSponsorship(client, row.payload)) activated += 1;
      }
      return { checked: profiles.length, activated };
    });
  },
};
