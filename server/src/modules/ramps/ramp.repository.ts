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
import type { IncomingDelivery } from "./incoming-delivery.js";
import { parseCashOutSnapshot, validateCashOutQuote } from "../cashout/cashout-quote.js";
import { prepareCashOutTransfer, verifyCashOutEnvelope, type CashOutSigningAccount } from "../cashout/cashout-transfer.js";
import type { createCashOutEnvelopeCipher } from "../cashout/cashout-envelope.js";
import { Networks } from "@stellar/stellar-sdk";

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
        const deliveries = (await c.query(
          "SELECT data->>'transactionHash' AS transaction_hash,data->>'operationId' AS operation_id,data->>'ledger' AS ledger,data->>'assetUnits' AS asset_units,created_at FROM ramp_events WHERE order_id=$1 AND source='chain' AND kind='incoming_delivery_confirmed' ORDER BY id DESC LIMIT 50", [id],
        )).rows;
        return { order: hydrate(row), events, attempts, job, deliveries };
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
        if (previous && observation.updatedAt === previous.updatedAt) {
          const prior = rampProviderObservationSchema.parse(previous);
          // A newer parser may recover a hash or amount omitted by an earlier version.
          const enriched = rampProviderObservationSchema.parse({ ...prior,
            chainHash: prior.chainHash ?? observation.chainHash,
            assetUnits: prior.assetUnits ?? observation.assetUnits });
          if (JSON.stringify(enriched) !== JSON.stringify(observation))
            throw new HttpError(409, "Conflicting provider observation");
        }
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
    async recordIncomingDelivery(id: string, observation: unknown, delivery: IncomingDelivery, token: string) {
      const expected = rampProviderObservationSchema.parse(observation);
      if (!/^[a-f0-9]{64}$/.test(delivery.transactionHash) || !/^[0-9]+$/.test(delivery.operationId) ||
          !Number.isSafeInteger(delivery.ledger) || delivery.ledger < 1 || delivery.assetUnits !== expected.assetUnits ||
          delivery.transactionHash !== expected.chainHash || expected.state !== "completed" || expected.externalId !== id)
        throw new HttpError(409, "Delivery evidence does not match the provider transaction");
      return db.transaction(async (c) => {
        const row = (await c.query("SELECT * FROM ramp_orders WHERE id=$1 FOR UPDATE", [id])).rows[0];
        const lease = (await c.query("SELECT 1 FROM ramp_reconciliation_jobs WHERE order_id=$1 AND lease_token=$2 AND leased_until>NOW() FOR UPDATE", [id, token])).rows[0];
        if (!lease) throw new HttpError(409, "Reconciliation lease expired");
        if (!row || row.direction !== "buy" || row.network !== "stellar:testnet" ||
            JSON.stringify(rampProviderObservationSchema.parse(row.provider_observation)) !== JSON.stringify(expected))
          throw new HttpError(409, "Provider transaction changed during delivery verification");
        const key = `${delivery.transactionHash}:${delivery.operationId}`;
        if (row.chain_state === "confirmed") {
          const existing = (await c.query("SELECT 1 FROM ramp_events WHERE order_id=$1 AND source='chain' AND kind='incoming_delivery_confirmed' AND event_key=$2", [id, key])).rows[0];
          if (!existing) throw new HttpError(409, "A different delivery was already confirmed");
          return;
        }
        await c.query("INSERT INTO ramp_events(order_id,source,event_key,kind,data) VALUES($1,'chain',$2,'incoming_delivery_confirmed',$3)", [id, key, JSON.stringify(delivery)]);
        await c.query("UPDATE ramp_orders SET chain_state='confirmed',updated_at=NOW() WHERE id=$1", [id]);
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
    async release(id: string, token: string, errorCode: "provider_check_failed" | "delivery_check_failed" | null) {
      return db.transaction(async (c) => {
        await c.query(
          "UPDATE ramp_reconciliation_jobs SET leased_until=NULL,lease_token=NULL,attempts=CASE WHEN $3::text IS NOT NULL THEN LEAST(attempts+1,8) ELSE 0 END,due_at=CASE WHEN due_at<leased_until THEN NOW() ELSE NOW()+CASE WHEN $3::text IS NOT NULL THEN INTERVAL '10 seconds'*POWER(2,LEAST(attempts,8)) ELSE INTERVAL '15 seconds' END END,last_error_code=$3 WHERE order_id=$1 AND lease_token=$2 AND leased_until>NOW()",
          [id, token, errorCode],
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
    // Raw quote and instructions must be returned by the authenticated provider adapter.
    async saveCashOutQuote(id: string, userId: string, walletAddress: string, rawQuote: unknown, rawInstructions: unknown, now = new Date()) {
      return db.transaction(async (c) => {
        const row = (await c.query("SELECT * FROM ramp_orders WHERE id=$1 AND user_id=$2 AND wallet_address=$3 FOR UPDATE", [id, userId, walletAddress])).rows[0];
        if (!row) throw new HttpError(404, "Transaction not found");
        const verified = validateCashOutQuote(hydrate(row), rawQuote, rawInstructions, now);
        const { quote } = verified.snapshot;
        const existing = (await c.query("SELECT * FROM ramp_quotes WHERE id=$1 OR (order_id=$2 AND provider_quote_id=$3)", [quote.id, id, quote.providerQuoteId])).rows;
        if (existing.length) {
          if (existing.length !== 1 || existing[0].id !== quote.id || existing[0].order_id !== id ||
              parseCashOutSnapshot(existing[0].snapshot).hash !== verified.hash)
            throw new HttpError(409, "This quote already exists with different terms");
          return verified;
        }
        const active = (await c.query("SELECT 1 FROM ramp_chain_attempts WHERE order_id=$1 AND state IN ('prepared','submitting','unknown','confirmed') LIMIT 1", [id])).rows[0];
        if (active) throw new HttpError(409, "Check the existing transfer before changing the quote");
        await c.query("INSERT INTO ramp_quotes(id,order_id,provider_quote_id,snapshot,expires_at) VALUES($1,$2,$3,$4,$5)",
          [quote.id, id, quote.providerQuoteId, JSON.stringify(verified.snapshot), verified.expiresAt]);
        await c.query("INSERT INTO ramp_events(order_id,source,event_key,kind,data) VALUES($1,'app',$2,'quote_saved',$3)",
          [id, `quote:${quote.id}`, JSON.stringify({ quoteId: quote.id, confirmationHash: verified.hash })]);
        return verified;
      });
    },
    // Sequence, fee and ledger must come from a trusted Stellar account and ledger read.
    async prepareCashOutAttempt(input: { orderId: string; quoteId: string; confirmationHash: string; userId: string; walletAddress: string; sequence: string; feeStroops: number; maxFeeStroops: number; preparedLedger: number; now?: Date }) {
      if (!/^[a-f0-9]{64}$/.test(input.confirmationHash) || !Number.isSafeInteger(input.preparedLedger) || input.preparedLedger < 1)
        throw new HttpError(400, "Review the quote and refresh your wallet");
      return db.transaction(async (c) => {
        await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`cashout-wallet:${input.walletAddress}`]);
        const row = (await c.query("SELECT * FROM ramp_orders WHERE id=$1 AND user_id=$2 AND wallet_address=$3 FOR UPDATE", [input.orderId, input.userId, input.walletAddress])).rows[0];
        if (!row) throw new HttpError(404, "Transaction not found");
        const order = hydrate(row);
        const quoteRow = (await c.query("SELECT snapshot FROM ramp_quotes WHERE id=$1 AND order_id=$2", [input.quoteId, input.orderId])).rows[0];
        if (!quoteRow) throw new HttpError(404, "Quote not found");
        const saved = parseCashOutSnapshot(quoteRow.snapshot);
        if (saved.hash !== input.confirmationHash) throw new HttpError(409, "Review the current quote before continuing");
        const active = (await c.query("SELECT a.* FROM ramp_chain_attempts a JOIN ramp_orders o ON o.id=a.order_id WHERE o.wallet_address=$1 AND (a.state IN ('prepared','submitting','unknown') OR (a.order_id=$2 AND a.state='confirmed')) ORDER BY a.created_at DESC LIMIT 1", [input.walletAddress, input.orderId])).rows[0];
        if (active) {
          if (active.order_id !== input.orderId || active.quote_id !== input.quoteId) throw new HttpError(409, "Check the existing transfer before starting another");
          return { id: active.id as string, quoteId: active.quote_id as string, transaction: active.prepared_envelope as string, transactionHash: active.transaction_hash as string, expiresAt: new Date(active.expires_at).toISOString(), state: active.state as string };
        }
        if (!["created", "awaiting_user", "processing"].includes(order.providerState)) throw new HttpError(409, "This cash-out is no longer ready for a transfer");
        const verified = validateCashOutQuote(order, saved.snapshot.quote, saved.snapshot.instructions, input.now ?? new Date());
        const { quote, instructions } = verified.snapshot;
        const policy = { provider: order.terms.provider, environment: order.terms.environment, network: order.terms.network, assetIssuer: order.terms.assetIssuer!, walletAddress: order.terms.walletAddress, market: quote.market, maxFeeStroops: input.maxFeeStroops };
        const now = input.now ?? new Date();
        let prepared = prepareCashOutTransfer(instructions, quote, policy, input.sequence, input.feeStroops, now);
        // An unsigned cancellation must not reuse the old transaction hash, even within the same second.
        for (let retries = 0; retries < 10; retries++) {
          const duplicate = (await c.query("SELECT 1 FROM ramp_chain_attempts WHERE network=$1 AND transaction_hash=$2", [order.terms.network, prepared.transactionHash])).rows[0];
          if (!duplicate) break;
          prepared = prepareCashOutTransfer(instructions, quote, policy, input.sequence, input.feeStroops, now, Math.floor(Date.parse(prepared.expiresAt) / 1000) - 1);
          if (retries === 9) throw new HttpError(409, "Try again with a new quote");
        }
        const attemptId = randomUUID();
        await c.query("INSERT INTO ramp_chain_attempts(id,order_id,quote_id,network,transaction_hash,prepared_envelope,state,expires_at,prepared_ledger) VALUES($1,$2,$3,$4,$5,$6,'prepared',$7,$8)", [attemptId, input.orderId, input.quoteId, order.terms.network, prepared.transactionHash, prepared.transaction, prepared.expiresAt, input.preparedLedger]);
        await c.query("UPDATE ramp_orders SET chain_state='prepared',updated_at=NOW() WHERE id=$1", [input.orderId]);
        await c.query("INSERT INTO ramp_events(order_id,source,event_key,kind,data) VALUES($1,'app',$2,'transfer_prepared',$3)", [input.orderId, `attempt:${attemptId}`, JSON.stringify({ attemptId, quoteId: input.quoteId, transactionHash: prepared.transactionHash })]);
        return { id: attemptId, quoteId: input.quoteId, transaction: prepared.transaction, transactionHash: prepared.transactionHash, expiresAt: prepared.expiresAt, state: "prepared" };
      });
    },
    // The signing account must be freshly read from the intended Stellar network.
    async authorizeCashOutAttempt(input: { orderId: string; attemptId: string; userId: string; walletAddress: string; signedXdr: string; account: CashOutSigningAccount; cipher: ReturnType<typeof createCashOutEnvelopeCipher>; now?: Date }) {
      return db.transaction(async (c) => {
        await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`cashout-wallet:${input.walletAddress}`]);
        const row = (await c.query("SELECT a.* FROM ramp_chain_attempts a JOIN ramp_orders o ON o.id=a.order_id WHERE a.id=$1 AND a.order_id=$2 AND o.user_id=$3 AND o.wallet_address=$4 FOR UPDATE OF a,o", [input.attemptId, input.orderId, input.userId, input.walletAddress])).rows[0];
        if (!row) throw new HttpError(404, "Transfer not found");
        if (row.signed_envelope_encrypted) {
          const saved = input.cipher.decrypt(input.orderId, input.attemptId, row.transaction_hash, row.signed_envelope_encrypted);
          if (saved !== input.signedXdr) throw new HttpError(409, "A different signed transfer is already saved");
          return { id: row.id as string, transactionHash: row.transaction_hash as string, state: row.state as string };
        }
        if (row.state !== "prepared" || row.network !== "stellar:testnet" || input.account.account_id !== input.walletAddress)
          throw new HttpError(409, "This transfer cannot be authorized");
        const signed = verifyCashOutEnvelope({ transaction: row.prepared_envelope, transactionHash: row.transaction_hash,
          networkPassphrase: Networks.TESTNET, expiresAt: new Date(row.expires_at).toISOString() }, input.signedXdr, input.account, input.now ?? new Date());
        const encrypted = input.cipher.encrypt(input.orderId, input.attemptId, row.transaction_hash, signed);
        await c.query("UPDATE ramp_chain_attempts SET state='submitting',signed_envelope_encrypted=$2,updated_at=NOW() WHERE id=$1", [input.attemptId, encrypted]);
        await c.query("UPDATE ramp_orders SET chain_state='submitting',updated_at=NOW() WHERE id=$1", [input.orderId]);
        await c.query("INSERT INTO ramp_events(order_id,source,event_key,kind,data) VALUES($1,'app',$2,'transfer_authorized',$3)", [input.orderId, `authorize:${input.attemptId}`, JSON.stringify({ attemptId: input.attemptId, transactionHash: row.transaction_hash })]);
        return { id: input.attemptId, transactionHash: row.transaction_hash as string, state: "submitting" };
      });
    },
    async cancelUnsignedCashOutAttempt(orderId: string, attemptId: string, userId: string, walletAddress: string) {
      return db.transaction(async (c) => {
        await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`cashout-wallet:${walletAddress}`]);
        const row = (await c.query("SELECT a.* FROM ramp_chain_attempts a JOIN ramp_orders o ON o.id=a.order_id WHERE a.id=$1 AND a.order_id=$2 AND o.user_id=$3 AND o.wallet_address=$4 FOR UPDATE OF a,o", [attemptId, orderId, userId, walletAddress])).rows[0];
        if (!row) throw new HttpError(404, "Transfer not found");
        if (row.state === "cancelled") return;
        if (row.state !== "prepared" || row.signed_envelope_encrypted) throw new HttpError(409, "Check the existing transfer before trying again");
        await c.query("UPDATE ramp_chain_attempts SET state='cancelled',updated_at=NOW() WHERE id=$1", [attemptId]);
        await c.query("UPDATE ramp_orders SET chain_state='unobserved',updated_at=NOW() WHERE id=$1 AND chain_state='prepared'", [orderId]);
        await c.query("INSERT INTO ramp_events(order_id,source,event_key,kind,data) VALUES($1,'app',$2,'transfer_cancelled',$3)", [orderId, `cancel:${attemptId}`, JSON.stringify({ attemptId })]);
      });
    },
    async getCashOutQuote(orderId: string, quoteId: string, userId: string, walletAddress: string) {
      return db.transaction(async (c) => {
        const row = (await c.query("SELECT q.snapshot,q.expires_at FROM ramp_quotes q JOIN ramp_orders o ON o.id=q.order_id WHERE q.order_id=$1 AND q.id=$2 AND o.user_id=$3 AND o.wallet_address=$4", [orderId, quoteId, userId, walletAddress])).rows[0];
        if (!row) return null;
        return { ...parseCashOutSnapshot(row.snapshot), expiresAt: new Date(row.expires_at).toISOString() };
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
