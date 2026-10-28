import { Networks, StrKey, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { z } from "zod";
import { HttpError } from "../../utils/http-error.js";
import { amountUnits } from "../settlements/settlement-domain.js";

const horizon = "https://horizon-testnet.stellar.org";
const receiptSchema = z.object({ hash: z.string().regex(/^[a-f0-9]{64}$/), successful: z.boolean(),
  envelope_xdr: z.string().min(1).max(200000), ledger: z.number().int().positive().safe(), fee_charged: z.string().regex(/^(0|[1-9][0-9]*)$/).max(20) });
const ledgerSchema = z.object({ sequence: z.number().int().positive().safe(), closed_at: z.string().datetime() });
const accountSchema = z.object({ account_id: z.string(), sequence: z.string().regex(/^(0|[1-9][0-9]{0,18})$/),
  thresholds: z.object({ med_threshold: z.number().int().min(0).max(255) }),
  signers: z.array(z.object({ key: z.string().min(1).max(128), type: z.string().min(1).max(64), weight: z.number().int().min(0).max(255) })).min(1).max(20) }).passthrough();
export type CashOutReceipt = z.infer<typeof receiptSchema>;
export type CashOutLedger = z.infer<typeof ledgerSchema>;

const amount = z.string().max(32).regex(/^(0|[1-9][0-9]*)(\.[0-9]{1,7})?$/);
const readinessAccount = accountSchema.extend({
  subentry_count: z.number().int().nonnegative().safe(),
  num_sponsoring: z.number().int().nonnegative().safe(),
  num_sponsored: z.number().int().nonnegative().safe(),
  balances: z.array(z.object({ asset_type: z.string(), asset_code: z.string().optional(), asset_issuer: z.string().optional(),
    balance: amount, selling_liabilities: amount, is_authorized: z.boolean().optional() })).max(10000),
});
export function verifyCashOutReadiness(raw: unknown, issuer: string | undefined, debitUnits: string, reserveStroops: number, feeStroops: number, currentBaseFee: number) {
  const parsed = readinessAccount.safeParse(raw);
  if (!parsed.success || !issuer || !/^[1-9][0-9]{0,18}$/.test(debitUnits) ||
      !Number.isSafeInteger(reserveStroops) || reserveStroops <= 0 ||
      !Number.isSafeInteger(feeStroops) || feeStroops < 100 || feeStroops > 10000 ||
      !Number.isSafeInteger(currentBaseFee) || currentBaseFee < 100 || currentBaseFee > 10000)
    throw new HttpError(502, "Could not check your wallet balance.");
  if (feeStroops < currentBaseFee) throw new HttpError(409, "Network fee changed. Cancel and start again.");
  const account = parsed.data, matches = account.balances.filter((balance) => balance.asset_code === "USDC" && balance.asset_issuer === issuer);
  if (matches.length !== 1 || matches[0].is_authorized !== true) throw new HttpError(409, "Your wallet needs an active USDC trustline.");
  if (amountUnits(matches[0].balance) - amountUnits(matches[0].selling_liabilities) < BigInt(debitUnits))
    throw new HttpError(409, "Your wallet has insufficient spendable USDC.");
  const native = account.balances.filter((balance) => balance.asset_type === "native");
  const reserveEntries = 2 + account.subentry_count + account.num_sponsoring - account.num_sponsored;
  if (native.length !== 1 || !Number.isSafeInteger(reserveEntries) || reserveEntries < 0)
    throw new HttpError(502, "Could not check your wallet balance.");
  const spendable = amountUnits(native[0].balance) - amountUnits(native[0].selling_liabilities) - BigInt(reserveEntries) * BigInt(reserveStroops);
  if (spendable < BigInt(feeStroops)) throw new HttpError(409, "Add XLM to cover the network fee.");
}


export function verifyCashOutReceipt(expected: { transactionHash: string; walletAddress: string }, raw: unknown): CashOutReceipt {
  const parsed = receiptSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(502, "The transfer receipt cannot be verified");
  const receipt = parsed.data;
  try {
    const transaction = TransactionBuilder.fromXDR(receipt.envelope_xdr, Networks.TESTNET);
    if (!(transaction instanceof Transaction) || transaction.hash().toString("hex") !== expected.transactionHash ||
        receipt.hash !== expected.transactionHash || transaction.source !== expected.walletAddress) throw new Error("Receipt mismatch");
  } catch { throw new HttpError(502, "The transfer receipt cannot be verified"); }
  return receipt;
}
export function verifySavedCashOutEnvelope(expected: { transactionHash: string; walletAddress: string }, signedXdr: string) {
  try {
    const transaction = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
    if (!(transaction instanceof Transaction) || transaction.hash().toString("hex") !== expected.transactionHash ||
        transaction.source !== expected.walletAddress || transaction.signatures.length === 0) throw new Error("Envelope mismatch");
  } catch { throw new HttpError(409, "The saved transfer cannot be verified"); }
}
export function createCashOutChain(fetcher: typeof fetch = fetch) {
  async function read(path: string) {
    let response: Response;
    try { response = await fetcher(new URL(path, horizon), { redirect: "error", signal: AbortSignal.timeout(8000) }); }
    catch { throw new HttpError(502, "Unable to check the Stellar transfer"); }
    if (response.status === 404) return null;
    if (!response.ok) throw new HttpError(502, "Unable to check the Stellar transfer");
    try { return await response.json() as unknown; }
    catch { throw new HttpError(502, "Stellar returned an unreadable response"); }
  }
  async function ledger(order: "desc") {
    const body = await read(`/ledgers?order=${order}&limit=1`);
    const data = z.object({ _embedded: z.object({ records: z.array(ledgerSchema).length(1) }) }).safeParse(body);
    if (!data.success) throw new HttpError(502, "Unable to check the Stellar ledger");
    return data.data._embedded.records[0];
  }
  return {
    ledger: () => ledger("desc"),
    async account(walletAddress: string) {
      if (!StrKey.isValidEd25519PublicKey(walletAddress)) throw new HttpError(400, "Invalid wallet address");
      const result = accountSchema.safeParse(await read(`/accounts/${walletAddress}`));
      if (!result.success || result.data.account_id !== walletAddress || BigInt(result.data.sequence) >= 9223372036854775807n)
        throw new HttpError(502, "Unable to verify the Stellar wallet");
      return result.data;
    },
    async preparationLedger() {
      const body = await read("/ledgers?order=desc&limit=1");
      const schema = z.object({ _embedded: z.object({ records: z.array(ledgerSchema.extend({ base_fee_in_stroops: z.number().int().min(100).max(10000), base_reserve_in_stroops: z.number().int().positive().safe() })).length(1) }) });
      const result = schema.safeParse(body);
      if (!result.success) throw new HttpError(502, "Unable to verify the Stellar network fee");
      return result.data._embedded.records[0];
    },
    async historyCoverage() {
      const body = await read("/");
      const coverage = z.object({ history_elder_ledger: z.number().int().positive().safe(), history_latest_ledger: z.number().int().positive().safe(), history_latest_ledger_closed_at: z.string().datetime() }).safeParse(body);
      if (!coverage.success || coverage.data.history_elder_ledger > coverage.data.history_latest_ledger)
        throw new HttpError(502, "Unable to verify Stellar history coverage");
      return { start: coverage.data.history_elder_ledger, latest: coverage.data.history_latest_ledger, latestClosedAt: coverage.data.history_latest_ledger_closed_at };
    },
    async receipt(hash: string) {
      if (!/^[a-f0-9]{64}$/.test(hash)) throw new HttpError(400, "Invalid transfer reference");
      return read(`/transactions/${hash}`);
    },
    async submit(xdr: string) {
      try {
        const response = await fetcher(new URL("/transactions", horizon), { method: "POST", body: new URLSearchParams({ tx: xdr }), redirect: "error", signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error("Submission unresolved");
      } catch { throw new HttpError(502, "Waiting for transfer confirmation"); }
    },
  };
}
