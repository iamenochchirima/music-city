import { createHash } from "node:crypto";
import {
  Account,
  Asset,
  Keypair,
  Memo,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type { SupportPayment } from "@music-city/shared";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";
import { amountUnits, formatUnits } from "../settlements/settlement-domain.js";

type Balance = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  selling_liabilities?: string;
  buying_liabilities?: string;
  limit?: string;
  is_authorized?: boolean;
};
export type SupportAccount = {
  account_id: string;
  sequence: string;
  subentry_count: number;
  num_sponsoring?: number;
  num_sponsored?: number;
  balances: Balance[];
  thresholds: { med_threshold: number };
  signers: { key: string; weight: number; type: string }[];
};
export type SupportLedger = {
  sequence: number;
  closed_at: string;
  base_reserve_in_stroops: number;
  base_fee_in_stroops: number;
};
export type SupportReceipt = {
  hash: string;
  successful: boolean;
  envelope_xdr: string;
  ledger: number;
  fee_charged: string;
};
async function horizon(path: string) {
  return fetch(`${env.STELLAR_HORIZON_URL}${path}`, {
    signal: AbortSignal.timeout(15000),
  });
}
export function supportConfig() {
  const networkPassphrase = env.STELLAR_NETWORK_PASSPHRASE;
  if (
    !(
      networkPassphrase === Networks.TESTNET ||
      networkPassphrase === Networks.PUBLIC
    ) ||
    env.STELLAR_SETTLEMENT_ASSET_CODE !== "USDC" ||
    !env.STELLAR_SETTLEMENT_ASSET_ISSUER ||
    !StrKey.isValidEd25519PublicKey(env.STELLAR_SETTLEMENT_ASSET_ISSUER)
  )
    throw new HttpError(503, "USDC support is not configured");
  return {
    networkPassphrase,
    assetCode: "USDC" as const,
    assetIssuer: env.STELLAR_SETTLEMENT_ASSET_ISSUER,
  };
}
export function assertSupportNetwork(payment: SupportPayment) {
  const config = supportConfig();
  if (
    config.networkPassphrase !== payment.networkPassphrase ||
    config.assetIssuer !== payment.assetIssuer
  )
    throw new HttpError(
      503,
      "This payment’s network configuration is unavailable",
    );
}
export function validateSupportReadiness(
  account: SupportAccount,
  issuer: string,
  units: bigint,
  incoming: boolean,
  ledger: SupportLedger,
) {
  const line = account.balances.find(
    (b) => b.asset_code === "USDC" && b.asset_issuer === issuer,
  );
  const whose = incoming ? "The recipient" : "Your wallet";
  if (!line) throw new HttpError(409, `${whose} needs a USDC trustline`);
  if (line.is_authorized === false)
    throw new HttpError(409, `${whose} is not authorized to receive USDC`);
  const available = incoming
    ? amountUnits(line.limit ?? "0") -
      amountUnits(line.balance) -
      amountUnits(line.buying_liabilities ?? "0")
    : amountUnits(line.balance) - amountUnits(line.selling_liabilities ?? "0");
  if (available < units)
    throw new HttpError(
      409,
      incoming
        ? "The recipient’s USDC limit is too low"
        : "Your wallet has insufficient USDC",
    );
  if (!incoming) {
    const native = account.balances.find((b) => b.asset_type === "native");
    if (
      !native ||
      !Number.isSafeInteger(ledger.base_reserve_in_stroops) ||
      ledger.base_reserve_in_stroops <= 0 ||
      !Number.isSafeInteger(account.subentry_count)
    )
      throw new HttpError(
        502,
        "Could not verify the XLM required for this payment",
      );
    const reserve =
      BigInt(
        2 +
          account.subentry_count +
          (account.num_sponsoring ?? 0) -
          (account.num_sponsored ?? 0),
      ) * BigInt(ledger.base_reserve_in_stroops);
    if (
      amountUnits(native.balance) -
        amountUnits(native.selling_liabilities ?? "0") -
        reserve <
      BigInt(supportFee(ledger))
    )
      throw new HttpError(
        409,
        "Add XLM to cover the network fee above your wallet reserve",
      );
  }
}
function supportFee(ledger: SupportLedger) {
  if (
    !Number.isSafeInteger(ledger.base_fee_in_stroops) ||
    ledger.base_fee_in_stroops <= 0 ||
    ledger.base_fee_in_stroops > 10000
  )
    throw new HttpError(
      503,
      "Network fees are unusually high. Try again later",
    );
  return String(ledger.base_fee_in_stroops);
}
export function buildSupportTransaction(
  id: string,
  sender: string,
  recipient: string,
  amount: string,
  sequence: string,
  ledger: SupportLedger,
  now = Date.now(),
) {
  const config = supportConfig();
  const maxTime = Math.floor(now / 1000) + 300;
  const tx = new TransactionBuilder(new Account(sender, sequence), {
    fee: supportFee(ledger),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: recipient,
        asset: new Asset("USDC", config.assetIssuer),
        amount: formatUnits(amountUnits(amount)),
      }),
    )
    .addMemo(
      Memo.hash(
        createHash("sha256").update(`music-city-support:${id}`).digest(),
      ),
    )
    .setTimebounds(0, maxTime)
    .build();
  return {
    transaction: tx.toXDR(),
    transactionHash: tx.hash().toString("hex"),
    expiresAt: new Date(maxTime * 1000).toISOString(),
    ...config,
  };
}
export function verifySupportSignature(
  payment: Pick<SupportPayment, "networkPassphrase" | "sender" | "transactionHash">,
  signedXdr: string,
  account: SupportAccount,
) {
  let tx;
  try {
    tx = TransactionBuilder.fromXDR(signedXdr, payment.networkPassphrase);
  } catch {
    throw new HttpError(400, "The wallet returned an invalid transaction");
  }
  if (
    !(tx instanceof Transaction) ||
    tx.source !== payment.sender ||
    tx.hash().toString("hex") !== payment.transactionHash
  )
    throw new HttpError(
      400,
      "Sign the exact support payment shown in your review",
    );
  const signedBy = new Set<string>();
  for (const signature of tx.signatures) {
    const signer = account.signers.find(
      (s) =>
        s.type === "ed25519_public_key" &&
        s.weight > 0 &&
        Keypair.fromPublicKey(s.key).verify(tx.hash(), signature.signature()),
    );
    if (!signer || signedBy.has(signer.key))
      throw new HttpError(
        403,
        "The wallet signature does not authorize this payment",
      );
    signedBy.add(signer.key);
  }
  const weight = account.signers
    .filter((s) => signedBy.has(s.key))
    .reduce((n, s) => n + s.weight, 0);
  if (
    account.account_id !== payment.sender ||
    !Number.isInteger(account.thresholds.med_threshold) ||
    weight < Math.max(1, account.thresholds.med_threshold)
  )
    throw new HttpError(
      403,
      "More wallet authorization is required for this payment",
    );
  return tx.toXDR();
}
export function verifySupportReceipt(
  payment: SupportPayment,
  receipt: SupportReceipt,
) {
  const tx = TransactionBuilder.fromXDR(
    receipt.envelope_xdr,
    payment.networkPassphrase,
  );
  if (
    !(tx instanceof Transaction) ||
    receipt.hash !== payment.transactionHash ||
    tx.hash().toString("hex") !== payment.transactionHash ||
    tx.source !== payment.sender ||
    !Number.isSafeInteger(receipt.ledger) ||
    receipt.ledger <= 0 ||
    !/^\d+$/.test(receipt.fee_charged)
  )
    throw new HttpError(502, "Payment confirmation could not be verified");
}
export const supportChain = {
  async account(wallet: string): Promise<SupportAccount> {
    const response = await horizon(`/accounts/${encodeURIComponent(wallet)}`);
    if (response.status === 404)
      throw new HttpError(
        409,
        "Fund the Stellar wallet with XLM before sending support",
      );
    if (!response.ok)
      throw new HttpError(502, "Could not check the wallet. Try again");
    return response.json() as Promise<SupportAccount>;
  },
  async ledger(): Promise<SupportLedger> {
    const response = await horizon("/ledgers?order=desc&limit=1");
    if (!response.ok)
      throw new HttpError(502, "Could not check the Stellar network");
    const payload = (await response.json()) as {
      _embedded: { records: SupportLedger[] };
    };
    const ledger = payload._embedded?.records[0];
    if (
      !ledger ||
      !Number.isSafeInteger(ledger.sequence) ||
      !Number.isFinite(Date.parse(ledger.closed_at))
    )
      throw new HttpError(502, "Could not verify the latest Stellar ledger");
    return ledger;
  },
  async historyStart(): Promise<number> {
    const response = await horizon("/ledgers?order=asc&limit=1");
    if (!response.ok)
      throw new HttpError(502, "Could not verify payment history coverage");
    const payload = (await response.json()) as {
      _embedded: { records: { sequence: number }[] };
    };
    const sequence = payload._embedded?.records[0]?.sequence;
    if (!sequence || !Number.isSafeInteger(sequence))
      throw new HttpError(502, "Could not verify payment history coverage");
    return sequence;
  },
  async receipt(hash: string): Promise<SupportReceipt | null> {
    const response = await horizon(`/transactions/${encodeURIComponent(hash)}`);
    if (response.status === 404) return null;
    if (!response.ok)
      throw new HttpError(502, "Waiting for payment confirmation");
    return response.json() as Promise<SupportReceipt>;
  },
  async submit(signed: string) {
    const response = await fetch(`${env.STELLAR_HORIZON_URL}/transactions`, {
      method: "POST",
      body: new URLSearchParams({ tx: signed }),
      signal: AbortSignal.timeout(15000),
    });
    // Even rejection or timeout is reconciled against the original hash before releasing the sender.
    if (!response.ok)
      throw new HttpError(
        502,
        "Waiting for payment confirmation. Do not send again",
      );
  },
};
