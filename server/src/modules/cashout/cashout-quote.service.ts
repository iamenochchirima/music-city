import type { RampOrder } from "@music-city/shared";
import { HttpError } from "../../utils/http-error.js";
import type { createRampRepository } from "../ramps/ramp.repository.js";

// Adapters authenticate their own provider requests and return raw responses for validation.
export type CashOutQuoteProvider = { quote(order: RampOrder): Promise<{ quote: unknown; instructions: unknown }> };
type Repository = Pick<ReturnType<typeof createRampRepository>, "getForOwner" | "saveCashOutQuote" | "getCashOutQuote">;
type Owner = { userId: string; walletAddress: string };
export function createCashOutQuoteService(repository: Repository, providers: ReadonlyMap<string, CashOutQuoteProvider>, now: () => Date = () => new Date(), canQuote: (order: RampOrder) => Promise<boolean> = async () => false) {
  return {
    async request(orderId: string, owner: Owner) {
      const order = await repository.getForOwner(orderId, owner.userId, owner.walletAddress);
      if (!order) throw new HttpError(404, "Transaction not found");
      if (order.terms.direction !== "sell" || !order.providerTransactionId || !["created", "awaiting_user", "processing"].includes(order.providerState)) throw new HttpError(409, "This transaction is not ready for a quote");
      const provider = providers.get(order.terms.provider);
      if (!provider || !await canQuote(order)) throw new HttpError(503, "Cash-out is not available yet");
      const { quote, instructions } = await provider.quote(order);
      if (!await canQuote(order)) throw new HttpError(503, "Cash-out is not available yet");
      return repository.saveCashOutQuote(order.id, owner.userId, owner.walletAddress, quote, instructions, now());
    },
    async get(orderId: string, quoteId: string, owner: Owner) {
      const result = await repository.getCashOutQuote(orderId, quoteId, owner.userId, owner.walletAddress);
      if (!result) throw new HttpError(404, "Quote not found");
      return result;
    },
  };
}
