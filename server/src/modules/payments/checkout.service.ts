import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  checkoutAttemptSchema,
  type CheckoutAttempt,
  type PaymentIntentRecord,
} from "@music-city/shared";
import { databaseService as db } from "../../services/database.service.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";
import { logger } from "../../utils/logger.js";
import { verifySupportSignature } from "../support/support-chain.js";
import { paymentsRepository } from "./payments.repository.js";
import {
  buildCheckoutTransaction,
  checkoutChain,
  verifyCheckoutReceipt,
} from "./checkout-chain.js";

type Row = { payload: CheckoutAttempt; signed_transaction: string | null };
const active = (attempt: CheckoutAttempt) =>
  ["prepared", "submitting"].includes(attempt.status);
async function event(
  client: PoolClient,
  attempt: CheckoutAttempt,
  action: string,
) {
  await client.query(
    "INSERT INTO checkout_events(checkout_id,action,payload) VALUES($1,$2,$3)",
    [
      attempt.id,
      action,
      {
        status: attempt.status,
        transactionHash: attempt.transactionHash,
        ledger: attempt.ledger,
        feeCharged: attempt.feeCharged,
        submissionCount: attempt.submissionCount,
      },
    ],
  );
}
async function update(
  client: PoolClient,
  attempt: CheckoutAttempt,
  patch: Partial<CheckoutAttempt>,
  action: string,
  signed?: string,
) {
  const next = checkoutAttemptSchema.parse({
    ...attempt,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  await client.query(
    "UPDATE payment_checkouts SET status=$2,payload=$3,signed_transaction=COALESCE(signed_transaction,$4),checked_at=NOW() WHERE id=$1",
    [next.id, next.status, next, signed ?? null],
  );
  await event(client, next, action);
  return next;
}
async function locked<T>(
  id: string,
  actor: string | null,
  operation: (client: PoolClient, row: Row) => Promise<T>,
) {
  return db.transaction(async (client) => {
    const found = await client.query<Row>(
      "SELECT payload,signed_transaction FROM payment_checkouts WHERE id=$1",
      [id],
    );
    const first = found.rows[0];
    if (!first || (actor && first.payload.walletAddress !== actor))
      throw new HttpError(404, "Checkout not found");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `checkout:${first.payload.walletAddress}`,
    ]);
    const current = await client.query<Row>(
      "SELECT payload,signed_transaction FROM payment_checkouts WHERE id=$1 FOR UPDATE",
      [id],
    );
    return operation(client, current.rows[0]!);
  });
}
async function reconcile(client: PoolClient, row: Row) {
  const attempt = row.payload;
  if (!active(attempt)) return attempt;
  if (attempt.networkPassphrase !== env.STELLAR_NETWORK_PASSPHRASE)
    throw new HttpError(409, "Restore the payment network before continuing");
  const ledger = await checkoutChain.ledger();
  const receipt = await checkoutChain.receipt(attempt.transactionHash);
  if (receipt) {
    verifyCheckoutReceipt(attempt, receipt);
    if (!receipt.successful)
      return update(
        client,
        attempt,
        {
          status: "failed",
          ledger: receipt.ledger,
          feeCharged: receipt.fee_charged,
          error: "Payment failed. No purchase was completed.",
        },
        "failed",
      );
    if (
      attempt.ledger === receipt.ledger &&
      attempt.feeCharged === receipt.fee_charged
    )
      return attempt;
    return update(
      client,
      attempt,
      {
        status: "submitting",
        ledger: receipt.ledger,
        feeCharged: receipt.fee_charged,
        error: undefined,
      },
      "chain_confirmed",
    );
  }
  if (
    Date.parse(ledger.closed_at) > Date.parse(attempt.expiresAt) &&
    (await checkoutChain.historyStart()) <= attempt.preparedLedger
  ) {
    return update(
      client,
      attempt,
      {
        status: "expired",
        error: "Payment expired. No matching transaction was found.",
      },
      "expired",
    );
  }
  return attempt;
}

