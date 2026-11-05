import { bindReferral, qualifyReferral } from "../referrals/referrals.service.js";
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

  async upsert(user: UserProfile, options: { referralReceipt?: string } = {}) {
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
      await redeemArtistSponsorship(client,user);
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
