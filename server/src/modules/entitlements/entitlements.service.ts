import type { EntitlementRecord, GrantEntitlementInput } from "@music-city/shared";

import { grantEntitlementSchema } from "@music-city/shared";

import { env } from "../../config/env.js";
import { createId } from "../../services/id.service.js";
import { tracksService } from "../tracks/tracks.service.js";
import { usersService } from "../users/users.service.js";
import { entitlementsRepository } from "./entitlements.repository.js";

const withinWindow = (record: EntitlementRecord) => {
  const now = Date.now();
  const start = Date.parse(record.startsAt);
  const end = record.endsAt ? Date.parse(record.endsAt) : Number.POSITIVE_INFINITY;

  return start <= now && end >= now;
};

export const entitlementsService = {
  async hasStellarAssetEntitlement(walletAddress: string) {
    if (!env.STELLAR_ACCESS_ASSET_CODE || !env.STELLAR_ACCESS_ASSET_ISSUER) {
      return false;
    }

    const response = await fetch(
      `${env.STELLAR_HORIZON_URL}/accounts/${encodeURIComponent(walletAddress)}`,
    );

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as {
      balances?: Array<{
        asset_code?: string;
        asset_issuer?: string;
        balance?: string;
      }>;
    };

    return Boolean(
      payload.balances?.some(
        (balance) =>
          balance.asset_code === env.STELLAR_ACCESS_ASSET_CODE &&
          balance.asset_issuer === env.STELLAR_ACCESS_ASSET_ISSUER &&
          Number(balance.balance ?? "0") > 0,
      ),
    );
  },

  async listMine(walletAddress: string) {
    return (await entitlementsRepository.listByWallet(walletAddress)).filter(withinWindow);
  },

  async findMineForTrack(walletAddress: string, trackId: string) {
    return (await this.listMine(walletAddress)).find(
      (record) => record.trackId === trackId,
    );
  },

  grant(walletAddress: string, input: GrantEntitlementInput) {
    const parsed = grantEntitlementSchema.parse(input);
    const now = new Date().toISOString();

    return entitlementsRepository.upsert({
      id: createId("ent"),
      walletAddress,
      trackId: parsed.trackId,
      source: parsed.source,
      startsAt: parsed.startsAt ?? now,
      endsAt: parsed.endsAt,
    });
  },

  grantPurchase(walletAddress: string, trackId: string) {
    return this.grant(walletAddress, {
      trackId,
      source: "purchase",
    });
  },

  async canPlayTrack(walletAddress: string, trackId: string) {
    const track = await tracksService.getTrackForPlayback(trackId);

    if (!track || !track.playbackReady) {
      return false;
    }

    const profile = await usersService.getProfile(walletAddress);

    return (await tracksService.isTrackPublic(track.id)) || profile?.id === track.artistId;
  },
};
