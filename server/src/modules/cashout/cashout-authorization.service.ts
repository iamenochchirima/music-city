import type { createRampRepository } from "../ramps/ramp.repository.js";
import { verifyCashOutReadiness, type createCashOutChain } from "./cashout-chain.js";
import type { createCashOutEnvelopeCipher } from "./cashout-envelope.js";
import { HttpError } from "../../utils/http-error.js";
import type { RampOrder } from "@music-city/shared";

type Repository = Pick<ReturnType<typeof createRampRepository>, "getForOwner" | "getCashOutQuote" | "latestCashOutAttempt" | "prepareCashOutAttempt" | "authorizeCashOutAttempt" | "cancelUnsignedCashOutAttempt">;
type Chain = Pick<ReturnType<typeof createCashOutChain>, "account" | "preparationLedger">;
type Owner = { userId: string; walletAddress: string };

export function createCashOutAuthorizationService(repository: Repository, chain: Chain, cipher: ReturnType<typeof createCashOutEnvelopeCipher>, canPrepare: (order: RampOrder) => Promise<boolean> = async () => false) {
  async function checkOrder(orderId: string, owner: Owner) {
    const order = await repository.getForOwner(orderId, owner.userId, owner.walletAddress);
    if (!order) throw new HttpError(404, "Transaction not found");
    if (order.terms.direction !== "sell" || order.terms.environment !== "sandbox" || order.terms.network !== "stellar:testnet")
      throw new HttpError(409, "This cash-out is not available on the test network");
    return order;
  }
  async function checkBalance(order: RampOrder, walletAddress: string, feeStroops?: number) {
    const ledger = await chain.preparationLedger();
    const account = await chain.account(walletAddress);
    verifyCashOutReadiness(account, order.terms.assetIssuer, order.terms.amount.units,
      ledger.base_reserve_in_stroops, feeStroops ?? ledger.base_fee_in_stroops, ledger.base_fee_in_stroops);
    return { ledger, account };
  }
  return {
    async prepare(orderId: string, quoteId: string, confirmationHash: string, owner: Owner) {
      const order = await checkOrder(orderId, owner);
      if (!await canPrepare(order)) throw new HttpError(503, "Cash-out is not available yet");
      const quote = await repository.getCashOutQuote(orderId, quoteId, owner.userId, owner.walletAddress);
      if (!quote) throw new HttpError(404, "Quote not found");
      if (quote.hash !== confirmationHash) throw new HttpError(409, "Review the current quote before continuing");
      // Read the ledger first so history coverage begins no later than the account read.
      const { ledger, account } = await checkBalance(order, owner.walletAddress);
      return repository.prepareCashOutAttempt({ orderId, quoteId, confirmationHash, ...owner, sequence: account.sequence,
        feeStroops: ledger.base_fee_in_stroops, maxFeeStroops: 10000, preparedLedger: ledger.sequence });
    },
    async latest(orderId: string, owner: Owner) {
      const order = await checkOrder(orderId, owner);
      const attempt = await repository.latestCashOutAttempt(orderId, owner.userId, owner.walletAddress);
      if (attempt?.state === "prepared" && attempt.transaction) {
        if (!await canPrepare(order)) return { ...attempt, transaction: null, unavailableReason: "This cash-out is no longer available." };
        try { await checkBalance(order, owner.walletAddress, Number(attempt.networkFeeStroops)); }
        catch (error) { return { ...attempt, transaction: null, unavailableReason: error instanceof HttpError && error.statusCode === 409 ? error.message : "Could not check your wallet balance." }; }
      }
      return attempt;
    },
    async authorize(orderId: string, attemptId: string, signedXdr: string, owner: Owner) {
      const order = await checkOrder(orderId, owner);
      if (!await canPrepare(order)) throw new HttpError(503, "Cash-out is not available yet");
      const attempt = await repository.latestCashOutAttempt(orderId, owner.userId, owner.walletAddress);
      if (!attempt || attempt.id !== attemptId) throw new HttpError(404, "Transfer not found");
      const account = attempt.state === "prepared"
        ? (await checkBalance(order, owner.walletAddress, Number(attempt.networkFeeStroops))).account
        : await chain.account(owner.walletAddress);
      return repository.authorizeCashOutAttempt({ orderId, attemptId, signedXdr, ...owner, account, cipher });
    },
    async cancel(orderId: string, attemptId: string, owner: Owner) {
      await checkOrder(orderId, owner);
      await repository.cancelUnsignedCashOutAttempt(orderId, attemptId, owner.userId, owner.walletAddress);
    },
  };
}
