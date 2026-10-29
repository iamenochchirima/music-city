import {
  Networks,
  TransactionBuilder,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import type { SettlementConfig } from "@music-city/shared";
import { HttpError } from "../../utils/http-error.js";
import type { ChainBatch } from "./settlement-chain.js";

const explorerBase = "https://api.stellar.expert/explorer";
const pageSize = 100;
const maximumEvents = 10_000;

export function shouldBackfillSettlementEvents(
  deploymentLedger: number,
  oldestAvailableLedger: number,
  cursor?: string,
) {
  return deploymentLedger < oldestAvailableLedger && !cursor?.startsWith("rpc:");
}

type ExplorerEvent = {
  id: string;
  contract: string;
  initiator: string;
  ts: number;
  topicsXdr: string[];
  bodyXdr: string;
};

type HorizonTransaction = {
  hash: string;
  paging_token: string;
  ledger: number;
  successful: boolean;
  source_account: string;
  fee_charged: string;
  envelope_xdr: string;
  result_xdr: string;
};

export type IndexedSettlementEvent = {
  id: string;
  transactionHash: string;
  ledger: number;
  batchId: string;
  type: string;
  payload: {
    topics: string[];
    value: string;
    ledgerClosedAt: string;
    receipt: { ledger: number; feeCharged: string; envelope: string };
  };
};

type Fetcher = typeof fetch;
type JsonPage<T> = {
  _embedded?: { records?: T[] };
  _links?: { next?: { href?: string } };
};

async function json<T>(url: string, fetcher: Fetcher): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new HttpError(502, "Historical settlement evidence is unavailable");
  }
  if (!response.ok)
    throw new HttpError(502, "Historical settlement evidence is unavailable");
  try {
    return (await response.json()) as T;
  } catch {
    throw new HttpError(502, "Historical settlement evidence is invalid");
  }
}

function eventLedger(event: ExplorerEvent) {
  const match = /^(\d+)-(\d{4})$/.exec(event.id);
  if (!match || Number(match[2]) < 1)
    throw new HttpError(409, "Historical event cursor format is unsupported");
  const ledger = BigInt(match[1]!) >> 32n;
  if (ledger <= 0n || ledger > BigInt(Number.MAX_SAFE_INTEGER))
    throw new HttpError(409, "Historical event ledger is invalid");
  const transactionCursor = (BigInt(match[1]!) - 1n).toString();
  const eventIndex = BigInt(match[2]!);
  return {
    ledger: Number(ledger),
    transactionCursor,
    // Soroban RPC cursors use the Horizon transaction paging token and pad
    // both cursor components. Reuse this canonical ID so backfill and live
    // indexing deduplicate to one row for the same contract event.
    rpcEventId: `${transactionCursor.padStart(19, "0")}-${eventIndex.toString().padStart(10, "0")}`,
  };
}

function decodedTopics(event: ExplorerEvent) {
  if (!Array.isArray(event.topicsXdr) || event.topicsXdr.length < 3)
    throw new HttpError(409, "Historical settlement event topics are invalid");
  try {
    return event.topicsXdr.map((topic) =>
      xdr.ScVal.fromXDR(topic, "base64"),
    );
  } catch {
    throw new HttpError(409, "Historical settlement event topics are invalid");
  }
}

async function horizonTransactions(
  horizonUrl: string,
  ledger: number,
  fetcher: Fetcher,
) {
  const transactions: HorizonTransaction[] = [];
  let url = `${horizonUrl.replace(/\/$/, "")}/ledgers/${ledger}/transactions?limit=200&order=asc`;
  for (let page = 0; page < 10; page += 1) {
    const result = await json<JsonPage<HorizonTransaction>>(url, fetcher);
    const records = result._embedded?.records;
    if (!Array.isArray(records))
      throw new HttpError(502, "Historical transaction evidence is incomplete");
    transactions.push(...records);
    if (transactions.length > 2_000)
      throw new HttpError(409, "Historical ledger exceeds the verification limit");
    if (records.length < 200) return transactions;
    const next = result._links?.next?.href;
    if (!next) return transactions;
    const parsed = new URL(next, horizonUrl);
    if (parsed.origin !== new URL(horizonUrl).origin)
      throw new HttpError(409, "Historical transaction page is outside the Horizon origin");
    url = parsed.toString();
  }
  throw new HttpError(409, "Historical ledger pagination exceeded the safety limit");
}

