import { amountUnits } from "./settlement-domain.js";
import { settlementConfig } from "./settlement-chain.js";
import type { PoolClient } from "pg";
import {
  financialAttemptSchema,
  royaltyLedgerEntrySchema,
  settlementBatchSchema,
  type FinancialAttempt,
  type SettlementBatch,
} from "@music-city/shared";
import { databaseService } from "../../services/database.service.js";
import { HttpError } from "../../utils/http-error.js";
export async function loadBatch(client: PoolClient, id: string) {
  const row = await client.query(
    "SELECT payload FROM settlement_batches WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (!row.rows[0]) throw new HttpError(404, "Settlement not found");
  return settlementBatchSchema.parse(row.rows[0].payload);
}
export async function saveBatch(client: PoolClient, batch: SettlementBatch) {
  await client.query(
    "UPDATE settlement_batches SET state=$2,payload=$3 WHERE id=$1",
    [batch.id, batch.state, batch],
  );
}
export async function loadAttempt(client: PoolClient, id: string) {
  const row = await client.query(
    "SELECT payload FROM financial_attempts WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (!row.rows[0]) throw new HttpError(404, "Financial attempt not found");
  return financialAttemptSchema.parse(row.rows[0].payload);
}
export async function saveAttempt(
  client: PoolClient,
  a: FinancialAttempt,
  insert = false,
) {
  if (insert)
    await client.query(
      "INSERT INTO financial_attempts(id,batch_id,source_address,transaction_hash,status,payload) VALUES($1,$2,$3,$4,$5,$6)",
      [a.id, a.batchId, a.treasuryAddress, a.transactionHash, a.status, a],
    );
  else
    await client.query(
      "UPDATE financial_attempts SET status=$2,payload=$3 WHERE id=$1",
      [a.id, a.status, a],
    );
}
export async function settlementEvent(
  client: PoolClient,
  batchId: string,
  actor: string,
  action: string,
  payload: object,
) {
  await client.query(
    "INSERT INTO settlement_events(batch_id,actor,action,payload) VALUES($1,$2,$3,$4)",
    [batchId, actor, action, payload],
  );
}
export async function assertSourceAvailable(
  client: PoolClient,
  ledgerIds: string[],
) {
  const payouts = await client.query(
    "SELECT id FROM royalty_payouts WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text(payload->'ledgerEntryIds') e(id) WHERE e.id=ANY($1::text[])) AND (status<>'cancelled' OR payload->>'txHash' IS NOT NULL) LIMIT 1",
    [ledgerIds],
  );
  if (payouts.rowCount)
    throw new HttpError(
      409,
      "This source has historical payout activity. Reconcile its original transaction before settlement",
    );
  const reserved = await client.query(
    "SELECT batch_id FROM settlement_reservations WHERE ledger_id=ANY($1::text[]) LIMIT 1",
    [ledgerIds],
  );
  if (reserved.rowCount)
    throw new HttpError(409, "This source is already reserved for settlement");
}
export const settlementRepository = {
  async balances(wallet: string) {
    const config = settlementConfig();
    return databaseService.transaction(async (client) => {
      const rows = await client.query(
        "SELECT l.payload FROM royalty_ledger l LEFT JOIN settlement_reservations r ON r.ledger_id=l.id LEFT JOIN settlement_batches b ON b.id=r.batch_id WHERE l.recipient_wallet_address=$1 AND l.status IN ('pending','approved') AND (b.id IS NULL OR b.state='reserved')",
        [wallet],
      );
      const entries = rows.rows
        .map((r) => royaltyLedgerEntrySchema.parse(r.payload))
        .filter(
          (e) =>
            e.assetCode === config.assetCode &&
            e.assetIssuer === config.assetIssuer,
        );
      return {
        pendingUnits: entries
          .reduce((n, e) => n + amountUnits(e.netAmount), 0n)
          .toString(),
        assetCode: config.assetCode,
        assetIssuer: config.assetIssuer,
      };
    });
  },
  async list(wallet?: string) {
    return databaseService.transaction(async (client) => {
      const rows = await client.query(
        "SELECT b.payload,t.payload->>'title' AS track_title FROM settlement_batches b JOIN contributor_agreements g ON g.id=b.agreement_id JOIN tracks t ON t.id=g.track_id WHERE $1::text IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(b.payload->'allocations') a WHERE a->>'beneficiary'=$1) ORDER BY b.payload->>'createdAt' DESC",
        [wallet ?? null],
      );
      return rows.rows.map((r) => ({
        ...settlementBatchSchema.parse(r.payload),
        trackTitle: r.track_title as string | null,
      }));
    });
  },
  async detail(id: string, wallet?: string) {
    return databaseService.transaction(async (client) => {
      const batch = await loadBatch(client, id);
      if (wallet && !batch.allocations.some((a) => a.beneficiary === wallet))
        throw new HttpError(403, "Settlement access denied");
      const attempts = await client.query(
        "SELECT payload FROM financial_attempts WHERE batch_id=$1 AND ($2::text IS NULL OR source_address=$2) ORDER BY payload->>'createdAt'",
        [id, wallet ?? null],
      );
      const events = wallet
        ? []
        : (
            await client.query(
              "SELECT * FROM settlement_events WHERE batch_id=$1 ORDER BY id",
              [id],
            )
          ).rows;
      return {
        batch,
        attempts: attempts.rows.map((r) =>
          financialAttemptSchema.parse(r.payload),
        ),
        events,
      };
    });
  },
};
