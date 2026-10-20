import { z } from "zod";
import { stellarWalletAddressSchema } from "./commerce.js";

const maxStellarUnits = 9223372036854775807n;
export const cashOutUnitsSchema = z.string()
  .max(19).regex(/^(0|[1-9][0-9]*)$/)
  .refine((value) => value.length <= 19 && /^(0|[1-9][0-9]*)$/.test(value) && BigInt(value) <= maxStellarUnits,
    "Amount exceeds the Stellar asset limit");
const positiveUnits = cashOutUnitsSchema.refine((value) => value !== "0", "Enter an amount above zero");
const id = z.string().min(1).max(200);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime();
const utf8Length = (value: string) => Array.from(value).reduce((bytes, character) => {
  const point = character.codePointAt(0)!;
  return bytes + (point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4);
}, 0);

export const cashOutEnvironmentSchema = z.enum(["sandbox", "production"]);
export const cashOutNetworkSchema = z.enum(["stellar:testnet", "stellar:public"]);
export const cashOutMarketSchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  payoutMethod: z.enum(["cash_pickup", "bank", "mobile_money"]),
}).strict();

export const cashOutStatusSchema = z.enum([
  "identity_required", "awaiting_confirmation", "quote_expired", "awaiting_signature",
  "transfer_pending", "provider_processing", "ready_for_pickup", "paid",
  "failed", "refund_pending", "refunded", "refund_failed", "unknown",
]);

export const cashOutMoneySchema = z.object({
  currency: z.string().regex(/^[A-Z][A-Z0-9]{1,11}$/),
  units: z.string().max(38).regex(/^(0|[1-9][0-9]*)$/),
  decimals: z.number().int().min(0).max(18),
}).strict();

export const cashOutMemoSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }).strict(),
  z.object({ type: z.literal("text"), value: z.string()
    .max(28).refine((value) => utf8Length(value) <= 28, "Memo exceeds 28 bytes") }).strict(),
  z.object({ type: z.literal("id"), value: z.string().max(20).regex(/^(0|[1-9][0-9]*)$/)
    .refine((value) => value.length <= 20 && /^(0|[1-9][0-9]*)$/.test(value) && BigInt(value) <= 18446744073709551615n,
      "Memo exceeds the unsigned 64-bit limit") }).strict(),
  z.object({ type: z.literal("hash"), value: hash }).strict(),
]);

const context = {
  provider: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_-]*$/),
  environment: cashOutEnvironmentSchema,
  network: cashOutNetworkSchema,
  walletAddress: stellarWalletAddressSchema,
};

export const createCashOutInputSchema = z.object({
  requestId: z.string().uuid(),
  market: cashOutMarketSchema,
  debitUnits: positiveUnits,
}).strict();

export const cashOutSessionSchema = z.object({
  ...context,
  id,
  providerSessionId: id,
  expiresAt: timestamp,
}).strict();

export const cashOutQuoteSchema = z.object({
  ...context,
  id,
  cashOutId: id,
  sessionId: id,
  providerQuoteId: id,
  providerTransactionId: id,
  market: cashOutMarketSchema,
  debitUnits: positiveUnits,
  receive: cashOutMoneySchema.refine((money) => money.units !== "0", "Payout must be above zero"),
  fees: z.array(z.object({
    kind: z.enum(["provider", "network", "other"]),
    amount: cashOutMoneySchema,
    includedInDebit: z.boolean(),
  }).strict()).max(20),
  destinationLabel: z.string().min(1).max(200),
  createdAt: timestamp,
  expiresAt: timestamp,
}).strict().superRefine((quote, ctx) => {
  if (quote.receive.currency !== quote.market.currency) {
    ctx.addIssue({ code: "custom", path: ["receive", "currency"], message: "Payout currency does not match the market" });
  }
  if (Date.parse(quote.expiresAt) <= Date.parse(quote.createdAt)) {
    ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Quote must expire after creation" });
  }
});

export const cashOutTransferInstructionsSchema = z.object({
  ...context,
  cashOutId: id,
  quoteId: id,
  providerTransactionId: id,
  destination: stellarWalletAddressSchema,
  assetCode: z.literal("USDC"),
  assetIssuer: stellarWalletAddressSchema,
  amountUnits: positiveUnits,
  memo: cashOutMemoSchema,
  expiresAt: timestamp,
}).strict();

export const cashOutTransactionSchema = z.object({
  ...context,
  id,
  userId: id,
  requestId: z.string().uuid(),
  sessionId: id,
  market: cashOutMarketSchema,
  status: cashOutStatusSchema,
  providerTransactionId: id.optional(),
  providerCorrelationId: id.optional(),
  providerStatus: z.string().min(1).max(200).optional(),
  quoteId: id.optional(),
  debitUnits: positiveUnits,
  chainAttemptId: id.optional(),
  transactionHash: hash.optional(),
  associatedClaimId: id.optional(),
  refundTransactionHash: hash.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

export type CashOutEnvironment = z.infer<typeof cashOutEnvironmentSchema>;
export type CashOutNetwork = z.infer<typeof cashOutNetworkSchema>;
export type CashOutStatus = z.infer<typeof cashOutStatusSchema>;
export type CashOutMarket = z.infer<typeof cashOutMarketSchema>;
export type CashOutQuote = z.infer<typeof cashOutQuoteSchema>;
export type CashOutSession = z.infer<typeof cashOutSessionSchema>;
export type CashOutTransferInstructions = z.infer<typeof cashOutTransferInstructionsSchema>;
export type CashOutTransaction = z.infer<typeof cashOutTransactionSchema>;
export type CreateCashOutInput = z.infer<typeof createCashOutInputSchema>;