async function verifyTransaction(
  event: ExplorerEvent,
  ledger: number,
  transactionCursor: string,
  config: SettlementConfig,
  horizonUrl: string,
  fetcher: Fetcher,
) {
  const transactions = await horizonTransactions(horizonUrl, ledger, fetcher);
  const tx = transactions.find((candidate) => candidate.paging_token === transactionCursor);
  if (
    !tx ||
    tx.ledger !== ledger ||
    tx.source_account !== event.initiator ||
    !tx.successful ||
    !/^[a-f0-9]{64}$/.test(tx.hash) ||
    !tx.envelope_xdr ||
    !tx.result_xdr
  )
    throw new HttpError(409, "Historical event has no matching successful transaction");

  try {
    if (
      TransactionBuilder.fromXDR(tx.envelope_xdr, config.networkPassphrase)
        .hash()
        .toString("hex") !== tx.hash
    )
      throw new Error("hash mismatch");
    const fee = xdr.TransactionResult.fromXDR(tx.result_xdr, "base64")
      .feeCharged()
      .toString();
    if (fee !== tx.fee_charged)
      throw new Error("fee mismatch");
  } catch {
    throw new HttpError(409, "Historical transaction receipt failed verification");
  }

  const operations = await json<JsonPage<Record<string, unknown>>>(
    `${horizonUrl.replace(/\/$/, "")}/transactions/${encodeURIComponent(tx.hash)}/operations?limit=200&order=asc`,
    fetcher,
  );
  const records = operations._embedded?.records;
  if (!Array.isArray(records))
    throw new HttpError(502, "Historical contract-call evidence is incomplete");
  const topics = decodedTopics(event);
  const eventName = scValToNative(topics[1]!);
  const expectedMethods =
    eventName === "settlement_funded"
      ? ["settle"]
      : eventName === "claim_consumed"
        ? ["claim", "reclaim"]
        : undefined;
  if (!expectedMethods || topics.length !== (eventName === "settlement_funded" ? 3 : 4))
    throw new HttpError(409, "Historical settlement event type is unsupported");

  let contractCall: Record<string, unknown> | undefined;
  for (const candidate of records) {
    const operation = candidate as {
      type?: string;
      function?: string;
      parameters?: { value?: string }[];
    };
    if (
      operation.type !== "invoke_host_function" ||
      !operation.function?.includes("InvokeContract") ||
      !operation.parameters?.[0]?.value ||
      !operation.parameters?.[1]?.value
    )
      continue;
    try {
      const contract = scValToNative(
        xdr.ScVal.fromXDR(operation.parameters[0].value, "base64"),
      );
      const method = scValToNative(
        xdr.ScVal.fromXDR(operation.parameters[1].value, "base64"),
      );
      if (contract === config.contractId && expectedMethods.includes(String(method))) {
        contractCall = candidate;
        break;
      }
    } catch {
      // Ignore unrelated or malformed operations; the required call must match.
    }
  }
  if (!contractCall)
    throw new HttpError(409, `Historical event ${event.id} transaction did not call the settlement contract`);

  return tx;
}

function verifyEventAgainstBatch(
  event: ExplorerEvent,
  topics: xdr.ScVal[],
  value: Record<string, unknown>,
  batch: ChainBatch | null,
) {
  if (!batch)
    throw new HttpError(409, "Historical event batch is absent from contract state");
  if (scValToNative(topics[0]!) !== "music_city")
    throw new HttpError(409, "Historical settlement event namespace is invalid");
  const batchBytes = scValToNative(topics[2]!);
  if (!(batchBytes instanceof Uint8Array) || batchBytes.length !== 32)
    throw new HttpError(409, "Historical settlement batch id is invalid");

  if (event.topicsXdr.length === 3) {
    if (
      scValToNative(topics[1]!) !== "settlement_funded" ||
      BigInt(String(value.amount)) !== batch.funded ||
      BigInt(String(value.expires_at)) !== batch.request.expires_at ||
      Buffer.from(value.source_id as Uint8Array).toString("hex") !==
        Buffer.from(batch.request.source_id).toString("hex") ||
      Buffer.from(value.proposal_hash as Uint8Array).toString("hex") !==
        Buffer.from(batch.request.proposal_hash).toString("hex")
    )
      throw new HttpError(409, "Historical funding event differs from contract state");
    return;
  }

  const index = Number(scValToNative(topics[3]!));
  const claim = batch.claims[index];
  if (
    scValToNative(topics[1]!) !== "claim_consumed" ||
    !claim ||
    claim.status[0] === "Available" ||
    value.beneficiary !== claim.beneficiary ||
    BigInt(String(value.amount)) !== claim.amount ||
    JSON.stringify(value.status) !== JSON.stringify(claim.status)
  )
    throw new HttpError(409, "Historical claim event differs from contract state");
}

/**
 * Backfills events older than the live RPC retention window. Explorer records
 * are only candidates: each must map to a successful Horizon transaction that
 * invokes this contract, and its event data must agree with current contract
 * state before it can be indexed.
 */
