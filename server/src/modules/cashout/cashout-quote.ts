import { createHash } from "node:crypto";
import { cashOutQuoteSchema, cashOutTransferInstructionsSchema, type CashOutQuote, type CashOutTransferInstructions, type RampOrder } from "@music-city/shared";
import { HttpError } from "../../utils/http-error.js";
import { prepareCashOutTransfer } from "./cashout-transfer.js";

export type CashOutQuoteSnapshot = { quote: CashOutQuote; instructions: CashOutTransferInstructions };
export function parseCashOutSnapshot(raw: unknown) {
  if (!raw || typeof raw !== "object" || !("quote" in raw) || !("instructions" in raw))
    throw new HttpError(409, "The saved quote is invalid");
  const snapshot: CashOutQuoteSnapshot = { quote: cashOutQuoteSchema.parse(raw.quote), instructions: cashOutTransferInstructionsSchema.parse(raw.instructions) };
  return { snapshot, hash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") };
}

// Only call this with a response fetched and authenticated by the server-side provider adapter.
export function validateCashOutQuote(order: RampOrder, rawQuote: unknown, rawInstructions: unknown, now = new Date()) {
  const quote = cashOutQuoteSchema.parse(rawQuote);
  const instructions = cashOutTransferInstructionsSchema.parse(rawInstructions);
  const terms = order.terms;
  if (terms.direction !== "sell" || terms.assetCode !== "USDC" || !terms.assetIssuer ||
      !order.providerTransactionId || quote.providerTransactionId !== order.providerTransactionId ||
      quote.cashOutId !== order.id || quote.provider !== terms.provider || quote.walletAddress !== terms.walletAddress ||
      quote.environment !== terms.environment || quote.network !== terms.network ||
      quote.debitUnits !== terms.amount.units || quote.market.country !== terms.market.country ||
      quote.market.currency !== terms.market.currency || quote.market.payoutMethod !== terms.market.method)
    throw new HttpError(409, "The provider quote does not match this transaction");
  // Reuse the transfer policy checks before saving the quote; no transaction is submitted here.
  prepareCashOutTransfer(instructions, quote, {
    provider: terms.provider, environment: terms.environment, network: terms.network,
    assetIssuer: terms.assetIssuer, walletAddress: terms.walletAddress, market: quote.market, maxFeeStroops: 100,
  }, "0", 100, now);
  const { snapshot, hash } = parseCashOutSnapshot({ quote, instructions });
  const expiresAt = new Date(Math.min(Date.parse(quote.expiresAt), Date.parse(instructions.expiresAt))).toISOString();
  return { snapshot, hash, expiresAt };
}
