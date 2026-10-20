import { Account, Asset, Keypair, Memo, Networks, Operation, StrKey, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  cashOutQuoteSchema,
  cashOutTransferInstructionsSchema,
  type CashOutEnvironment,
  type CashOutMarket,
  type CashOutNetwork,
} from "@music-city/shared";
import { formatUnits } from "../settlements/settlement-domain.js";
import { HttpError } from "../../utils/http-error.js";

export type CashOutTransferPolicy = {
  provider: string;
  environment: CashOutEnvironment;
  network: CashOutNetwork;
  assetIssuer: string;
  walletAddress: string;
  market: CashOutMarket;
  maxFeeStroops: number;
};

// Instructions must come from an authenticated provider response, never a widget message alone.
export function prepareCashOutTransfer(
  rawInstructions: unknown,
  rawQuote: unknown,
  policy: CashOutTransferPolicy,
  accountSequence: string,
  feeStroops: number,
  now = new Date(),
) {
  const instructions = cashOutTransferInstructionsSchema.parse(rawInstructions);
  const quote = cashOutQuoteSchema.parse(rawQuote);
  const expires = Math.floor(Math.min(
    Date.parse(instructions.expiresAt), Date.parse(quote.expiresAt), now.getTime() + 300_000,
  ) / 1000);
  if (!Number.isFinite(now.getTime()) || Date.parse(quote.createdAt) > now.getTime() ||
    expires <= Math.floor(now.getTime() / 1000)) {
    throw new HttpError(409, "Get a new quote before authorizing this payment");
  }
  if (quote.cashOutId !== instructions.cashOutId || quote.id !== instructions.quoteId || quote.providerTransactionId !== instructions.providerTransactionId ||
    instructions.amountUnits !== quote.debitUnits ||
    instructions.assetIssuer !== policy.assetIssuer ||
    quote.market.country !== policy.market.country || quote.market.currency !== policy.market.currency ||
    quote.market.payoutMethod !== policy.market.payoutMethod ||
    (["provider", "environment", "network", "walletAddress"] as const).some(
      (key) => quote[key] !== policy[key] || instructions[key] !== policy[key],
    )) {
    throw new HttpError(409, "Payment instructions do not match the approved quote and wallet");
  }
  if (![policy.walletAddress, policy.assetIssuer, instructions.destination].every(
    (address) => StrKey.isValidEd25519PublicKey(address),
  ) || instructions.destination === policy.walletAddress) {
    throw new HttpError(409, "Payment instructions contain an invalid destination or asset");
  }
  if (!Number.isSafeInteger(feeStroops) || !Number.isSafeInteger(policy.maxFeeStroops) ||
    feeStroops < 100 || feeStroops > policy.maxFeeStroops || policy.maxFeeStroops > 4294967295) {
    throw new HttpError(409, "Network fee exceeds the approved limit");
  }
  if (!/^(0|[1-9][0-9]{0,18})$/.test(accountSequence) || BigInt(accountSequence) >= 9223372036854775807n) {
    throw new HttpError(409, "Reload the wallet before authorizing this payment");
  }
  const memo = instructions.memo;
  const stellarMemo = memo.type === "none" ? Memo.none()
    : memo.type === "text" ? Memo.text(memo.value)
      : memo.type === "id" ? Memo.id(memo.value)
        : Memo.hash(Buffer.from(memo.value, "hex"));
  const networkPassphrase = policy.network === "stellar:testnet" ? Networks.TESTNET : Networks.PUBLIC;
  const transaction = new TransactionBuilder(new Account(policy.walletAddress, accountSequence), {
    fee: String(feeStroops), networkPassphrase,
  }).addOperation(Operation.payment({
    destination: instructions.destination,
    asset: new Asset("USDC", policy.assetIssuer),
    amount: formatUnits(instructions.amountUnits),
  })).addMemo(stellarMemo).setTimebounds(0, expires).build();
  return {
    transaction: transaction.toXDR(),
    transactionHash: transaction.hash().toString("hex"),
    networkPassphrase,
    expiresAt: new Date(expires * 1000).toISOString(),
  };
}

export type CashOutSigningAccount = {
  account_id: string;
  thresholds: { med_threshold: number };
  signers: { key: string; type: string; weight: number }[];
};

export function verifyCashOutEnvelope(
  prepared: ReturnType<typeof prepareCashOutTransfer>,
  signedXdr: string,
  account: CashOutSigningAccount,
  now = new Date(),
) {
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(Date.parse(prepared.expiresAt)) ||
    Date.parse(prepared.expiresAt) <= now.getTime()) {
    throw new HttpError(409, "Reconcile the expired payment before trying again");
  }
  if (typeof signedXdr !== "string" || signedXdr.length > 200_000) {
    throw new HttpError(400, "The wallet returned an invalid transaction");
  }
  let expected;
  let signed;
  try {
    expected = TransactionBuilder.fromXDR(prepared.transaction, prepared.networkPassphrase);
    signed = TransactionBuilder.fromXDR(signedXdr, prepared.networkPassphrase);
  } catch {
    throw new HttpError(400, "The wallet returned an invalid transaction");
  }
  if (!(expected instanceof Transaction) || !(signed instanceof Transaction) ||
    expected.hash().toString("hex") !== prepared.transactionHash ||
    !signed.hash().equals(expected.hash()) || signed.source !== account.account_id) {
    throw new HttpError(400, "Authorize the exact cash-out payment shown in your review");
  }
  const threshold = account.thresholds.med_threshold;
  const signers = account.signers.filter((signer) => signer.weight > 0 && signer.type === "ed25519_public_key");
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 255 ||
    new Set(signers.map((signer) => signer.key)).size !== signers.length ||
    signers.some((signer) => !Number.isInteger(signer.weight) || signer.weight > 255 ||
      !StrKey.isValidEd25519PublicKey(signer.key))) {
    throw new HttpError(409, "Reload the wallet authorization settings");
  }
  const signedBy = new Set<string>();
  let weight = 0;
  for (const signature of signed.signatures) {
    if (signature.signature().length !== 64) {
      throw new HttpError(403, "The wallet signature does not authorize this payment");
    }
    const signer = signers.find((candidate) =>
      Keypair.fromPublicKey(candidate.key).verify(signed.hash(), signature.signature()),
    );
    if (!signer || signedBy.has(signer.key)) {
      throw new HttpError(403, "The wallet signature does not authorize this payment");
    }
    signedBy.add(signer.key);
    weight += signer.weight;
  }
  if (weight < threshold) throw new HttpError(403, "More wallet authorization is required for this payment");
  return signed.toXDR();
}