export const checkoutService = {
  async activeIntent(wallet: string) {
    const row = await db.transaction(
      async (client) =>
        (
          await client.query<{ payload: CheckoutAttempt }>(
            "SELECT payload FROM payment_checkouts WHERE wallet_address=$1 AND status IN ('prepared','submitting')",
            [wallet],
          )
        ).rows[0],
    );
    if (!row) return null;
    const attempt = await this.get(wallet, row.payload.id);
    return active(attempt)
      ? paymentsRepository.findIntentById(attempt.intentId)
      : null;
  },
  async prepare(wallet: string, intentId: string): Promise<CheckoutAttempt> {
    const prepared = await db.transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [`checkout:${wallet}`],
      );
      const intent = (
        await client.query<{ payload: PaymentIntentRecord }>(
          "SELECT payload FROM payment_intents WHERE id=$1",
          [intentId],
        )
      ).rows[0]?.payload;
      if (!intent || intent.walletAddress !== wallet)
        throw new HttpError(404, "Payment not found");
      const existing = await client.query<Row>(
        "SELECT payload,signed_transaction FROM payment_checkouts WHERE intent_id=$1 FOR UPDATE",
        [intentId],
      );
      if (existing.rows[0]) return reconcile(client, existing.rows[0]);
      if (
        intent.status !== "pending" ||
        Date.parse(intent.expiresAt) <= Date.now()
      )
        throw new HttpError(409, "Create a new payment before continuing");
      const pending = await client.query(
        "SELECT id FROM payment_checkouts WHERE wallet_address=$1 AND status IN ('prepared','submitting')",
        [wallet],
      );
      if (pending.rowCount)
        throw new HttpError(
          409,
          "Finish your pending payment before starting another",
        );
      const [source, destination, ledger] = await Promise.all([
        checkoutChain.account(wallet),
        checkoutChain.account(intent.destinationAddress),
        checkoutChain.ledger(),
      ]);
      const timestamp = new Date().toISOString();
      const attempt = checkoutAttemptSchema.parse({
        id: randomUUID(),
        intentId,
        walletAddress: wallet,
        networkPassphrase: intent.networkPassphrase,
        ...buildCheckoutTransaction(intent, source, destination, ledger),
        preparedLedger: ledger.sequence,
        status: "prepared",
        submissionCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await client.query(
        "INSERT INTO payment_checkouts(id,intent_id,wallet_address,status,transaction_hash,payload) VALUES($1,$2,$3,$4,$5,$6)",
        [
          attempt.id,
          intentId,
          wallet,
          attempt.status,
          attempt.transactionHash,
          attempt,
        ],
      );
      await event(client, attempt, "prepared");
      return attempt;
    });
    return prepared.ledger && prepared.status === "submitting"
      ? this.get(wallet, prepared.id)
      : prepared;
  },
  async get(wallet: string, id: string): Promise<CheckoutAttempt> {
    const attempt = await locked(id, wallet, reconcile);
    if (attempt.status !== "submitting" || !attempt.ledger) return attempt;
    // Accounting uses its own transactions after releasing the checkout lock and connection.
    const { paymentsService } = await import("./payments.service.js");
    await paymentsService.confirm(wallet, {
      intentId: attempt.intentId,
      txHash: attempt.transactionHash,
    });
    return locked(id, wallet, async (client, row) =>
      row.payload.status === "confirmed"
        ? row.payload
        : update(
            client,
            row.payload,
            { status: "confirmed", error: undefined },
            "confirmed",
          ),
    );
  },
  async authorize(wallet: string, id: string, signed: string) {
    await this.get(wallet, id);
    return locked(id, wallet, async (client, row) => {
      const attempt = row.payload;
      if (attempt.status !== "prepared") return attempt;
      if (Date.parse(attempt.expiresAt) <= Date.now())
        throw new HttpError(
          409,
          "Wait for this payment to expire before trying again",
        );
      const source = await checkoutChain.account(wallet);
      const verified = verifySupportSignature(
        {
          sender: wallet,
          networkPassphrase: attempt.networkPassphrase,
          transactionHash: attempt.transactionHash,
        },
        signed,
        source,
      );
      return update(
        client,
        attempt,
        { status: "submitting" },
        "authorized",
        verified,
      );
    });
  },
  async submit(wallet: string, id: string) {
    const current = await this.get(wallet, id);
    if (current.status !== "submitting") return current;
    const submission = await locked(id, wallet, async (client, row) => {
      const attempt = row.payload;
      if (
        attempt.status !== "submitting" ||
        attempt.ledger !== undefined ||
        !row.signed_transaction ||
        attempt.submissionCount >= 5 ||
        (attempt.lastSubmittedAt &&
          Date.now() - Date.parse(attempt.lastSubmittedAt) < 15000)
      )
        return null;
      await update(
        client,
        attempt,
        {
          submissionCount: attempt.submissionCount + 1,
          lastSubmittedAt: new Date().toISOString(),
        },
        "submit_attempt",
      );
      return row.signed_transaction;
    });
    if (submission) {
      try {
        await checkoutChain.submit(submission);
      } catch (error) {
        logger.warn("Checkout awaits its original transaction receipt", {
          checkoutId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return this.get(wallet, id);
  },
  async cycle() {
    const pending = await db.transaction(
      async (client) =>
        (
          await client.query<Row>(
            "SELECT payload FROM payment_checkouts WHERE status IN ('prepared','submitting') ORDER BY checked_at NULLS FIRST,id LIMIT 20",
          )
        ).rows,
    );
    for (const row of pending) {
      const attempt = row.payload;
      try {
        await this.submit(attempt.walletAddress, attempt.id);
      } catch (error) {
        logger.error("Checkout reconciliation needs attention", {
          checkoutId: attempt.id,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await db.transaction((client) =>
          client.query(
            "UPDATE payment_checkouts SET checked_at=NOW() WHERE id=$1",
            [attempt.id],
          ),
        );
      }
    }
  },
};
