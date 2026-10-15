import { createHash } from "node:crypto";
import type {
  RoyaltyLedgerEntry,
  SettlementBatch,
  SettlementConfig,
  TrackRoyaltySplitRecord,
} from "@music-city/shared";
import { HttpError } from "../../utils/http-error.js";
export const MAX_UNITS = 9223372036854775807n;
export function amountUnits(value: string): bigint {
  if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,7})?$/.test(value))
    throw new HttpError(409, "Amounts must have at most seven decimal places");
  const [whole, fraction = ""] = value.split(".");
  const result = BigInt(whole!) * 10_000_000n + BigInt(fraction.padEnd(7, "0"));
  if (result > MAX_UNITS)
    throw new HttpError(
      409,
      "Amount exceeds the supported Stellar asset limit",
    );
  return result;
}
export function formatUnits(value: bigint | string) {
  const amount = BigInt(value);
  return `${amount / 10_000_000n}.${(amount % 10_000_000n).toString().padStart(7, "0")}`;
}
export const financialHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function createSettlementPreview(
  entries: RoyaltyLedgerEntry[],
  split: TrackRoyaltySplitRecord,
  config: SettlementConfig,
  expiresAt: string,
  now = new Date(),
): SettlementBatch {
  if (!entries.length)
    throw new HttpError(409, "No earnings found for this source");
  const first = entries[0]!;
  const expiry = Date.parse(expiresAt);
  if (
    !Number.isFinite(expiry) ||
    expiry % 1000 !== 0 ||
    expiry <= now.getTime() + 600_000 ||
    expiry > now.getTime() + 604_800_000
  )
    throw new HttpError(
      400,
      "Choose a claim expiry between ten minutes and seven days, in whole seconds",
    );
  if (
    split.historical ||
    !split.agreementId ||
    !split.proposalHash ||
    !split.finalizationId ||
    split.registryKind !== "soroban" ||
    split.registryContractId !== config.registryId ||
    split.registryNetwork !==
      (config.networkPassphrase.includes("Test SDF")
        ? "stellar:testnet"
        : "stellar:public")
  )
    throw new HttpError(
      409,
      "Earnings require exact finalized evidence from the configured registry and network",
    );
  const feeBps = first.feeBps;
  if (feeBps === undefined)
    throw new HttpError(
      409,
      "Historical earnings lack captured fee terms and require explicit resolution",
    );
  if (
    entries.some(
      (e) =>
        e.trackId !== first.trackId ||
        e.sourceType !== first.sourceType ||
        e.sourceId !== first.sourceId ||
        e.splitId !== split.id ||
        e.status !== "approved" ||
        e.recipientChain !== "stellar" ||
        e.assetCode !== config.assetCode ||
        e.assetIssuer !== config.assetIssuer ||
        e.feeBps !== feeBps,
    )
  )
    throw new HttpError(
      409,
      "Source contains ineligible earnings, mixed assets, fees, or agreement versions",
    );
  if (
    new Set(entries.map((e) => e.id)).size !== entries.length ||
    new Set(entries.map((e) => e.recipientWalletAddress)).size !==
      entries.length
  )
    throw new HttpError(
      409,
      "Duplicate earnings allocations require reconciliation",
    );
  const gross = entries.reduce(
    (total, e) => total + amountUnits(e.grossAmount),
    0n,
  );
  if (gross <= 0n || gross > MAX_UNITS)
    throw new HttpError(409, "Unsupported source amount");
  let assigned = 0n;
  const allocations = split.recipients.map((recipient, index) => {
    const share =
      index === split.recipients.length - 1
        ? gross - assigned
        : (gross * BigInt(recipient.shareBps)) / 10000n;
    assigned += share;
    const fee = (share * BigInt(feeBps)) / 10000n;
    const matches = entries.filter(
      (e) =>
        e.recipientWalletAddress === recipient.walletAddress &&
        e.recipientRole === recipient.role,
    );
    if (matches.length !== 1 && share !== 0n)
      throw new HttpError(
        409,
        "Source is missing an approved recipient allocation",
      );
    if (
      matches.length &&
      (amountUnits(matches[0]!.grossAmount) !== share ||
        amountUnits(matches[0]!.netAmount) !== share - fee ||
        amountUnits(matches[0]!.feeAmount ?? "0") !== fee)
    )
      throw new HttpError(
        409,
        "Recorded allocation does not match its captured agreement and fee terms",
      );
    return {
      index,
      beneficiary: recipient.walletAddress,
      grossUnits: share.toString(),
      feeUnits: fee.toString(),
      amountUnits: (share - fee).toString(),
      ledgerEntryIds: matches.map((e) => e.id),
      status: "pending" as const,
    };
  });
  if (
    allocations.reduce((n, a) => n + a.ledgerEntryIds.length, 0) !==
    entries.length
  )
    throw new HttpError(409, "Unexpected recipient in earnings source");
  const sourceKey = financialHash([
    "music-city-revenue-v1",
    config.networkPassphrase,
    config.assetContractId,
    first.trackId,
    first.sourceType,
    first.sourceId,
  ]);
  const terms = {
    sourceKey,
    trackId: first.trackId,
    sourceType: first.sourceType,
    sourceId: first.sourceId,
    agreementId: split.agreementId,
    version: split.version,
    proposalHash: split.proposalHash,
    grossUnits: gross.toString(),
    feeBps,
    fundedUnits: allocations
      .reduce((n, a) => n + BigInt(a.amountUnits), 0n)
      .toString(),
    expiresAt,
    config,
    allocations,
  };
  const timestamp = now.toISOString();
  return {
    id: financialHash(["music-city-settlement-v1", terms]),
    ...terms,
    state: "reserved",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
export function assertConservation(batch: SettlementBatch) {
  const allocated = batch.allocations.reduce(
    (n, a) => n + BigInt(a.amountUnits),
    0n,
  );
  if (allocated !== BigInt(batch.fundedUnits))
    throw new HttpError(409, "Settlement conservation failed");
}
