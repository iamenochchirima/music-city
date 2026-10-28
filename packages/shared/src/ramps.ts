import { z } from "zod";
import { cashOutMoneySchema, cashOutUnitsSchema } from "./cashout.js";
import { stellarWalletAddressSchema } from "./commerce.js";

export const rampProviderSchema = z.enum(["moonpay", "moneygram"]);
export const rampDirectionSchema = z.enum(["buy", "sell"]);
export const rampProviderStateSchema = z.enum([
  "created",
  "awaiting_user",
  "processing",
  "ready_for_pickup",
  "completed",
  "failed",
  "cancelled",
  "refund_pending",
  "refunded",
  "unknown",
]);
export const rampChainStateSchema = z.enum([
  "unobserved",
  "prepared",
  "submitting",
  "confirmed",
  "failed",
  "unknown",
  "expired",
]);

export const rampMarketSchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  method: z.enum(["card", "bank", "apple_pay", "google_pay", "cash_pickup", "cash_deposit", "mobile_money"]),
}).strict();

export const createRampOrderSchema = z.object({
  requestId: z.string().uuid().toLowerCase(),
  provider: rampProviderSchema,
  direction: rampDirectionSchema,
  assetCode: z.enum(["USDC", "XLM"]),
  market: rampMarketSchema,
  amount: z.string().max(40).regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
}).strict();
export type CreateRampOrder = z.infer<typeof createRampOrderSchema>;

// These are server-resolved terms, not an authorization to create a provider order.
export const rampOrderTermsSchema = z
  .object({
    userId: z.string().min(1).max(200),
    walletAddress: stellarWalletAddressSchema,
    requestId: z.string().uuid().toLowerCase(),
    provider: rampProviderSchema,
    direction: rampDirectionSchema,
    environment: z.literal("sandbox"),
    network: z.literal("stellar:testnet"),
    assetCode: z.enum(["USDC", "XLM"]),
    assetIssuer: stellarWalletAddressSchema.optional(),
    market: rampMarketSchema,
    amount: cashOutMoneySchema,
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (path: string[], message: string) =>
      context.addIssue({ code: "custom", path, message });
    if (value.assetCode === "USDC" && !value.assetIssuer)
      issue(["assetIssuer"], "USDC requires its exact issuer");
    if (value.assetCode === "XLM" && value.assetIssuer)
      issue(["assetIssuer"], "Native XLM has no issuer");
    if (value.provider === "moneygram" && value.assetCode !== "USDC")
      issue(["assetCode"], "MoneyGram uses USDC");

    if (value.amount.units === "0")
      issue(["amount", "units"], "Enter an amount above zero");
    if (
      value.direction === "buy" &&
      value.amount.currency !== value.market.currency
    )
      issue(["amount"], "Funding terms must use the selected fiat currency");
    if (
      value.direction === "sell" &&
      (value.amount.currency !== value.assetCode ||
        value.amount.decimals !== 7 ||
        !cashOutUnitsSchema.safeParse(value.amount.units).success)
    )
      issue(["amount"], "Withdrawal terms must use exact Stellar asset units");
    if (
      value.provider === "moneygram" &&
      value.market.method !==
        (value.direction === "buy" ? "cash_deposit" : "cash_pickup")
    )
      issue(
        ["market", "method"],
        "Use the MoneyGram cash method for this direction",
      );
    if (
      value.provider === "moonpay" &&
      ["cash_pickup", "cash_deposit"].includes(value.market.method)
    )
      issue(["market", "method"], "MoonPay requires an online method");
    if (
      value.direction === "sell" &&
      ["apple_pay", "google_pay"].includes(value.market.method)
    )
      issue(["market", "method"], "This method is only supported for funding");
  });
export type RampOrderTerms = z.infer<typeof rampOrderTermsSchema>;
export const rampProviderObservationSchema = z
  .object({
    id: z.string().min(1).max(200),
    externalId: z.string().min(1).max(200),
    state: rampProviderStateSchema,
    originalStatus: z.string().min(1).max(120),
    updatedAt: z.string().datetime(),
    chainHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    assetUnits: cashOutUnitsSchema.optional(),
  })
  .strict();
export const rampOrderSchema = z
  .object({
    id: z.string().min(1),
    terms: rampOrderTermsSchema,
    providerState: rampProviderStateSchema,
    providerObservation: rampProviderObservationSchema.optional(),
    launchIssuedAt: z.string().datetime().optional(),
    chainState: rampChainStateSchema,
    providerTransactionId: z.string().min(1).max(200).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type RampOrder = z.infer<typeof rampOrderSchema>;

