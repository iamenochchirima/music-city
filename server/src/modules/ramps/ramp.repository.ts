import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  rampOrderSchema,
  rampOrderTermsSchema,
  type RampOrder,
  type RampOrderTerms,
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
    chainState: row.chain_state,
    providerTransactionId: row.provider_transaction_id ?? undefined,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  });
}
export function createRampRepository(db: Database) {
  return {
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
        const row = (
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
          await client.query(
            "UPDATE ramp_orders SET provider_transaction_id=$2,updated_at=NOW() WHERE id=$1",
            [id, reference],
          );
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
