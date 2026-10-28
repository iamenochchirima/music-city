import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  rampOrderSchema,
  rampOrderTermsSchema,
  type RampOrder,
  type RampOrderTerms,
  rampProviderObservationSchema,
} from "@music-city/shared";
import { HttpError } from "../../utils/http-error.js";

type Database = {
  transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T>;
};
function termsHash(terms: RampOrderTerms) {
  return createHash("sha256").update(JSON.stringify(terms)).digest("hex");
}
function hydrate(row: Record<string, unknown>): RampOrder {
  return rampOrderSchema.parse({
    id: row.id,
    terms: row.terms,
    providerState: row.provider_state,
    providerObservation: row.provider_observation ?? undefined,
    launchIssuedAt: row.launch_issued_at
      ? new Date(row.launch_issued_at as string).toISOString()
      : undefined,
    chainState: row.chain_state,
    providerTransactionId: row.provider_transaction_id ?? undefined,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  });
}
export function createRampRepository(db: Database) {
  return {
    async list(userId: string, walletAddress: string): Promise<RampOrder[]> {
      if (!userId || !walletAddress)
        throw new HttpError(400, "User and wallet are required");
      return db.transaction(async (c) => {
        const rows = await c.query(
          "SELECT * FROM ramp_orders WHERE user_id=$1 AND wallet_address=$2 ORDER BY created_at DESC LIMIT 100",
          [userId, walletAddress],
        );
        return rows.rows.map(hydrate);
      });
    },
    async listForAdmin(): Promise<RampOrder[]> {
      return db.transaction(async (c) => {
        const rows = await c.query("SELECT * FROM ramp_orders ORDER BY created_at DESC, id DESC LIMIT 100");
        return rows.rows.map(hydrate);
      });
    },
    async detailForAdmin(id: string) {
      return db.transaction(async (c) => {
        const row = (await c.query("SELECT * FROM ramp_orders WHERE id=$1", [id])).rows[0];
        if (!row) return null;
        const events = (await c.query(
          "SELECT source,kind,created_at FROM ramp_events WHERE order_id=$1 ORDER BY id DESC LIMIT 200", [id],
        )).rows;
        const attempts = (await c.query(
          "SELECT transaction_hash,state,expires_at,created_at FROM ramp_chain_attempts WHERE order_id=$1 ORDER BY created_at DESC LIMIT 50", [id],
        )).rows;
        const job = (await c.query(
          "SELECT attempts,last_error_code,due_at FROM ramp_reconciliation_jobs WHERE order_id=$1", [id],
        )).rows[0] ?? null;
        return { order: hydrate(row), events, attempts, job };
      });
    },
    async get(id: string): Promise<RampOrder | null> {
      return db.transaction(async (c) => {
        const row = (
          await c.query("SELECT * FROM ramp_orders WHERE id=$1", [id])
        ).rows[0];
        return row ? hydrate(row) : null;
      });
    },
    async issueLaunch(
      id: string,
      userId: string,
      wallet: string,
    ): Promise<RampOrder> {
      return db.transaction(async (c) => {
        // Serialize launches across all providers and directions for this wallet.
        // The lock is transactional so concurrent requests cannot both pass the check.
        await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`ramp-launch:${wallet}`]);
        const owned = (await c.query(
          "SELECT id FROM ramp_orders WHERE id=$1 AND user_id=$2 AND wallet_address=$3",
          [id, userId, wallet],
        )).rows[0];
        if (!owned) throw new HttpError(404, "Ramp transaction not found");
        const uncertain = (await c.query(
          `SELECT 1 FROM ramp_orders WHERE user_id=$1 AND wallet_address=$2 AND id<>$3
           AND (launch_issued_at IS NOT NULL OR provider_transaction_id IS NOT NULL)
           AND (provider_state IN ('created','unknown') OR chain_state IN ('submitting','unknown')) LIMIT 1`,
          [userId, wallet, id],
        )).rows[0];
        if (uncertain) throw new HttpError(409, "Check your existing transaction before starting another payment.");
        const row = (
          await c.query(
            "UPDATE ramp_orders SET launch_issued_at=NOW(),updated_at=NOW() WHERE id=$1 AND user_id=$2 AND wallet_address=$3 AND launch_issued_at IS NULL AND provider_transaction_id IS NULL RETURNING *",
            [id, userId, wallet],
          )
        ).rows[0];
        if (!row)
          throw new HttpError(
            409,
            "This payment was already opened. Check its saved status before starting again.",
          );
        await c.query(
          "INSERT INTO ramp_events(order_id,source,event_key,kind,data) VALUES($1,'app','launch','widget_open_requested','{}')",
          [id],
        );
        return hydrate(row);
      });
    },
    async observe(id: string, raw: unknown, leaseToken?: string) {
      const observation = rampProviderObservationSchema.parse(raw);
      return db.transaction(async (c) => {
        const row = (
          await c.query("SELECT * FROM ramp_orders WHERE id=$1 FOR UPDATE", [
            id,
          ])
        ).rows[0];
        if (leaseToken) {
          const lease = (await c.query(
            "SELECT 1 FROM ramp_reconciliation_jobs WHERE order_id=$1 AND lease_token=$2 AND leased_until>NOW() FOR UPDATE",
            [id, leaseToken],
          )).rows[0];
          if (!lease) throw new HttpError(409, "Reconciliation lease expired");
        }
        if (!row || observation.externalId !== id)
          throw new HttpError(409, "Unknown provider transaction");
        if (
          row.provider_transaction_id &&
          row.provider_transaction_id !== observation.id
        )
          throw new HttpError(409, "Conflicting provider reference");
        const previous = row.provider_observation;
        if (
          previous &&
          Date.parse(observation.updatedAt) < Date.parse(previous.updatedAt)
        )
          return;
        if (
          previous &&
          observation.updatedAt === previous.updatedAt &&
          JSON.stringify(rampProviderObservationSchema.parse(previous)) !==
            JSON.stringify(observation)
        )
          throw new HttpError(409, "Conflicting provider observation");
        const eventKey = createHash("sha256")
          .update(JSON.stringify(observation))
          .digest("hex");
        const inserted = await c.query(
          "INSERT INTO ramp_events(order_id,source,event_key,kind,data) VALUES($1,'provider_api',$2,'status_observed',$3) ON CONFLICT DO NOTHING RETURNING id",
          [id, eventKey, JSON.stringify(observation)],
        );
        if (inserted.rowCount)
          await c.query(
            "UPDATE ramp_orders SET provider_transaction_id=$2,provider_state=$3,provider_observation=$4,updated_at=NOW() WHERE id=$1",
            [
              id,
              observation.id,
              observation.state,
              JSON.stringify(observation),
            ],
          );
      });
    },
    async recordMoonpayNotification(input: { orderId: string; providerId: string; userId: string; direction: "buy" | "sell"; key: string; kind: string }): Promise<boolean> {
      return db.transaction(async (c) => {
        const row = (await c.query("SELECT * FROM ramp_orders WHERE id=$1 FOR UPDATE", [input.orderId])).rows[0];
        if (!row || row.provider !== "moonpay" || row.environment !== "sandbox" ||
            row.direction !== input.direction || row.user_id !== input.userId ||
            (!row.launch_issued_at && !row.provider_transaction_id) ||
            (row.provider_transaction_id && row.provider_transaction_id !== input.providerId)) return false;
        const inserted = await c.query(
          "INSERT INTO ramp_events(order_id,source,event_key,kind,data) VALUES($1,'verified_webhook',$2,$3,'{}') ON CONFLICT DO NOTHING RETURNING id",
          [input.orderId, input.key, input.kind],
        );
        if (inserted.rowCount) await c.query(
          "UPDATE ramp_reconciliation_jobs SET due_at=NOW() WHERE order_id=$1", [input.orderId],
        );
        return true;
      });
    },
    async lease(): Promise<{ order: RampOrder; token: string } | null> {
      return db.transaction(async (c) => {
        const job = (
          await c.query(
            "SELECT order_id FROM ramp_reconciliation_jobs WHERE due_at<=NOW() AND (leased_until IS NULL OR leased_until<NOW()) AND EXISTS(SELECT 1 FROM ramp_orders o WHERE o.id=order_id AND o.provider='moonpay' AND (o.launch_issued_at IS NOT NULL OR o.provider_transaction_id IS NOT NULL)) ORDER BY due_at FOR UPDATE SKIP LOCKED LIMIT 1",
          )
        ).rows[0];
        if (!job) return null;
        const token = randomUUID();
        await c.query(
          "UPDATE ramp_reconciliation_jobs SET leased_until=NOW()+INTERVAL '2 minutes',due_at=NOW()+INTERVAL '2 minutes',lease_token=$2 WHERE order_id=$1",
          [job.order_id, token],
        );
        const order = hydrate(
          (await c.query("SELECT * FROM ramp_orders WHERE id=$1", [job.order_id])).rows[0],
        );
        return { order, token };
      });
    },
    async release(id: string, token: string, failed: boolean) {
      return db.transaction(async (c) => {
        await c.query(
          "UPDATE ramp_reconciliation_jobs SET leased_until=NULL,lease_token=NULL,attempts=CASE WHEN $3 THEN LEAST(attempts+1,8) ELSE 0 END,due_at=CASE WHEN due_at<leased_until THEN NOW() ELSE NOW()+CASE WHEN $3 THEN INTERVAL '10 seconds'*POWER(2,LEAST(attempts,8)) ELSE INTERVAL '15 seconds' END END,last_error_code=CASE WHEN $3 THEN 'provider_check_failed' ELSE NULL END WHERE order_id=$1 AND lease_token=$2 AND leased_until>NOW()",
          [id, token, failed],
        );
      });
    },
    async events(id: string) {
      return db.transaction(
        async (c) =>
          (
            await c.query(
              "SELECT source,kind,event_key,data,created_at FROM ramp_events WHERE order_id=$1 ORDER BY id",
              [id],
            )
          ).rows,
      );
    },
    async reserve(
      rawTerms: RampOrderTerms,
    ): Promise<{ order: RampOrder; created: boolean }> {
      const terms = rampOrderTermsSchema.parse(rawTerms);
      const hash = termsHash(terms);
      return db.transaction(async (client) => {
        const inserted = await client.query(
          `INSERT INTO ramp_orders(id,user_id,wallet_address,request_id,provider,direction,environment,network,terms_hash,terms)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(user_id,request_id) DO NOTHING RETURNING *`,
          [
            randomUUID(),
            terms.userId,
            terms.walletAddress,
            terms.requestId,
            terms.provider,
            terms.direction,
            terms.environment,
            terms.network,
            hash,
            JSON.stringify(terms),
          ],
        );
        let row = inserted.rows[0];
        const created = Boolean(row);
        if (!row)
          row = (
            await client.query(
              "SELECT * FROM ramp_orders WHERE user_id=$1 AND request_id=$2 FOR UPDATE",
              [terms.userId, terms.requestId],
            )
          ).rows[0];
        if (!row || row.terms_hash !== hash)
          throw new HttpError(
            409,
            "This request already exists with different terms",
          );
        if (created) {
          await client.query(
            "INSERT INTO ramp_events(order_id,source,event_key,kind,data) VALUES($1,'app','created','order_reserved','{}')",
            [row.id],
          );
          await client.query(
            "INSERT INTO ramp_reconciliation_jobs(order_id) VALUES($1)",
            [row.id],
          );
        }
        return { order: hydrate(row), created };
      });
    },
    async getByRequest(userId: string, requestId: string): Promise<RampOrder | null> {
      return db.transaction(async (c) => {
        const row = (await c.query("SELECT * FROM ramp_orders WHERE user_id=$1 AND request_id=$2", [userId, requestId])).rows[0];
        return row ? hydrate(row) : null;
      });
    },
    async getForOwner(
      id: string,
      userId: string,
      walletAddress: string,
    ): Promise<RampOrder | null> {
      return db.transaction(async (client) => {
        const row = (
          await client.query(
            "SELECT * FROM ramp_orders WHERE id=$1 AND user_id=$2 AND wallet_address=$3",
            [id, userId, walletAddress],
          )
        ).rows[0];
        return row ? hydrate(row) : null;
      });
    },
    async bindProviderReference(
      id: string,
      userId: string,
      walletAddress: string,
      reference: string,
    ): Promise<RampOrder> {
      if (!reference.trim() || reference.length > 200)
        throw new HttpError(400, "Invalid provider reference");
      return db.transaction(async (client) => {
        let row = (
          await client.query(
            "SELECT * FROM ramp_orders WHERE id=$1 AND user_id=$2 AND wallet_address=$3 FOR UPDATE",
            [id, userId, walletAddress],
          )
        ).rows[0];
        if (!row) throw new HttpError(404, "Ramp transaction not found");
        if (
          row.provider_transaction_id &&
          row.provider_transaction_id !== reference
        )
          throw new HttpError(
            409,
            "This transaction already has a provider reference",
          );
        if (!row.provider_transaction_id) {
          row.provider_transaction_id = reference;
          row = (
            await client.query(
              "UPDATE ramp_orders SET provider_transaction_id=$2,updated_at=NOW() WHERE id=$1 RETURNING *",
              [id, reference],
            )
          ).rows[0];
          await client.query(
            "INSERT INTO ramp_events(order_id,source,event_key,kind,data) VALUES($1,'app','provider_bound','provider_reference_bound',$2) ON CONFLICT DO NOTHING",
            [id, JSON.stringify({ providerTransactionId: reference })],
          );
        }
        return hydrate(row);
      });
    },
  };
}
