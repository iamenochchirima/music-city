import { z } from "zod";

const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;
const STELLAR_ASSET_CODE_REGEX = /^[A-Z0-9]{1,12}$/;
const DECIMAL_AMOUNT_REGEX = /^\d+(?:\.\d{1,7})?$/;

const trimString = (value: string) => value.trim();

const normalizeOptionalString = (value?: string) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

export const stellarWalletAddressSchema = z
  .string()
  .trim()
  .regex(STELLAR_PUBLIC_KEY_REGEX, "Wallet address must be a valid Stellar public key");

export const stellarAssetCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(STELLAR_ASSET_CODE_REGEX, "Asset code must be 1-12 uppercase letters or digits");

export const optionalStellarAssetCodeSchema = z
  .string()
  .max(32)
  .optional()
  .transform((value) => normalizeOptionalString(value)?.toUpperCase())
  .refine(
    (value) => !value || STELLAR_ASSET_CODE_REGEX.test(value),
    "Asset code must be 1-12 uppercase letters or digits",
  );

export const optionalStellarAssetIssuerSchema = z
  .string()
  .max(80)
  .optional()
  .transform(normalizeOptionalString)
  .refine(
    (value) => !value || STELLAR_PUBLIC_KEY_REGEX.test(value),
    "Asset issuer must be a valid Stellar public key",
  );

export const positiveAmountSchema = z
  .string()
  .trim()
  .regex(DECIMAL_AMOUNT_REGEX, "Amount must be a positive number with up to 7 decimal places")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero")
  .transform((value) => trimString(value));

export const nonNegativeAmountSchema = z
  .string()
  .trim()
  .regex(DECIMAL_AMOUNT_REGEX, "Amount must be a non-negative number with up to 7 decimal places")
  .refine((value) => Number(value) >= 0, "Amount must not be negative")
  .transform((value) => trimString(value));

export const optionalPositiveAmountSchema = z
  .string()
  .max(32)
  .optional()
  .transform(normalizeOptionalString)
  .refine(
    (value) => !value || DECIMAL_AMOUNT_REGEX.test(value),
    "Amount must be a positive number with up to 7 decimal places",
  )
  .refine((value) => !value || Number(value) > 0, "Amount must be greater than zero");

export const requireIssuerForNonNativeAsset = <
  T extends {
    assetCode?: string;
    assetIssuer?: string;
  },
>(
  value: T,
  issuePath: (keyof T)[] = ["assetIssuer" as keyof T],
) => {
  if (value.assetCode && value.assetCode !== "XLM" && !value.assetIssuer) {
    return {
      path: issuePath,
      message: "A non-native Stellar asset requires an issuer address",
    };
  }

  return null;
};
