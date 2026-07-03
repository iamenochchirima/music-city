import {
  type AdminAdListItem,
  adminAccountSchema,
  adminPlatformSubscriptionSettingsSchema,
  adminSubscriptionListSchema,
  adminSubscriptionRecordSchema,
  adminUserListSchema,
  adminUserRecordSchema,
  adminTreasuryOverviewSchema,
  adminTreasurySettingsSchema,
  adminSessionSchema,
  bootstrapAdminInputSchema,
  createAdminInputSchema,
  adminLoginInputSchema,
  type AdminAccount,
  type AdminPlatformSubscriptionSettings,
  type AdminSubscriptionList,
  type AdminSubscriptionRecord,
  type AdminUserList,
  type AdminTreasuryOverview,
  type AdminTreasurySettings,
  type AdminSession,
  type PaymentRecord,
  type SubscriptionRecord,
  type TrackSummary,
} from "@music-city/shared";

import { env } from "../../config/env.js";
import { databaseService } from "../../services/database.service.js";
import { createId } from "../../services/id.service.js";
import { passwordService } from "../../services/password.service.js";
import { HttpError } from "../../utils/http-error.js";
import { walletService } from "../wallet/wallet.service.js";
import { paymentsRepository } from "../payments/payments.repository.js";
import { subscriptionsRepository } from "../subscriptions/subscriptions.repository.js";
import { usersService } from "../users/users.service.js";
import { royaltiesService } from "../royalties/royalties.service.js";
import { tracksRepository } from "../tracks/tracks.repository.js";
import { adsService } from "../ads/ads.service.js";

type PersistedAdminAccount = AdminAccount & {
  passwordHash: string;
};

const PLATFORM_SUBSCRIPTION_SETTINGS_KEY = "platform_subscription_settings";
const TREASURY_SETTINGS_KEY = "treasury_wallet_settings";

const defaultPlatformSettings = (): AdminPlatformSubscriptionSettings => ({
  enabled: env.PLATFORM_SUBSCRIPTION_ENABLED,
  name: env.PLATFORM_SUBSCRIPTION_NAME,
  description: env.PLATFORM_SUBSCRIPTION_DESCRIPTION,
  price: env.PLATFORM_SUBSCRIPTION_PRICE,
  assetCode: env.PLATFORM_SUBSCRIPTION_ASSET_CODE,
  assetIssuer: env.PLATFORM_SUBSCRIPTION_ASSET_ISSUER ?? "",
  periodDays: env.PLATFORM_SUBSCRIPTION_PERIOD_DAYS,
});

const normalizePlatformSettings = (
  settings?: Partial<AdminPlatformSubscriptionSettings> | null,
): AdminPlatformSubscriptionSettings => ({
  ...defaultPlatformSettings(),
  ...settings,
  assetCode: env.PLATFORM_SUBSCRIPTION_ASSET_CODE,
  assetIssuer: env.PLATFORM_SUBSCRIPTION_ASSET_ISSUER ?? "",
});

const defaultTreasurySettings = (): AdminTreasurySettings => ({
  walletAddress: env.STELLAR_TREASURY_ADDRESS?.trim() ?? "",
});

const nowMs = () => Date.now();

const normalizeSubscriptionStatus = (subscription: SubscriptionRecord) =>
  subscription.status === "active" && Date.parse(subscription.endsAt) <= nowMs()
    ? "expired"
    : subscription.status;

const toAdminSession = (admin: PersistedAdminAccount): Omit<AdminSession, "token"> =>
  adminSessionSchema.omit({ token: true }).parse({
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
  });

const sanitizeAdmin = (admin: PersistedAdminAccount): AdminAccount =>
  adminAccountSchema.parse({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  });

