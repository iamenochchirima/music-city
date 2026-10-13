import { bindReferral, qualifyReferral } from "../referrals/referrals.service.js";
import { HttpError } from "../../utils/http-error.js";
import { captureArtistSponsorshipEligibility, redeemArtistSponsorship } from "../sponsorships/sponsorships.service.js";
import type { UserProfile } from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export const usersRepository = {
  async listAll() {
    return databaseService.listPayloads<UserProfile>("users");
  },

  async findById(id: string) {
    return databaseService.findUserById<UserProfile>(id);
  },

  async findByWallet(walletAddress: string) {
    return databaseService.findUserByWallet<UserProfile>(walletAddress);
  },

  async upsert(user: UserProfile, options: { referralReceipt?: string; requireArtistAccess?: boolean } = {}) {
    return databaseService.transaction(async client => {
      // Serialize first profile creation by wallet, including attribution.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [user.walletAddress]);
      const existing = (await client.query("SELECT payload FROM users WHERE wallet_address=$1 FOR UPDATE", [user.walletAddress])).rows[0]?.payload as UserProfile | undefined;
      // A concurrent first registration already committed. Return its result.
      if (existing && existing.id !== user.id) return existing;
      await databaseService.upsertUser(user.id,user.walletAddress,user.primaryIntent,user.onboardingStatus,
        user.onboardingStep,user.onboardingVersion,user.onboardingCompletedAt,user,client);
      if (!existing) {
        await bindReferral(client,user,options.referralReceipt);
        await captureArtistSponsorshipEligibility(client,user);
      }
      await qualifyReferral(client,user);
      const isArtist = user.primaryIntent === "artist" || user.primaryIntent === "both";
      await redeemArtistSponsorship(client,user);

      if (options.requireArtistAccess && isArtist) {
        const access = (await client.query<{ granted: boolean }>(
          `SELECT (
             EXISTS(SELECT 1 FROM artist_sponsorship_grants WHERE user_id=$1)
             OR EXISTS(SELECT 1 FROM payments WHERE wallet_address=$2 AND product_type='artist_onboarding_fee' AND payload->>'status'='confirmed')
             OR $3::boolean
           ) AS granted`,
          [user.id, user.walletAddress, Boolean(existing?.artistAccess && user.artistAccess)],
        )).rows[0]?.granted;
        if (!access) throw new HttpError(402, "Complete artist activation before finishing registration");
      }
      return user;
    });
  },

  async listArtists() {
    return databaseService.listUsersByPrimaryIntents<UserProfile>([
      "artist",
      "both",
    ]);
  },
};
