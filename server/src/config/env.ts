import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { basename, normalize, resolve } from "node:path";

import { z } from "zod";

const workspaceEnvPath = resolve(process.cwd(), "..", ".env");
const localEnvPath = resolve(process.cwd(), ".env");

if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath });
} else if (existsSync(workspaceEnvPath)) {
  loadEnv({ path: workspaceEnvPath });
} else {
  loadEnv();
}

const normalizeLocalRoot = (value: string) => {
  const normalized = normalize(value).replace(/\\/g, "/").replace(/^\.?\//, "");

  if (basename(process.cwd()) === "server" && normalized.startsWith("server/")) {
    return normalized.slice("server/".length);
  }

  return normalized;
};

const hasValue = (value?: string) => typeof value === "string" && value.trim().length > 0;
const isLocalUrl = (value: string) => /:\/\/(localhost|127\.0\.0\.1)([:/]|$)/i.test(value);
const usesHttps = (value: string) => value.startsWith("https://");
const usesTestnetHost = (value: string) => /testnet/i.test(value);
const isDefaultSecret = (value: string, defaults: string[]) => defaults.includes(value);

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(4000),
    CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
    ADMIN_CLIENT_ORIGIN: z.string().default("http://localhost:3001"),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().default("music-city-dev-secret"),
    ADMIN_JWT_SECRET: z.string().default("music-city-admin-secret"),
    STELLAR_NETWORK_PASSPHRASE: z
      .string()
      .default("Test SDF Network ; September 2015"),
    STELLAR_HOME_DOMAIN: z.string().default("localhost"),
    STELLAR_WEB_AUTH_DOMAIN: z.string().default("localhost:4000"),
    STELLAR_SEP10_SECRET: z.string().optional(),
    APP_BASE_URL: z.string().default("http://localhost:4000"),
    STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
    STORAGE_BUCKET: z.string().default("music-city-dev"),
    STORAGE_REGION: z.string().default("auto"),
    STORAGE_ENDPOINT: z.string().optional(),
    STORAGE_PUBLIC_BASE_URL: z.string().optional(),
    STORAGE_ACCESS_KEY_ID: z.string().optional(),
    STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
    STORAGE_PATH_STYLE: z
      .string()
      .optional()
      .transform((value) => value === "true"),
    LOCAL_MEDIA_ROOT: z
      .string()
      .default("data/media")
      .transform(normalizeLocalRoot),
    PLAYBACK_TOKEN_SECRET: z.string().default("music-city-playback-secret"),
    DYNAMIC_ENVIRONMENT_ID: z.string().optional(),
    DYNAMIC_JWKS_URL: z.string().optional(),
    STELLAR_HORIZON_URL: z.string().default("https://horizon-testnet.stellar.org"),
    STELLAR_ACCESS_ASSET_CODE: z.string().optional(),
    STELLAR_ACCESS_ASSET_ISSUER: z.string().optional(),
    STELLAR_TREASURY_ADDRESS: z.string().optional(),
    STELLAR_TREASURY_SECRET: z.string().optional(),
    STELLAR_SETTLEMENT_ASSET_CODE: z.string().default("XLM"),
    STELLAR_SETTLEMENT_ASSET_ISSUER: z.string().optional(),
    ROYALTY_REGISTRY_CHAIN: z.enum(["stellar", "evm", "solana"]).default("stellar"),
    ROYALTY_REGISTRY_NETWORK: z.string().default("stellar:testnet"),
    ROYALTY_REGISTRY_CONTRACT_ID: z.string().optional(),
    ROYALTY_PAYOUT_APPROVAL_MODE: z.enum(["admin", "automatic"]).default("admin"),
    ROYALTY_PAYOUT_CADENCE: z
      .enum(["manual", "daily", "weekly", "monthly"])
      .default("manual"),
    ROYALTY_PAYOUT_MINIMUM_AMOUNT: z.string().default("10"),
    ROYALTY_PAYOUT_RETRY_FAILED: z
      .string()
      .optional()
      .transform((value) => value !== "false"),
    ROYALTY_PAYOUT_SHORTFALL_BEHAVIOR: z
      .enum(["block_all", "allow_partial_batches"])
      .default("block_all"),
    ROYALTY_PAYOUT_AUTOMATIC_APPROVAL: z
      .string()
      .optional()
      .transform((value) => value === "true"),
    ROYALTY_PAYOUT_REVERSAL_POLICY: z
      .string()
      .default("Failed or cancelled payouts return linked ledger entries to approved for retry."),
    ROYALTY_CONFIRM_BEFORE_MARK_PAID: z
      .string()
      .optional()
      .transform((value) => value !== "false"),
    ROYALTY_FEE_TRACK_PURCHASE_BPS: z.coerce.number().int().min(0).max(9_999).default(0),
    ROYALTY_FEE_PLATFORM_SUBSCRIPTION_BPS: z.coerce.number().int().min(0).max(9_999).default(0),
    ROYALTY_FEE_AD_REVENUE_BPS: z.coerce.number().int().min(0).max(9_999).default(0),
    ROYALTY_FEE_MANUAL_ADJUSTMENT_BPS: z.coerce.number().int().min(0).max(9_999).default(0),
    TRACK_PURCHASE_DEFAULT_PRICE: z.string().default("5"),
    PLATFORM_SUBSCRIPTION_ENABLED: z
      .string()
      .optional()
      .transform((value) => value !== "false"),
    PLATFORM_SUBSCRIPTION_NAME: z.string().default("Music City Pass"),
    PLATFORM_SUBSCRIPTION_DESCRIPTION: z
      .string()
      .default("Subscribe once to unlock every subscriber-only release on Music City."),
    PLATFORM_SUBSCRIPTION_PRICE: z.string().default("15"),
    PLATFORM_SUBSCRIPTION_ASSET_CODE: z.string().default("USDC"),
    PLATFORM_SUBSCRIPTION_ASSET_ISSUER: z
      .string()
      .default("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"),
    PLATFORM_SUBSCRIPTION_PERIOD_DAYS: z.coerce.number().int().positive().default(30),
    ARCHIVE_OUTPUT_ROOT: z
      .string()
      .default("data/archives")
      .transform(normalizeLocalRoot),
    ARCHIVE_MASTER_KEY: z.string().optional(),
    ARCHIVE_REMOTE_UPLOAD_URL: z.string().optional(),
    ARCHIVE_REMOTE_UPLOAD_TOKEN: z.string().optional(),
    MEDIA_PROVIDER: z.enum(["local", "mux"]).default("local"),
    MUX_TOKEN_ID: z.string().optional(),
    MUX_TOKEN_SECRET: z.string().optional(),
    MUX_WEBHOOK_SECRET: z.string().optional(),
    MUX_SIGNING_KEY: z.string().optional(),
    MUX_PRIVATE_KEY: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.STORAGE_PROVIDER === "s3") {
      if (!hasValue(value.STORAGE_ENDPOINT)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STORAGE_ENDPOINT"],
          message: "STORAGE_ENDPOINT is required when STORAGE_PROVIDER=s3",
        });
      }

      if (!hasValue(value.STORAGE_ACCESS_KEY_ID)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STORAGE_ACCESS_KEY_ID"],
          message: "STORAGE_ACCESS_KEY_ID is required when STORAGE_PROVIDER=s3",
        });
      }

      if (!hasValue(value.STORAGE_SECRET_ACCESS_KEY)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STORAGE_SECRET_ACCESS_KEY"],
          message: "STORAGE_SECRET_ACCESS_KEY is required when STORAGE_PROVIDER=s3",
        });
      }
    }

    if (value.MEDIA_PROVIDER === "mux") {
      if (!hasValue(value.MUX_TOKEN_ID)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["MUX_TOKEN_ID"],
          message: "MUX_TOKEN_ID is required when MEDIA_PROVIDER=mux",
        });
      }

      if (!hasValue(value.MUX_TOKEN_SECRET)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["MUX_TOKEN_SECRET"],
          message: "MUX_TOKEN_SECRET is required when MEDIA_PROVIDER=mux",
        });
      }
    }

    if (value.NODE_ENV === "production" && value.STORAGE_PROVIDER === "local") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STORAGE_PROVIDER"],
        message:
          "Production must not use STORAGE_PROVIDER=local. Configure STORAGE_PROVIDER=s3 instead.",
      });
    }

    if (value.NODE_ENV === "production") {
      if (
        isDefaultSecret(value.JWT_SECRET, ["music-city-dev-secret"]) ||
        value.JWT_SECRET.trim().length < 24
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_SECRET"],
          message: "Production requires a strong non-default JWT_SECRET.",
        });
      }

      if (
        isDefaultSecret(value.ADMIN_JWT_SECRET, ["music-city-admin-secret"]) ||
        value.ADMIN_JWT_SECRET.trim().length < 24
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ADMIN_JWT_SECRET"],
          message: "Production requires a strong non-default ADMIN_JWT_SECRET.",
        });
      }

      if (
        isDefaultSecret(value.PLAYBACK_TOKEN_SECRET, ["music-city-playback-secret"]) ||
        value.PLAYBACK_TOKEN_SECRET.trim().length < 24
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["PLAYBACK_TOKEN_SECRET"],
          message: "Production requires a strong non-default PLAYBACK_TOKEN_SECRET.",
        });
      }

      for (const [key, url] of [
        ["CLIENT_ORIGIN", value.CLIENT_ORIGIN],
        ["ADMIN_CLIENT_ORIGIN", value.ADMIN_CLIENT_ORIGIN],
        ["APP_BASE_URL", value.APP_BASE_URL],
      ] as const) {
        if (isLocalUrl(url)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} must not point to localhost in production.`,
          });
        }

        if (!usesHttps(url)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} must use https:// in production.`,
          });
        }
      }

      if (value.STELLAR_HOME_DOMAIN === "localhost") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STELLAR_HOME_DOMAIN"],
          message: "STELLAR_HOME_DOMAIN must be configured for production.",
        });
      }

      if (value.STELLAR_WEB_AUTH_DOMAIN === "localhost:4000") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STELLAR_WEB_AUTH_DOMAIN"],
          message: "STELLAR_WEB_AUTH_DOMAIN must be configured for production.",
        });
      }

      if (usesTestnetHost(value.STELLAR_HORIZON_URL)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STELLAR_HORIZON_URL"],
          message: "Production must not use a Stellar testnet horizon URL.",
        });
      }

      if (usesTestnetHost(value.ROYALTY_REGISTRY_NETWORK)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ROYALTY_REGISTRY_NETWORK"],
          message: "Production must not use a testnet royalty registry network.",
        });
      }

      if (!hasValue(value.STELLAR_TREASURY_ADDRESS)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STELLAR_TREASURY_ADDRESS"],
          message: "Production requires STELLAR_TREASURY_ADDRESS.",
        });
      }
    }
  });

export const env = envSchema.parse(process.env);
