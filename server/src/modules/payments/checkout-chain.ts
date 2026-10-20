import {
  Account,
  Asset,
  Memo,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type { CheckoutAttempt, PaymentIntentRecord } from "@music-city/shared";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";
import { amountUnits, formatUnits } from "../settlements/settlement-domain.js";
import {
  supportChain,
  validateSupportReadiness,
  type SupportAccount,
  type SupportLedger,
  type SupportReceipt,
} from "../support/support-chain.js";

export const checkoutChain = { ...supportChain };

export function buildCheckoutTransaction(
  intent: PaymentIntentRecord,
  source: SupportAccount,
  destination: SupportAccount,
  ledger: SupportLedger,
  now = Date.now(),
) {
  if (
    intent.networkPassphrase !== env.STELLAR_NETWORK_PASSPHRASE ||
    (intent.networkPassphrase !== Networks.TESTNET &&
      intent.networkPassphrase !== Networks.PUBLIC) ||
    source.account_id !== intent.walletAddress ||
    destination.account_id !== intent.destinationAddress ||
    source.account_id === destination.account_id ||
    !StrKey.isValidEd25519PublicKey(intent.walletAddress) ||
    !StrKey.isValidEd25519PublicKey(intent.destinationAddress)
  ) {
    throw new HttpError(
      409,
      "Connect the wallet and network used for this payment",
    );
  }
  const amount = amountUnits(intent.amount);
  if (
    amount <= 0n ||
    !Number.isSafeInteger(ledger.base_fee_in_stroops) ||
    ledger.base_fee_in_stroops < 100 ||
    ledger.base_fee_in_stroops > 10000
  ) {
    throw new HttpError(
      409,
      "The payment amount or network fee is unavailable",
    );
  }
  const native = intent.assetCode === "XLM" && !intent.assetIssuer;
  if (!native) {
    if (
      intent.assetCode !== "USDC" ||
      intent.assetIssuer !== env.STELLAR_SETTLEMENT_ASSET_ISSUER
    ) {
      throw new HttpError(409, "This payment asset is not supported");
    }
    validateSupportReadiness(
      source,
      intent.assetIssuer!,
      amount,
      false,
      ledger,
    );
    validateSupportReadiness(
      destination,
      intent.assetIssuer!,
      amount,
      true,
      ledger,
    );
  } else {
    const balance = source.balances.find(
      (line) => line.asset_type === "native",
    );
    const reserve =
      BigInt(
        2 +
          source.subentry_count +
          (source.num_sponsoring ?? 0) -
          (source.num_sponsored ?? 0),
      ) * BigInt(ledger.base_reserve_in_stroops);
    if (
      !balance ||
      amountUnits(balance.balance) -
        amountUnits(balance.selling_liabilities ?? "0") -
        reserve <
        amount + BigInt(ledger.base_fee_in_stroops)
    ) {
      throw new HttpError(
        409,
        "Add XLM to cover this payment and your wallet reserve",
      );
    }
  }
  const maxTime = Math.floor(
    Math.min(Date.parse(intent.expiresAt), now + 300_000) / 1000,
  );
  if (!Number.isFinite(maxTime) || maxTime <= Math.floor(now / 1000))
    throw new HttpError(409, "This payment has expired");
  if (Buffer.byteLength(intent.memo, "utf8") > 28)
    throw new HttpError(409, "Create a new payment before continuing");
  const transaction = new TransactionBuilder(
    new Account(intent.walletAddress, source.sequence),
    {
      fee: String(ledger.base_fee_in_stroops),
      networkPassphrase: intent.networkPassphrase,
    },
  )
    .addOperation(
      Operation.payment({
        destination: intent.destinationAddress,
        asset: native
          ? Asset.native()
          : new Asset(intent.assetCode, intent.assetIssuer!),
        amount: formatUnits(amount),
      }),
    )
    .addMemo(Memo.text(intent.memo))
    .setTimebounds(0, maxTime)
    .build();
  return {
    transaction: transaction.toXDR(),
    transactionHash: transaction.hash().toString("hex"),
    expiresAt: new Date(maxTime * 1000).toISOString(),
  };
}

export function verifyCheckoutReceipt(
  attempt: CheckoutAttempt,
  receipt: SupportReceipt,
) {
  const decoded = TransactionBuilder.fromXDR(
    receipt.envelope_xdr,
    attempt.networkPassphrase,
  );
  if (
    !(decoded instanceof Transaction) ||
    receipt.hash !== attempt.transactionHash ||
    decoded.hash().toString("hex") !== attempt.transactionHash ||
    decoded.source !== attempt.walletAddress ||
    !Number.isSafeInteger(receipt.ledger) ||
    receipt.ledger <= 0 ||
    !/^\d+$/.test(receipt.fee_charged)
  ) {
    throw new HttpError(
      409,
      "The payment receipt does not match this checkout",
    );
  }
}
