import { randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { PoolClient } from "pg";
import { registrationReferralCampaign, referralCaptureSchema, referralExclusionSchema, type PaymentRecord, type ReferralSummary, type UserProfile } from "@music-city/shared";
import { env } from "../../config/env.js";
import { databaseService } from "../../services/database.service.js";
import { HttpError } from "../../utils/http-error.js";

const CAMPAIGN = registrationReferralCampaign.version;
const receiptSchema = z.object({ inviterId: z.string(), campaign: z.literal(CAMPAIGN), iat: z.number(), exp: z.number() });

export function verifyReferralReceipt(receipt: string) {
  try {
    const data = receiptSchema.parse(jwt.verify(receipt, env.JWT_SECRET, { algorithms: ["HS256"], audience: "music-city-referral", issuer: "music-city" }));
    if (data.iat > Date.now() / 1000 || data.exp - data.iat !== registrationReferralCampaign.windowDays * 86400) throw new Error("Invalid window");
    return data;
  } catch { throw new HttpError(400, "Invitation is invalid or expired. Remove it to continue registration."); }
}

export async function bindReferral(client: PoolClient, profile: UserProfile, receipt?: string) {
  if (!receipt) return;
  const claim = verifyReferralReceipt(receipt);
  const inviter = await client.query("SELECT id,wallet_address,payload FROM users WHERE id=$1 FOR SHARE", [claim.inviterId]);
  if (inviter.rows[0]?.wallet_address === profile.walletAddress) throw new HttpError(400, "You cannot refer yourself. Remove the invitation to continue.");
  if (inviter.rows[0]?.payload.onboardingStatus !== "complete") throw new HttpError(400, "This inviter is no longer eligible. Remove the invitation to continue.");
  const id = randomUUID();
  await client.query("INSERT INTO referrals(id,inviter_id,invitee_id,campaign,captured_at) VALUES($1,$2,$3,$4,$5)", [id,claim.inviterId,profile.id,claim.campaign,new Date(claim.iat * 1000)]);
  await client.query("INSERT INTO referral_events(referral_id,action,actor) VALUES($1,'attributed',$2)", [id,profile.id]);
}

export async function qualifyReferral(client: PoolClient, profile: UserProfile) {
  if (profile.onboardingStatus !== "complete") return;
  const row = (await client.query("SELECT * FROM referrals WHERE invitee_id=$1 FOR UPDATE", [profile.id])).rows[0];
  if (!row || row.excluded_at) return;
  const artist = ["artist", "both"].includes(profile.primaryIntent);
  if (!row.completed_at || (artist && !row.artist_qualified_at)) {
    await client.query(`UPDATE referrals SET completed_at=COALESCE(completed_at,NOW()),
      artist_qualified_at=CASE WHEN $2 THEN COALESCE(artist_qualified_at,NOW()) ELSE artist_qualified_at END WHERE id=$1`, [row.id,artist]);
    for (const action of [!row.completed_at ? "registration_completed" : null, artist && !row.artist_qualified_at ? "artist_registration_completed" : null].filter(Boolean)) {
      await client.query("INSERT INTO referral_events(referral_id,action,actor) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [row.id,action,profile.id]);
    }
  }
}

export const referralsService = {
  async recordPaidActivation(payment: PaymentRecord) {
    if (payment.productType !== "artist_onboarding_fee" || payment.status !== "confirmed" || payment.waived || !(Number(payment.amount) > 0)) return;
    await databaseService.transaction(async client => {
      const row = (await client.query(`SELECT r.id FROM referrals r JOIN users u ON u.id=r.invitee_id
        WHERE u.wallet_address=$1 AND r.excluded_at IS NULL FOR UPDATE OF r`,[payment.walletAddress])).rows[0];
      if (!row) return;
      const inserted = await client.query(`INSERT INTO referral_paid_activations(referral_id,payment_id,amount,asset_code,asset_issuer,network_passphrase)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING referral_id`,[row.id,payment.id,payment.amount,payment.assetCode,payment.assetIssuer ?? null,payment.networkPassphrase ?? "unknown"]);
      if (inserted.rowCount) await client.query("INSERT INTO referral_events(referral_id,action,actor) VALUES($1,'paid_artist_activation','system:payment') ON CONFLICT DO NOTHING",[row.id]);
    });
  },
  async capture(input: unknown) {
    if (!env.REFERRALS_ENABLED) throw new HttpError(503, "Invitations are currently paused.");
    const { code } = referralCaptureSchema.parse(input);
    return databaseService.transaction(async client => {
      const row = (await client.query("SELECT u.id,u.wallet_address,u.payload FROM referral_codes c JOIN users u ON u.id=c.inviter_id JOIN referral_campaigns campaign ON campaign.version=$2 WHERE c.code=$1 AND campaign.active", [code,CAMPAIGN])).rows[0];
      if (!row || row.payload.onboardingStatus !== "complete") throw new HttpError(400, "Invitation code was not found.");
      const receipt = jwt.sign({ inviterId: row.id, campaign: CAMPAIGN }, env.JWT_SECRET, { algorithm: "HS256", expiresIn: "30d", audience: "music-city-referral", issuer: "music-city" });
      const claim = verifyReferralReceipt(receipt);
      return { receipt, inviterName: row.payload.displayName, campaign: CAMPAIGN, expiresAt: new Date(claim.exp * 1000).toISOString() };
    });
  },
  async mine(wallet: string): Promise<ReferralSummary> {
    return databaseService.transaction(async client => {
      const user = (await client.query("SELECT id,payload FROM users WHERE wallet_address=$1", [wallet])).rows[0];
      if (!user || user.payload.onboardingStatus !== "complete") throw new HttpError(403, "Complete your registration before inviting artists.");
      const campaign = (await client.query("SELECT active FROM referral_campaigns WHERE version=$1",[CAMPAIGN])).rows[0];
      const enabled = env.REFERRALS_ENABLED && Boolean(campaign?.active);
      let code = (await client.query("SELECT code FROM referral_codes WHERE inviter_id=$1", [user.id])).rows[0]?.code ?? null;
      if (!code && enabled) {
        for (let attempt = 0; attempt < 5 && !code; attempt++) {
          await client.query("INSERT INTO referral_codes(code,inviter_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [`MC${randomBytes(8).toString("hex").toUpperCase()}`, user.id]);
          code = (await client.query("SELECT code FROM referral_codes WHERE inviter_id=$1", [user.id])).rows[0]?.code ?? null;
        }
        if (!code) throw new HttpError(503, "Could not create an invitation. Try again.");
      }
      const rows = (await client.query("SELECT * FROM referrals WHERE inviter_id=$1 ORDER BY bound_at DESC", [user.id])).rows;
      const eligible = rows.filter(r => !r.excluded_at);
      return { enabled, code, campaign: CAMPAIGN, rewardsEnabled: false,
        totals: { started: eligible.length, completed: eligible.filter(r => r.completed_at).length, artists: eligible.filter(r => r.artist_qualified_at).length },
        items: rows.map(r => ({ id: r.id, label: `Artist invitation ${r.id.slice(0,8)}`, startedAt: r.bound_at.toISOString(), completedAt: r.completed_at?.toISOString() ?? null, artistQualifiedAt: r.artist_qualified_at?.toISOString() ?? null, excluded: Boolean(r.excluded_at) })) };
    });
  },
  async adminList() {
    return databaseService.transaction(async client => {
      const items = (await client.query("SELECT r.*,i.payload->>'displayName' AS inviter_name,u.payload->>'displayName' AS invitee_name,to_jsonb(a) AS paid_activation FROM referrals r JOIN users i ON i.id=r.inviter_id JOIN users u ON u.id=r.invitee_id LEFT JOIN referral_paid_activations a ON a.referral_id=r.id ORDER BY r.bound_at DESC")).rows;
      const events = (await client.query("SELECT * FROM referral_events ORDER BY id")).rows;
      return { items: items.map(r => ({ ...r, events: events.filter(e => e.referral_id === r.id) })), campaign: CAMPAIGN, rewardsEnabled: false };
    });
  },
  async exclude(id: string, actor: string, input: unknown) {
    const { reason } = referralExclusionSchema.parse(input);
    await databaseService.transaction(async client => {
      const result = await client.query("UPDATE referrals SET excluded_at=NOW(),exclusion_reason=$2 WHERE id=$1 AND excluded_at IS NULL RETURNING id", [id,reason]);
      if (!result.rowCount) throw new HttpError(409, "Referral is missing or already excluded.");
      await client.query("INSERT INTO referral_events(referral_id,action,actor,reason) VALUES($1,'excluded',$2,$3)", [id,actor,reason]);
    });
  },
  async reconcile() {
    return databaseService.transaction(async client => {
      const rows = (await client.query("SELECT u.payload FROM referrals r JOIN users u ON u.id=r.invitee_id WHERE r.excluded_at IS NULL AND u.onboarding_status='complete' ORDER BY r.id")).rows;
      for (const row of rows) await qualifyReferral(client,row.payload);
      return { checked: rows.length };
    });
  },
  async reconcilePayments() {
    const payments = await databaseService.transaction(async client => (await client.query("SELECT p.payload FROM payments p JOIN users u ON u.wallet_address=p.wallet_address JOIN referrals r ON r.invitee_id=u.id WHERE r.excluded_at IS NULL AND p.product_type='artist_onboarding_fee' AND p.payload->>'status'='confirmed' ORDER BY p.id")).rows);
    for (const row of payments) await this.recordPaidActivation(row.payload);
    return { checkedPayments: payments.length };
  },
};
