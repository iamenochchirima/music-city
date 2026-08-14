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

  async upsert(user: UserProfile) {
    await databaseService.upsertUser(
      user.id,
      user.walletAddress,
      user.primaryIntent,
      user.onboardingStatus,
      user.onboardingStep,
      user.onboardingVersion,
      user.onboardingCompletedAt,
      user,
    );
    return user;
  },

  async listArtists() {
    return databaseService.listUsersByPrimaryIntents<UserProfile>([
      "artist",
      "both",
    ]);
  },
};