export async function loadHistoricalSettlementEvents(
  config: SettlementConfig,
  horizonUrl: string,
  oldestAvailableLedger: number,
  readBatch: (batchId: string) => Promise<ChainBatch | null>,
  fetcher: Fetcher = fetch,
): Promise<IndexedSettlementEvent[]> {
  const network =
    config.networkPassphrase === Networks.TESTNET
      ? "testnet"
      : config.networkPassphrase === Networks.PUBLIC
        ? "public"
        : undefined;
  if (!network)
    throw new HttpError(503, "Historical settlement indexing requires a known Stellar network");

  const root = `${explorerBase}/${network}`;
  const summary = await json<{
    contract?: string;
    events?: number;
  }>(`${root}/contract/${config.contractId}`, fetcher);
  const expectedCount = Number(summary.events);
  if (
    summary.contract !== config.contractId ||
    !Number.isSafeInteger(expectedCount) ||
    expectedCount < 0 ||
    expectedCount > maximumEvents
  )
    throw new HttpError(502, "Historical contract event index is incomplete");

  const records: ExplorerEvent[] = [];
  let url = `${root}/contract/${config.contractId}/events?order=asc&limit=${pageSize}`;
  for (let page = 0; page < Math.ceil(maximumEvents / pageSize); page += 1) {
    const result = await json<JsonPage<ExplorerEvent>>(url, fetcher);
    const pageRecords = result._embedded?.records;
    if (!Array.isArray(pageRecords))
      throw new HttpError(502, "Historical contract event index is incomplete");
    records.push(...pageRecords);
    if (records.length > maximumEvents || records.length > expectedCount)
      throw new HttpError(409, "Historical contract event count changed during backfill");
    if (pageRecords.length < pageSize) break;
    const next = result._links?.next?.href;
    if (!next)
      throw new HttpError(502, "Historical contract event pagination is incomplete");
    const parsed = new URL(next, explorerBase);
    if (
      parsed.origin !== new URL(explorerBase).origin ||
      !parsed.pathname.startsWith(`${root.replace(explorerBase, "")}/contract/${config.contractId}/events`)
    )
      throw new HttpError(409, "Historical event index returned an unexpected page");
    url = parsed.toString();
  }
  if (records.length !== expectedCount)
    throw new HttpError(409, "Historical contract event count does not reconcile");

  const historical = records
    .map((event) => ({ event, ...eventLedger(event) }))
    .filter(({ event, ledger }) => event.contract === config.contractId && ledger < oldestAvailableLedger)
    .filter(({ event }) => {
      const name = scValToNative(decodedTopics(event)[1]!);
      return name === "settlement_funded" || name === "claim_consumed";
    });

  const txs = new Map<string, HorizonTransaction>();
  const topicsByEvent = new Map<string, xdr.ScVal[]>();
  const batches = new Map<string, ChainBatch | null>();
  for (const candidate of historical) {
    if (candidate.event.contract !== config.contractId)
      throw new HttpError(409, "Historical event contract identity is invalid");
    const tx = await verifyTransaction(
      candidate.event,
      candidate.ledger,
      candidate.transactionCursor,
      config,
      horizonUrl,
      fetcher,
    );
    txs.set(candidate.event.id, tx);
    const topics = decodedTopics(candidate.event);
    let value: unknown;
    try {
      value = scValToNative(xdr.ScVal.fromXDR(candidate.event.bodyXdr, "base64"));
    } catch {
      throw new HttpError(409, "Historical settlement event body is invalid");
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new HttpError(409, "Historical settlement event body is invalid");
    const batchBytes = scValToNative(topics[2]!);
    if (!(batchBytes instanceof Uint8Array) || batchBytes.length !== 32)
      throw new HttpError(409, "Historical settlement batch id is invalid");
    const batchId = Buffer.from(batchBytes).toString("hex");
    if (!batches.has(batchId)) batches.set(batchId, await readBatch(batchId));
    verifyEventAgainstBatch(candidate.event, topics, value as Record<string, unknown>, batches.get(batchId)!);
    topicsByEvent.set(candidate.event.id, topics);
  }

  return historical.map(({ event, ledger, rpcEventId }) => {
    const tx = txs.get(event.id)!;
    const topics = topicsByEvent.get(event.id)!;
    const batchId = Buffer.from(scValToNative(topics[2]!) as Uint8Array).toString("hex");
    return {
      id: rpcEventId,
      transactionHash: tx.hash,
      ledger,
      batchId,
      type: String(scValToNative(topics[1]!)),
      payload: {
        topics: event.topicsXdr,
        value: xdr.ScVal.fromXDR(event.bodyXdr, "base64").toXDR("base64"),
        ledgerClosedAt: new Date(event.ts * 1000).toISOString(),
        receipt: {
          ledger,
          feeCharged: tx.fee_charged,
          envelope: Buffer.from(tx.envelope_xdr, "base64").toString("base64"),
        },
      },
    };
  });
}