export const adminService = {
  async bootstrapRequired() {
    return (await databaseService.countAdmins()) === 0;
  },

  async bootstrap(input: unknown) {
    if (!(await this.bootstrapRequired())) {
      throw new HttpError(409, "Admin bootstrap has already been completed");
    }

    const parsed = bootstrapAdminInputSchema.parse(input);
    const timestamp = new Date().toISOString();
    const admin: PersistedAdminAccount = {
      id: createId("adm"),
      email: parsed.email.trim().toLowerCase(),
      name: parsed.name.trim(),
      role: "super_admin",
      passwordHash: await passwordService.hashPassword(parsed.password),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await databaseService.upsertAdmin(admin.id, admin.email, admin.role, admin);

    return {
      admin: sanitizeAdmin(admin),
      session: toAdminSession(admin),
    };
  },

  async login(input: unknown) {
    const parsed = adminLoginInputSchema.parse(input);
    const existing = await databaseService.findAdminByEmail<PersistedAdminAccount>(
      parsed.email.trim().toLowerCase(),
    );

    if (!existing) {
      throw new HttpError(401, "Invalid email or password");
    }

    const valid = await passwordService.verifyPassword(
      parsed.password,
      existing.passwordHash,
    );

    if (!valid) {
      throw new HttpError(401, "Invalid email or password");
    }

    return {
      admin: sanitizeAdmin(existing),
      session: toAdminSession(existing),
    };
  },

  async getAdminById(adminId: string) {
    const admin = await databaseService.findAdminById<PersistedAdminAccount>(adminId);

    if (!admin) {
      throw new HttpError(404, "Admin account not found");
    }

    return sanitizeAdmin(admin);
  },

  async listAdmins() {
    const admins = await databaseService.listAdmins<PersistedAdminAccount>();
    return admins.map(sanitizeAdmin);
  },

  async createAdmin(input: unknown) {
    const parsed = createAdminInputSchema.parse(input);
    const existing = await databaseService.findAdminByEmail<PersistedAdminAccount>(
      parsed.email.trim().toLowerCase(),
    );

    if (existing) {
      throw new HttpError(409, "An admin with this email already exists");
    }

    const timestamp = new Date().toISOString();
    const admin: PersistedAdminAccount = {
      id: createId("adm"),
      email: parsed.email.trim().toLowerCase(),
      name: parsed.name.trim(),
      role: parsed.role,
      passwordHash: await passwordService.hashPassword(parsed.password),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await databaseService.upsertAdmin(admin.id, admin.email, admin.role, admin);
    return sanitizeAdmin(admin);
  },

  async getPlatformSubscriptionSettings() {
    const stored =
      await databaseService.findSetting<AdminPlatformSubscriptionSettings>(
        PLATFORM_SUBSCRIPTION_SETTINGS_KEY,
      );

    return adminPlatformSubscriptionSettingsSchema.parse(
      normalizePlatformSettings(stored),
    );
  },

  async updatePlatformSubscriptionSettings(input: unknown) {
    const parsed = adminPlatformSubscriptionSettingsSchema.parse(input);
    const normalized = normalizePlatformSettings({
      ...parsed,
    });

    await databaseService.upsertSetting(
      PLATFORM_SUBSCRIPTION_SETTINGS_KEY,
      normalized,
    );

    return normalized;
  },

  async getTreasurySettings() {
    const stored = await databaseService.findSetting<AdminTreasurySettings>(
      TREASURY_SETTINGS_KEY,
    );

    return adminTreasurySettingsSchema.parse(stored ?? defaultTreasurySettings());
  },

  async getTreasuryOverview(): Promise<AdminTreasuryOverview> {
    const settings = await this.getTreasurySettings();
    const account = settings.walletAddress
      ? await walletService.getWalletAccount(settings.walletAddress)
      : null;

    return adminTreasuryOverviewSchema.parse({
      settings,
      account,
    });
  },

  async updateTreasurySettings(input: unknown) {
    const parsed = adminTreasurySettingsSchema.parse(input);
    const normalized = {
      walletAddress: parsed.walletAddress.trim(),
    };

    await databaseService.upsertSetting(TREASURY_SETTINGS_KEY, normalized);

    return this.getTreasuryOverview();
  },

  async getTreasuryWalletAddress() {
    const settings = await this.getTreasurySettings();

    if (!settings.walletAddress) {
      throw new HttpError(500, "Stellar treasury wallet is not configured");
    }

    return settings.walletAddress;
  },

  async listSubscriptions(): Promise<AdminSubscriptionList> {
    const [subscriptions, payments] = await Promise.all([
      subscriptionsRepository.listAll(),
      paymentsRepository.listAllPayments(),
    ]);
    const platformSubscriptions = subscriptions.filter(
      (subscription) => subscription.scope === "platform",
    );

    const paymentById = new Map<string, PaymentRecord>(
      payments.map((payment) => [payment.id, payment]),
    );

    const items = platformSubscriptions
      .map((subscription) => {
        const payment = paymentById.get(subscription.paymentId);

        return adminSubscriptionRecordSchema.parse({
          id: subscription.id,
          walletAddress: subscription.walletAddress,
          scope: subscription.scope,
          status: normalizeSubscriptionStatus(subscription),
          paymentId: subscription.paymentId,
          amount: payment?.amount,
          assetCode: payment?.assetCode,
          assetIssuer: payment?.assetIssuer,
          startsAt: subscription.startsAt,
          endsAt: subscription.endsAt,
          confirmedAt: payment?.confirmedAt,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        });
      })
      .sort((left, right) => Date.parse(right.endsAt) - Date.parse(left.endsAt));

    const summary = {
      total: items.length,
      active: items.filter((item) => item.status === "active").length,
      platform: items.filter((item) => item.scope === "platform").length,
    };

    return adminSubscriptionListSchema.parse({
      summary,
      items,
    });
  },

  async listTracks(): Promise<{ items: TrackSummary[] }> {
    const items = (await tracksRepository.list()).sort(
      (left, right) =>
        Date.parse(right.updatedAt ?? right.createdAt ?? "") -
        Date.parse(left.updatedAt ?? left.createdAt ?? ""),
    );

    return {
      items,
    };
  },

  async listUsers(): Promise<AdminUserList> {
    const [users, subscriptions] = await Promise.all([
      usersService.listAllProfiles(),
      subscriptionsRepository.listAll(),
    ]);

    const activeSubscriptionCountByWallet = subscriptions.reduce<Map<string, number>>(
      (map, subscription) => {
        if (normalizeSubscriptionStatus(subscription) !== "active") {
          return map;
        }

        map.set(
          subscription.walletAddress,
          (map.get(subscription.walletAddress) ?? 0) + 1,
        );
        return map;
      },
      new Map(),
    );

    const items = users
      .map((user) => {
        const activeSubscriptionCount =
          activeSubscriptionCountByWallet.get(user.walletAddress) ?? 0;

        return adminUserRecordSchema.parse({
          id: user.id,
          walletAddress: user.walletAddress,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          location: user.location,
          subscriptionStatus:
            activeSubscriptionCount > 0 ? "subscribed" : "unsubscribed",
          activeSubscriptionCount,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        });
      })
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

    const summary = {
      total: items.length,
      subscribed: items.filter((item) => item.subscriptionStatus === "subscribed")
        .length,
      unsubscribed: items.filter((item) => item.subscriptionStatus === "unsubscribed")
        .length,
      artists: items.filter((item) => item.role === "artist").length,
      fans: items.filter((item) => item.role === "fan").length,
    };

    return adminUserListSchema.parse({
      summary,
      items,
    });
  },

  async listAds(): Promise<{ items: AdminAdListItem[] }> {
    return {
      items: await adsService.listAds(),
    };
  },

  async createAd(input: unknown) {
    return adsService.createAd(input as never);
  },

  async updateAd(adId: string, input: unknown) {
    return adsService.updateAd(adId, input as never);
  },

  async archiveAd(adId: string) {
    return adsService.archiveAd(adId);
  },

  async listAdImpressions(input?: { adId?: string; status?: string }) {
    return {
      items: await adsService.listImpressions(input),
    };
  },

  getRoyaltyConfig() {
    return royaltiesService.getConfig();
  },

  getRoyaltyPayoutSettings() {
    return royaltiesService.getPayoutSettings();
  },

  updateRoyaltyPayoutSettings(input: unknown) {
    return royaltiesService.updatePayoutSettings(input);
  },

  getRoyaltyFeeSettings() {
    return royaltiesService.getFeeSettings();
  },

  updateRoyaltyFeeSettings(input: unknown) {
    return royaltiesService.updateFeeSettings(input);
  },

  listTrackRoyaltySplits(trackId: string) {
    return royaltiesService.listTrackSplits(trackId);
  },

  listTrackRoyaltyLedger(trackId: string) {
    return royaltiesService.listTrackLedgerEntries(trackId);
  },

  listRoyaltyLedger(input?: {
    status?: "pending" | "approved" | "paid" | "reversed";
    recipientWalletAddress?: string;
  }) {
    return royaltiesService.listLedgerEntries(input);
  },

  listRoyaltyPayouts(input?: {
    status?: "pending" | "submitted" | "confirmed" | "failed" | "cancelled";
    recipientWalletAddress?: string;
  }) {
    return royaltiesService.listPayouts(input);
  },

  approveRoyaltyLedgerEntries(input: unknown) {
    return royaltiesService.approveLedgerEntries(input as never);
  },

  runRoyaltyPayouts(input: unknown) {
    return royaltiesService.runPayouts(input as never);
  },

  reconcileRoyaltyPayouts(input: unknown) {
    return royaltiesService.reconcilePayouts(input as never);
  },

  upsertTrackRoyaltySplits(trackId: string, input: unknown) {
    return royaltiesService.upsertTrackSplits(trackId, input as never);
  },
};
