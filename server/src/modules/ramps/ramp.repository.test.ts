import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { rampOrderTermsSchema, type RampOrderTerms } from "@music-city/shared";
import { createRampRepository } from "./ramp.repository.js";
import { rampProgressStatements } from "./ramp-progress-migration.js";
import { rampSchemaStatements } from "./ramp-migration.js";
import { rampLeaseStatements } from "./ramp-lease-migration.js";
import { rampDeliveryStatements } from "./ramp-delivery-migration.js";
import { rampQuoteStatements } from "./ramp-quote-migration.js";
import { rampCashOutAttemptStatements } from "./ramp-cashout-attempt-migration.js";
import { rampCashOutRecoveryStatements } from "./ramp-cashout-recovery-migration.js";
import { rampLaunchStatements } from "./ramp-launch-migration.js";
import { createRampService, verifiedRampCapabilities, type VerifiedRampRoute } from "./ramp-service.js";
import { createCashOutQuoteService } from "../cashout/cashout-quote.service.js";
import { createCashOutEnvelopeCipher } from "../cashout/cashout-envelope.js";
import { reconcileCashOut } from "../cashout/cashout-worker.js";
import { createCashOutAuthorizationService } from "../cashout/cashout-authorization.service.js";
import { createRampLaunchService } from "./ramp-launch.service.js";

const terms = (patch: Partial<RampOrderTerms> = {}): RampOrderTerms => ({
  userId: "artist",
  walletAddress: Keypair.random().publicKey(),
  requestId: randomUUID(),
  provider: "moonpay",
  direction: "buy",
  environment: "sandbox",
  network: "stellar:testnet",
  assetCode: "USDC",
  assetIssuer: Keypair.random().publicKey(),
  market: { country: "ZA", currency: "ZAR", method: "card" },
  amount: { currency: "ZAR", units: "10000", decimals: 2 },
  ...patch,
});

test("shared ramp terms reject mismatched money, modes and methods", () => {
  const original = terms();
  for (const patch of [
    { amount: { currency: "USD", units: "100", decimals: 2 } },
    { amount: { currency: "ZAR", units: "0", decimals: 2 } },
    { environment: "production" },
    { network: "stellar:public" },
    { provider: "moneygram" },
    { direction: "sell" },
  ])
    assert.equal(
      rampOrderTermsSchema.safeParse({ ...original, ...patch }).success,
      false,
    );
  assert.equal(
    rampOrderTermsSchema.safeParse(
      terms({
        direction: "sell",
        amount: { currency: "USDC", units: "10000000", decimals: 7 },
      }),
    ).success,
    true,
  );
  assert.equal(
    rampOrderTermsSchema.safeParse(
      terms({
        provider: "moneygram",
        market: { country: "ZA", currency: "ZAR", method: "cash_deposit" },
      }),
    ).success,
    true,
  );
});

test("the configured application exposes no unverified payment routes", async () => {
  assert.deepEqual(await verifiedRampCapabilities.routes(), []);
});

const url = process.env.RAMP_TEST_DATABASE_URL;
test(
  "ramp persistence preserves ownership, idempotency, append-only events and original references",
  { skip: !url },
  async () => {
    const target = new URL(url!);
    assert.ok(
      ["127.0.0.1", "localhost"].includes(target.hostname) &&
        target.pathname.endsWith("_test"),
      "Use an isolated local test database",
    );
    const pool = new Pool({ connectionString: url });
    const schema = `ramp_${randomUUID().replaceAll("-", "")}`;
    await pool.query(`CREATE SCHEMA ${schema}`);
    const db = {
      async transaction<T>(work: (c: PoolClient) => Promise<T>) {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          await c.query(`SET LOCAL search_path TO ${schema}`);
          const r = await work(c);
          await c.query("COMMIT");
          return r;
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      },
    };
    try {
      await db.transaction(async (c) => {
        await c.query("CREATE TABLE users(id TEXT PRIMARY KEY)");
        await c.query("INSERT INTO users VALUES('artist'),('other')");
        for (const sql of [...rampSchemaStatements, ...rampProgressStatements, ...rampLeaseStatements, ...rampDeliveryStatements, ...rampQuoteStatements, ...rampCashOutAttemptStatements, ...rampCashOutRecoveryStatements, ...rampLaunchStatements])
          await c.query(sql);
        for (const sql of [...rampSchemaStatements, ...rampProgressStatements, ...rampLeaseStatements, ...rampDeliveryStatements, ...rampQuoteStatements, ...rampCashOutAttemptStatements, ...rampCashOutRecoveryStatements, ...rampLaunchStatements])
          await c.query(sql);
      });
      const repo = createRampRepository(db);
      await assert.rejects(repo.list("", ""), /User and wallet are required/);
      await assert.rejects(repo.list("artist", ""), /User and wallet are required/);
      const input = terms();
      const outcomes = await Promise.all(
        Array.from({ length: 8 }, () => repo.reserve(input)),
      );
      assert.equal(outcomes.filter((x) => x.created).length, 1);
      assert.equal(new Set(outcomes.map((x) => x.order.id)).size, 1);
      const id = outcomes[0].order.id;
      const original = outcomes[0].order;
      assert.equal(original.providerState, "created");
      assert.equal(original.chainState, "unobserved");
      assert.equal((await repo.reserve({ ...input })).order.id, id);
      await assert.rejects(
        repo.reserve({ ...input, amount: { ...input.amount, units: "20000" } }),
        /different terms/,
      );
      await assert.rejects(
        repo.reserve({ ...input, walletAddress: Keypair.random().publicKey() }),
        /different terms/,
      );
      assert.equal(
        await repo.getForOwner(id, "other", input.walletAddress),
        null,
      );
      assert.equal(
        await repo.getForOwner(id, "artist", Keypair.random().publicKey()),
        null,
      );
      assert.equal(
        (await repo.getForOwner(id, "artist", input.walletAddress))?.id,
        id,
      );
      await assert.rejects(
        repo.bindProviderReference(
          id,
          "other",
          input.walletAddress,
          "reference",
        ),
        /not found/,
      );
      await repo.bindProviderReference(
        id,
        "artist",
        input.walletAddress,
        "reference",
      );
      await repo.bindProviderReference(
        id,
        "artist",
        input.walletAddress,
        "reference",
      );
      await assert.rejects(
        repo.bindProviderReference(
          id,
          "artist",
          input.walletAddress,
          "replacement",
        ),
        /already has/,
      );
      const other = await repo.reserve({ ...input, requestId: randomUUID() });
      await assert.rejects(
        repo.bindProviderReference(
          other.order.id,
          "artist",
          input.walletAddress,
          "reference",
        ),
        /unique constraint/,
      );
      const counts = await db.transaction(
        async (c) =>
          (
            await c.query(
              "SELECT (SELECT COUNT(*)::int FROM ramp_events WHERE order_id=$1) events,(SELECT COUNT(*)::int FROM ramp_reconciliation_jobs WHERE order_id=$1) jobs",
              [id],
            )
          ).rows[0],
      );
      assert.deepEqual(counts, { events: 2, jobs: 1 });
      for (const sql of [
        "UPDATE ramp_events SET kind='tampered'",
        "DELETE FROM ramp_events",
        "TRUNCATE ramp_events",
      ]) {
        await assert.rejects(
          db.transaction(async (c) => {
            await c.query(sql);
          }),
          /append-only/,
        );
      }
      await assert.rejects(
        db.transaction(async (c) => {
          await c.query("DELETE FROM users WHERE id='artist'");
        }),
        /foreign key/,
      );
      await assert.rejects(
        db.transaction(async (c) => {
          await c.query("UPDATE ramp_orders SET terms='{}' WHERE id=$1", [id]);
        }),
        /immutable/,
      );
      await db.transaction(async (c) => {
        for (const orderId of [id, other.order.id])
          await c.query(
            "INSERT INTO ramp_quotes(id,order_id,provider_quote_id,snapshot,expires_at) VALUES($1,$2,'q','{}',NOW()+INTERVAL '5 minutes')",
            [orderId, orderId],
          );
        const insert =
          "INSERT INTO ramp_chain_attempts(id,order_id,quote_id,network,transaction_hash,prepared_envelope,state,expires_at) VALUES($1,$2,$3,'stellar:testnet',$4,'unsigned','confirmed',NOW()+INTERVAL '5 minutes')";
        await c.query(insert, [randomUUID(), id, id, "a".repeat(64)]);
      });
      await assert.rejects(
        db.transaction(async (c) => {
          await c.query(
            "INSERT INTO ramp_chain_attempts(id,order_id,quote_id,network,transaction_hash,prepared_envelope,state,expires_at) VALUES($1,$2,$2,'stellar:testnet',$3,'unsigned','prepared',NOW()+INTERVAL '5 minutes')",
            [randomUUID(), id, "b".repeat(64)],
          );
        }),
        /unique constraint/,
      );
      await assert.rejects(
        db.transaction(async (c) => {
          await c.query(
            "INSERT INTO ramp_chain_attempts(id,order_id,quote_id,network,transaction_hash,prepared_envelope,state,expires_at) VALUES($1,$2,$3,'stellar:testnet',$4,'unsigned','prepared',NOW()+INTERVAL '5 minutes')",
            [randomUUID(), other.order.id, id, "c".repeat(64)],
          );
        }),
        /foreign key/,
      );
      // A known processing transaction is not an unknown outcome.
      await repo.observe(id, {
        id: "reference", externalId: id, state: "processing", originalStatus: "pending",
        updatedAt: "2026-10-26T12:00:00.000Z",
      });
      const launchOrder = (
        await repo.reserve({ ...input, requestId: randomUUID() })
      ).order;
      const launchResults = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          repo.issueLaunch(launchOrder.id, "artist", input.walletAddress),
        ),
      );
      assert.equal(
        launchResults.filter((r) => r.status === "fulfilled").length,
        1,
      );
      assert.ok((await repo.get(launchOrder.id))?.launchIssuedAt);
      assert.equal((await repo.list("other", input.walletAddress)).length, 0);
      assert.equal((await repo.list("artist", input.walletAddress)).length, 3);
      const observed = {
        id: "reference",
        externalId: id,
        state: "processing",
        originalStatus: "pending",
        updatedAt: "2026-10-26T12:00:00.000Z",
      };
      await repo.observe(id, observed);
      await repo.observe(id, observed);
      await repo.observe(id, {
        ...observed,
        state: "awaiting_user",
        updatedAt: "2026-10-26T11:00:00.000Z",
      });
      assert.equal((await repo.get(id))?.providerState, "processing");
      assert.equal(
        (await repo.events(id)).filter((e) => e.source === "provider_api")
          .length,
        1,
      );
      await assert.rejects(
        repo.observe(id, { ...observed, state: "completed" }),
        /Conflicting provider observation/,
      );
      await assert.rejects(
        repo.observe(id, { ...observed, externalId: other.order.id }),
        /Unknown provider/,
      );
      await assert.rejects(
        repo.observe(id, { ...observed, id: "replacement" }),
        /Conflicting provider reference/,
      );
      await repo.observe(id, {
        ...observed,
        state: "completed",
        originalStatus: "completed",
        updatedAt: "2026-10-26T12:01:00.000Z",
      });
      assert.equal((await repo.get(id))?.chainState, "unobserved");
      const notification = { orderId: id, providerId: "reference", userId: "artist", direction: "buy" as const, key: "notification-1", kind: "transaction_updated" };
      assert.equal(await repo.recordMoonpayNotification(notification), true);
      assert.equal(await repo.recordMoonpayNotification(notification), true);
      assert.equal(await repo.recordMoonpayNotification({ ...notification, providerId: "wrong" }), false);
      assert.equal(await repo.recordMoonpayNotification({ ...notification, userId: "other" }), false);
      assert.equal(await repo.recordMoonpayNotification({ ...notification, direction: "sell" }), false);
      assert.equal(
        (await repo.events(id)).filter((e) => e.source === "verified_webhook")
          .length,
        1,
      );
      const leases = await Promise.all(
        Array.from({ length: 8 }, () => repo.lease()),
      );
      const leased = leases.filter((x) => x !== null);
      assert.equal(leased.length, 2);
      assert.deepEqual(new Set(leased.map((x) => x.order.id)), new Set([id, launchOrder.id]));
      const oldLease = leased.find((x) => x.order.id === id)!;
      await db.transaction(async (c) => { await c.query("UPDATE ramp_reconciliation_jobs SET leased_until=NOW()-INTERVAL '1 second',due_at=NOW()-INTERVAL '1 second' WHERE order_id=$1", [id]); });
      const freshLease = await repo.lease();
      assert.equal(freshLease?.order.id, id);
      assert.notEqual(freshLease?.token, oldLease.token);
      await assert.rejects(repo.observe(id, { ...observed, updatedAt: "2026-10-26T12:02:00.000Z" }, oldLease.token), /lease expired/);
      await repo.release(id, oldLease.token, "provider_check_failed");
      const stillLeased = await db.transaction(async (c) => (await c.query("SELECT lease_token FROM ramp_reconciliation_jobs WHERE order_id=$1", [id])).rows[0]);
      assert.equal(stillLeased.lease_token, freshLease?.token);
      await repo.release(id, freshLease!.token, "provider_check_failed");
      const job = await db.transaction(
        async (c) =>
          (
            await c.query(
              "SELECT attempts, leased_until, last_error_code, due_at>NOW() delayed FROM ramp_reconciliation_jobs WHERE order_id=$1",
              [id],
            )
          ).rows[0],
      );
      assert.equal(job.attempts, 1);
      assert.equal(job.leased_until, null);
      assert.equal(job.last_error_code, "provider_check_failed");
      assert.equal(job.delayed, true);
      await repo.recordMoonpayNotification(notification);
      const duplicateJob = await db.transaction(async (c) => (await c.query("SELECT due_at>NOW() delayed FROM ramp_reconciliation_jobs WHERE order_id=$1", [id])).rows[0]);
      assert.equal(duplicateJob.delayed, true);
      await db.transaction(async (c) => { await c.query("UPDATE ramp_reconciliation_jobs SET due_at=NOW() WHERE order_id=$1", [id]); });
      const notifiedLease = await repo.lease();
      assert.equal(notifiedLease?.order.id, id);
      await repo.recordMoonpayNotification({ ...notification, key: "during-lease" });
      await repo.release(id, notifiedLease!.token, null);
      const afterNotice = await db.transaction(async (c) => (await c.query("SELECT due_at<=NOW() due FROM ramp_reconciliation_jobs WHERE order_id=$1", [id])).rows[0]);
      assert.equal(afterNotice.due, true);
      const adminDetail = await repo.detailForAdmin(id);
      assert.ok(adminDetail);
      assert.equal(adminDetail.order.id, id);
      assert.equal(adminDetail.job?.last_error_code, null);
      assert.equal(adminDetail.attempts[0].transaction_hash, "a".repeat(64));
      assert.equal("prepared_envelope" in adminDetail.attempts[0], false);
      assert.equal("data" in adminDetail.events[0], false);
      assert.equal(await repo.detailForAdmin("missing"), null);
      assert.equal((await repo.listForAdmin()).length, 3);

      // Different request IDs and providers cannot race past an unresolved launch.
      const secondWallet = Keypair.random().publicKey();
      const first = (await repo.reserve(terms({ userId: "other", walletAddress: secondWallet }))).order;
      const second = (await repo.reserve(terms({ userId: "other", walletAddress: secondWallet,
        provider: "moneygram", market: { country: "ZA", currency: "ZAR", method: "cash_deposit" } }))).order;
      const racing = await Promise.allSettled([
        repo.issueLaunch(first.id, "other", secondWallet),
        repo.issueLaunch(second.id, "other", secondWallet),
      ]);
      assert.equal(racing.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(racing.filter((r) => r.status === "rejected").length, 1);
      const launched = racing[0].status === "fulfilled" ? first : second;
      const waiting = launched.id === first.id ? second : first;
      await assert.rejects(repo.issueLaunch(waiting.id, "other", secondWallet), /existing transaction/);
      await assert.rejects(repo.issueLaunch(waiting.id, "artist", secondWallet), /not found/);
      await repo.observe(launched.id, { id: "provider-race", externalId: launched.id,
        state: "processing", originalStatus: "pending", updatedAt: "2026-10-28T00:00:00.000Z" });
      await db.transaction(async (c) => { await c.query("UPDATE ramp_orders SET chain_state='unknown' WHERE id=$1", [launched.id]); });
      await assert.rejects(repo.issueLaunch(waiting.id, "other", secondWallet), /existing transaction/);
      await db.transaction(async (c) => { await c.query("UPDATE ramp_orders SET chain_state='confirmed' WHERE id=$1", [launched.id]); });
      assert.equal((await repo.issueLaunch(waiting.id, "other", secondWallet)).id, waiting.id);

      const serviceWallet = Keypair.random().publicKey();
      const serviceOwner = { userId: "other", walletAddress: serviceWallet };
      const route: VerifiedRampRoute = {
        provider: "moonpay", direction: "buy", environment: "sandbox", network: "stellar:testnet",
        assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" },
        amountDecimals: 2, minUnits: "100", maxUnits: "100000", verifiedAt: "2026-10-27T00:00:00.000Z", expiresAt: "2026-10-29T00:00:00.000Z",
      };
      let activeRoutes: VerifiedRampRoute[] = [];
      const service = createRampService(repo, { async routes() { return activeRoutes; } }, () => Date.parse("2026-10-28T00:00:00.000Z"));
      const request = { requestId: randomUUID(), provider: "moonpay", direction: "buy", assetCode: "XLM", market: route.market, amount: "100.00" };
      await assert.rejects(service.create(serviceOwner, request), /not available/);
      activeRoutes = [{ ...route, expiresAt: "2026-10-27T12:00:00.000Z" }];
      await assert.rejects(service.create(serviceOwner, request), /not available/);
      activeRoutes = [route];
      await assert.rejects(service.create(serviceOwner, { ...request, amount: "1.001" }), /precision/);
      await assert.rejects(service.create(serviceOwner, { ...request, amount: "0.10" }), /limits/);
      await assert.rejects(service.create(serviceOwner, { ...request, walletAddress: input.walletAddress }));
      const creates = await Promise.all(Array.from({ length: 8 }, () => service.create(serviceOwner, request)));
      assert.equal(creates.filter((result) => result.created).length, 1);
      assert.equal(new Set(creates.map((result) => result.order.id)).size, 1);
      assert.equal(creates[0].order.terms.amount.units, "10000");
      assert.equal(creates[0].order.terms.walletAddress, serviceWallet);
      activeRoutes = [];
      assert.equal((await service.create(serviceOwner, request)).order.id, creates[0].order.id);
      await assert.rejects(service.create(serviceOwner, { ...request, amount: "101.00" }), /different terms/);
      await assert.rejects(service.create({ ...serviceOwner, walletAddress: secondWallet }, request), /different terms/);

      const deliveryOrder = creates[0].order;
      await repo.issueLaunch(deliveryOrder.id, "other", serviceWallet);
      await db.transaction(async (c) => { await c.query("UPDATE ramp_reconciliation_jobs SET due_at=NOW()+INTERVAL '1 hour'"); await c.query("UPDATE ramp_reconciliation_jobs SET due_at=NOW() WHERE order_id=$1", [deliveryOrder.id]); });
      let deliveryLease = await repo.lease();
      assert.equal(deliveryLease?.order.id, deliveryOrder.id);
      const deliveryObservation = { id: "delivery-provider", externalId: deliveryOrder.id, state: "completed" as const, originalStatus: "completed", updatedAt: "2026-10-28T00:00:00.000Z", chainHash: "e".repeat(64), assetUnits: "12500000" };
      const delivery = { transactionHash: "e".repeat(64), operationId: "123", ledger: 42, assetUnits: "12500000" };
      await repo.observe(deliveryOrder.id, { ...deliveryObservation, assetUnits: undefined }, deliveryLease!.token);
      await repo.observe(deliveryOrder.id, deliveryObservation, deliveryLease!.token);
      await repo.release(deliveryOrder.id, deliveryLease!.token, null);
      const awaitingDelivery = await db.transaction(async (c) => (await c.query("SELECT due_at < NOW()+INTERVAL '30 seconds' AS soon FROM ramp_reconciliation_jobs WHERE order_id=$1", [deliveryOrder.id])).rows[0]);
      assert.equal(awaitingDelivery.soon, true);
      await db.transaction(async (c) => { await c.query("UPDATE ramp_reconciliation_jobs SET due_at=NOW() WHERE order_id=$1", [deliveryOrder.id]); });
      deliveryLease = await repo.lease();
      assert.equal(deliveryLease?.order.id, deliveryOrder.id);
      await assert.rejects(repo.observe(deliveryOrder.id, { ...deliveryObservation, assetUnits: "12500001" }, deliveryLease!.token), /Conflicting provider observation/);
      await assert.rejects(repo.recordIncomingDelivery(deliveryOrder.id, deliveryObservation, { ...delivery, assetUnits: "1" }, deliveryLease!.token), /does not match/);
      await assert.rejects(repo.recordIncomingDelivery(deliveryOrder.id, deliveryObservation, delivery, randomUUID()), /lease expired/);
      await repo.recordIncomingDelivery(deliveryOrder.id, deliveryObservation, delivery, deliveryLease!.token);
      await repo.recordIncomingDelivery(deliveryOrder.id, deliveryObservation, delivery, deliveryLease!.token);
      assert.equal((await repo.get(deliveryOrder.id))?.chainState, "confirmed");
      assert.equal((await repo.events(deliveryOrder.id)).filter((event) => event.kind === "incoming_delivery_confirmed").length, 1);
      const recordedDelivery = await repo.detailForAdmin(deliveryOrder.id);
      assert.equal(recordedDelivery?.deliveries[0].transaction_hash, delivery.transactionHash);
      assert.equal(recordedDelivery?.deliveries[0].operation_id, delivery.operationId);
      await assert.rejects(repo.recordIncomingDelivery(deliveryOrder.id, deliveryObservation, { ...delivery, operationId: "124" }, deliveryLease!.token), /different delivery/);
      await repo.release(deliveryOrder.id, deliveryLease!.token, null);
      const confirmedJob = await db.transaction(async (c) => (await c.query("SELECT due_at > NOW()+INTERVAL '5 hours' AS later FROM ramp_reconciliation_jobs WHERE order_id=$1", [deliveryOrder.id])).rows[0]);
      assert.equal(confirmedJob.later, true);
      await repo.recordMoonpayNotification({ orderId: deliveryOrder.id, providerId: "delivery-provider", userId: "other", direction: "buy", key: "completed-update", kind: "transaction_updated" });
      const wokenJob = await db.transaction(async (c) => (await c.query("SELECT due_at <= NOW() AS due FROM ramp_reconciliation_jobs WHERE order_id=$1", [deliveryOrder.id])).rows[0]);
      assert.equal(wokenJob.due, true);
      const regression = { ...deliveryObservation, state: "processing" as const, originalStatus: "pending", updatedAt: "2026-10-28T00:02:00.000Z" };
      assert.equal(await repo.observe(deliveryOrder.id, regression), "conflict");
      assert.equal(await repo.observe(deliveryOrder.id, regression), "conflict");
      assert.equal((await repo.get(deliveryOrder.id))?.providerState, "unknown");
      assert.equal((await repo.get(deliveryOrder.id))?.chainState, "confirmed");
      assert.equal((await repo.events(deliveryOrder.id)).filter((event) => event.kind === "status_conflict").length, 1);
      assert.equal(await repo.observe(deliveryOrder.id, deliveryObservation), "stale");
      const anotherOrder = (await repo.reserve({ ...deliveryOrder.terms, requestId: randomUUID() })).order;
      await assert.rejects(repo.issueLaunch(anotherOrder.id, "other", serviceWallet), /existing transaction/);
      await repo.observe(deliveryOrder.id, { ...deliveryObservation, updatedAt: "2026-10-28T00:03:00.000Z" });
      assert.equal((await repo.get(deliveryOrder.id))?.providerState, "completed");
      await db.transaction(async (c) => { await c.query("UPDATE ramp_reconciliation_jobs SET due_at=NOW()+INTERVAL '1 hour' WHERE order_id=$1", [deliveryOrder.id]); });

      const duplicateOrder = (await repo.reserve(terms({ userId: "other", walletAddress: Keypair.random().publicKey() }))).order;
      await repo.issueLaunch(duplicateOrder.id, "other", duplicateOrder.terms.walletAddress);
      await db.transaction(async (c) => { await c.query("UPDATE ramp_reconciliation_jobs SET due_at=NOW() WHERE order_id=$1", [duplicateOrder.id]); });
      const duplicateLease = await repo.lease();
      assert.equal(duplicateLease?.order.id, duplicateOrder.id);
      const duplicateObservation = { ...deliveryObservation, id: "another-provider", externalId: duplicateOrder.id };
      await repo.observe(duplicateOrder.id, duplicateObservation, duplicateLease!.token);
      await assert.rejects(repo.recordIncomingDelivery(duplicateOrder.id, duplicateObservation, delivery, duplicateLease!.token), /unique constraint/);
      assert.equal((await repo.get(duplicateOrder.id))?.chainState, "unobserved");

      const sessionWallet = Keypair.random().publicKey();
      const sessionOrder = (await repo.reserve(terms({ userId: "other", walletAddress: sessionWallet }))).order;
      const launchCipher = createCashOutEnvelopeCipher(Buffer.alloc(32, 8));
      const sessions = await Promise.all(Array.from({ length: 8 }, (_, n) => repo.saveLaunchSession(sessionOrder.id, "other", sessionWallet,
        launchCipher.encrypt(sessionOrder.id, "launch", sessionOrder.id, `https://example.test/session-${n}`), true)));
      assert.equal(sessions.filter((entry) => entry.created).length, 1);
      assert.equal(new Set(sessions.map((entry) => entry.encryptedSession.toString("base64"))).size, 1);
      assert.match(launchCipher.decrypt(sessionOrder.id, "launch", sessionOrder.id, sessions[0].encryptedSession), /^https:\/\/example\.test\/session-/);
      await assert.rejects(repo.saveLaunchSession(sessionOrder.id, "artist", sessionWallet, Buffer.alloc(40), true), /not found/);
      await assert.rejects(repo.saveLaunchSession(sessionOrder.id, "other", sessionWallet, Buffer.alloc(40), false), /existing transaction/);
      await assert.rejects(db.transaction(async (c) => { await c.query("UPDATE ramp_launch_sessions SET resumable=false WHERE order_id=$1", [sessionOrder.id]); }), /append-only/);
      await assert.rejects(db.transaction(async (c) => { await c.query("DELETE FROM ramp_launch_sessions WHERE order_id=$1", [sessionOrder.id]); }), /append-only/);
      await db.transaction(async (c) => { await c.query("UPDATE ramp_orders SET provider_state='unknown' WHERE id=$1", [sessionOrder.id]); });
      await assert.rejects(repo.saveLaunchSession(sessionOrder.id, "other", sessionWallet, Buffer.alloc(40), true), /existing transaction/);

      const adapterWallet = Keypair.random().publicKey();
      const adapterOrder = (await repo.reserve(terms({ userId: "other", walletAddress: adapterWallet }))).order;
      let prepareCalls = 0;
      const adapterService = createRampLaunchService(repo, new Map([["moonpay", { safeResume: true, async prepare(order) {
        prepareCalls++;
        const params = new URLSearchParams({ apiKey: "pk_test_fixture", externalTransactionId: order.id, externalCustomerId: order.terms.userId, theme: "dark", lockAmount: "true", currencyCode: "usdc_xlm", walletAddress: order.terms.walletAddress, baseCurrencyCode: "zar", baseCurrencyAmount: "100.00", allowedIpAddress: "binding", signature: "test-signature" });
        return `https://buy-sandbox.moonpay.com/?${params}`;
      } }]]), launchCipher, async () => true);
      const launchOwner = { userId: "other", walletAddress: adapterWallet };
      const firstLaunch = await adapterService.launch(adapterOrder.id, launchOwner, ["203.0.113.1"]);
      assert.equal(firstLaunch.created, true);
      assert.deepEqual(await adapterService.launch(adapterOrder.id, launchOwner, ["203.0.113.1"]), { url: firstLaunch.url, created: false });
      assert.equal(prepareCalls, 1);
      const savedLaunch = await db.transaction(async (c) => (await c.query("SELECT encrypted_session FROM ramp_launch_sessions WHERE order_id=$1", [adapterOrder.id])).rows[0].encrypted_session as Buffer);
      assert.equal(savedLaunch.includes(Buffer.from(firstLaunch.url)), false);
      await assert.rejects(adapterService.launch(adapterOrder.id, { ...launchOwner, userId: "artist" }, ["203.0.113.1"]), /not found/);

      const cashKey = Keypair.random(), cashWallet = cashKey.publicKey(), cashIssuer = Keypair.random().publicKey();
      const cashOrder = (await repo.reserve(terms({ userId: "other", walletAddress: cashWallet, direction: "sell", assetIssuer: cashIssuer,
        market: { country: "GB", currency: "GBP", method: "bank" }, amount: { currency: "USDC", units: "10000000", decimals: 7 } }))).order;
      await repo.bindProviderReference(cashOrder.id, "other", cashWallet, "cash-provider");
      const quoteId = randomUUID(), when = new Date("2026-10-28T12:00:00.000Z");
      const quote = { id: quoteId, cashOutId: cashOrder.id, sessionId: "session", providerQuoteId: "provider-quote", providerTransactionId: "cash-provider", provider: "moonpay", environment: "sandbox", network: "stellar:testnet", walletAddress: cashWallet, market: { country: "GB", currency: "GBP", payoutMethod: "bank" }, debitUnits: "10000000", receive: { currency: "GBP", units: "75", decimals: 2 }, fees: [], destinationLabel: "Bank account ending 1234", createdAt: "2026-10-28T11:59:00.000Z", expiresAt: "2026-10-28T12:10:00.000Z" };
      const instructions = { provider: "moonpay", environment: "sandbox", network: "stellar:testnet", walletAddress: cashWallet, cashOutId: cashOrder.id, quoteId, providerTransactionId: "cash-provider", destination: Keypair.random().publicKey(), assetCode: "USDC", assetIssuer: cashIssuer, amountUnits: "10000000", memo: { type: "id", value: "123" }, expiresAt: "2026-10-28T12:05:00.000Z" };
      const saves = await Promise.all(Array.from({ length: 8 }, () => repo.saveCashOutQuote(cashOrder.id, "other", cashWallet, quote, instructions, when)));
      assert.equal(new Set(saves.map((result) => result.hash)).size, 1);
      assert.equal(saves[0].expiresAt, instructions.expiresAt);
      const storedQuote = await repo.getCashOutQuote(cashOrder.id, quoteId, "other", cashWallet);
      assert.equal(storedQuote?.hash, saves[0].hash);
      let adapterCalls = 0;
      const quoteService = createCashOutQuoteService(repo, new Map([["moonpay", { async quote(received) { adapterCalls++; assert.equal(received.id, cashOrder.id); return { quote, instructions }; } }]]), () => when);
      assert.equal((await quoteService.request(cashOrder.id, { userId: "other", walletAddress: cashWallet })).hash, saves[0].hash);
      await assert.rejects(quoteService.request(cashOrder.id, { userId: "artist", walletAddress: cashWallet }), /not found/);
      assert.equal(adapterCalls, 1);
      const unavailable = createCashOutQuoteService(repo, new Map(), () => when);
      await assert.rejects(unavailable.request(cashOrder.id, { userId: "other", walletAddress: cashWallet }), /not available/);
      assert.equal(await repo.getCashOutQuote(cashOrder.id, quoteId, "artist", cashWallet), null);
      assert.equal(await repo.getCashOutQuote(cashOrder.id, quoteId, "other", input.walletAddress), null);
      await assert.rejects(repo.saveCashOutQuote(cashOrder.id, "artist", cashWallet, quote, instructions, when), /not found/);
      await assert.rejects(repo.saveCashOutQuote(cashOrder.id, "other", cashWallet, { ...quote, receive: { ...quote.receive, units: "76" } }, instructions, when), /different terms/);
      for (const patch of [{ amountUnits: "9999999" }, { assetIssuer: Keypair.random().publicKey() }, { destination: cashWallet }, { providerTransactionId: "wrong" }])
        await assert.rejects(repo.saveCashOutQuote(cashOrder.id, "other", cashWallet, quote, { ...instructions, ...patch }, when));
      await assert.rejects(repo.saveCashOutQuote(cashOrder.id, "other", cashWallet, quote, instructions, new Date(instructions.expiresAt)), /new quote/);
      for (const sql of ["UPDATE ramp_quotes SET snapshot='{}' WHERE id=$1", "DELETE FROM ramp_quotes WHERE id=$1"]) await assert.rejects(db.transaction(async (c) => { await c.query(sql, [quoteId]); }), /append-only/);
      await assert.rejects(db.transaction(async (c) => { await c.query("UPDATE ramp_orders SET terms=jsonb_set(terms,'{amount,units}',to_jsonb('1'::text)) WHERE id=$1", [cashOrder.id]); }), /immutable/);

      const prepareInput = { orderId: cashOrder.id, quoteId, confirmationHash: saves[0].hash, userId: "other", walletAddress: cashWallet, sequence: "42", feeStroops: 100, maxFeeStroops: 1000, preparedLedger: 42, now: when };
      await assert.rejects(repo.prepareCashOutAttempt({ ...prepareInput, confirmationHash: "f".repeat(64) }), /Review/);
      await assert.rejects(repo.prepareCashOutAttempt({ ...prepareInput, userId: "artist" }), /not found/);
      const prepared = await Promise.all(Array.from({ length: 8 }, () => repo.prepareCashOutAttempt(prepareInput)));
      assert.equal(new Set(prepared.map((attempt) => attempt.id)).size, 1);
      assert.equal((await repo.get(cashOrder.id))?.chainState, "prepared");
      assert.equal(prepared[0].state, "prepared");
      const changedQuoteId = randomUUID();
      await assert.rejects(repo.saveCashOutQuote(cashOrder.id, "other", cashWallet, { ...quote, id: changedQuoteId, providerQuoteId: "new-quote" }, { ...instructions, quoteId: changedQuoteId }, when), /existing transfer/);
      const concurrentOrder = (await repo.reserve({ ...cashOrder.terms, requestId: randomUUID() })).order;
      await repo.bindProviderReference(concurrentOrder.id, "other", cashWallet, "other-cash-provider");
      const concurrentQuoteId = randomUUID();
      const concurrentQuote = { ...quote, id: concurrentQuoteId, cashOutId: concurrentOrder.id, providerQuoteId: "other-quote", providerTransactionId: "other-cash-provider" };
      const concurrentInstructions = { ...instructions, quoteId: concurrentQuoteId, cashOutId: concurrentOrder.id, providerTransactionId: "other-cash-provider" };
      const concurrentSaved = await repo.saveCashOutQuote(concurrentOrder.id, "other", cashWallet, concurrentQuote, concurrentInstructions, when);
      await assert.rejects(repo.prepareCashOutAttempt({ ...prepareInput, orderId: concurrentOrder.id, quoteId: concurrentQuoteId, confirmationHash: concurrentSaved.hash }), /existing transfer/);
      await assert.rejects(repo.cancelUnsignedCashOutAttempt(cashOrder.id, prepared[0].id, "artist", cashWallet), /not found/);
      await repo.cancelUnsignedCashOutAttempt(cashOrder.id, prepared[0].id, "other", cashWallet);
      await repo.cancelUnsignedCashOutAttempt(cashOrder.id, prepared[0].id, "other", cashWallet);
      assert.equal((await repo.get(cashOrder.id))?.chainState, "unobserved");
      const secondAttempt = await repo.prepareCashOutAttempt(prepareInput);
      assert.notEqual(secondAttempt.id, prepared[0].id);
      assert.notEqual(secondAttempt.transactionHash, prepared[0].transactionHash);
      await assert.rejects(db.transaction(async (c) => { await c.query("UPDATE ramp_chain_attempts SET transaction_hash=$2 WHERE id=$1", [secondAttempt.id, "d".repeat(64)]); }), /immutable/);
      await assert.rejects(db.transaction(async (c) => { await c.query("DELETE FROM ramp_chain_attempts WHERE id=$1", [secondAttempt.id]); }), /append-only/);
      await assert.rejects(db.transaction(async (c) => { await c.query("UPDATE ramp_chain_attempts SET state='confirmed' WHERE id=$1", [secondAttempt.id]); }), /Invalid ramp transfer state/);
      await assert.rejects(db.transaction(async (c) => { await c.query("UPDATE ramp_chain_attempts SET state='submitting' WHERE id=$1", [secondAttempt.id]); }), /signed transfer/);
      const cipher = createCashOutEnvelopeCipher(Buffer.alloc(32, 7));
      const signedTx = TransactionBuilder.fromXDR(secondAttempt.transaction, Networks.TESTNET);
      signedTx.sign(cashKey);
      const account = { account_id: cashWallet, thresholds: { med_threshold: 1 }, signers: [{ key: cashWallet, type: "ed25519_public_key", weight: 1 }] };
      const authorization = { orderId: cashOrder.id, attemptId: secondAttempt.id, userId: "other", walletAddress: cashWallet, signedXdr: signedTx.toXDR(), account, cipher, now: when };
      await assert.rejects(repo.authorizeCashOutAttempt({ ...authorization, userId: "artist" }), /not found/);
      await db.transaction(async (c) => { await c.query("UPDATE ramp_orders SET provider_state='failed' WHERE id=$1", [cashOrder.id]); });
      await assert.rejects(repo.authorizeCashOutAttempt(authorization), /cannot be authorized/);
      await db.transaction(async (c) => { await c.query("UPDATE ramp_orders SET provider_state='created' WHERE id=$1", [cashOrder.id]); });
      const outsider = TransactionBuilder.fromXDR(secondAttempt.transaction, Networks.TESTNET); outsider.sign(Keypair.random());
      await assert.rejects(repo.authorizeCashOutAttempt({ ...authorization, signedXdr: outsider.toXDR() }), /signature/);
      await assert.rejects(repo.authorizeCashOutAttempt({ ...authorization, now: new Date(secondAttempt.expiresAt) }), /expired/);
      const authorizations = await Promise.all(Array.from({ length: 8 }, () => repo.authorizeCashOutAttempt(authorization)));
      assert.ok(authorizations.every((attempt) => attempt.state === "submitting" && attempt.transactionHash === secondAttempt.transactionHash));
      const encrypted = await db.transaction(async (c) => (await c.query("SELECT signed_envelope_encrypted FROM ramp_chain_attempts WHERE id=$1", [secondAttempt.id])).rows[0].signed_envelope_encrypted as Buffer);
      assert.equal(encrypted.includes(Buffer.from(signedTx.toXDR())), false);
      assert.equal(cipher.decrypt(cashOrder.id, secondAttempt.id, secondAttempt.transactionHash, encrypted), signedTx.toXDR());
      assert.equal((await repo.get(cashOrder.id))?.chainState, "submitting");
      assert.equal((await repo.events(cashOrder.id)).filter((event) => event.kind === "transfer_authorized").length, 1);
      await assert.rejects(repo.authorizeCashOutAttempt({ ...authorization, signedXdr: outsider.toXDR() }), /different signed/);
      await assert.rejects(db.transaction(async (c) => { await c.query("UPDATE ramp_chain_attempts SET signed_envelope_encrypted=$2 WHERE id=$1", [secondAttempt.id, Buffer.from("replaced")]); }), /immutable/);
      await assert.rejects(repo.cancelUnsignedCashOutAttempt(cashOrder.id, secondAttempt.id, "other", cashWallet), /existing transfer/);
      assert.equal((await repo.prepareCashOutAttempt(prepareInput)).state, "submitting");
      await assert.rejects(repo.prepareCashOutAttempt({ ...prepareInput, orderId: concurrentOrder.id, quoteId: concurrentQuoteId, confirmationHash: concurrentSaved.hash }), /existing transfer/);

      // Simulated transport, real signatures and PostgreSQL: recover a lost submission by its original hash.
      await db.transaction(async (c) => { await c.query("UPDATE ramp_chain_attempts SET due_at=NOW()+INTERVAL '1 hour' WHERE state IN ('submitting','unknown')"); });
      const liveKey = Keypair.random(), liveWallet = liveKey.publicKey(), liveIssuer = Keypair.random().publicKey();
      const liveOrder = (await repo.reserve(terms({ userId: "other", walletAddress: liveWallet, direction: "sell", assetIssuer: liveIssuer,
        market: { country: "GB", currency: "GBP", method: "bank" }, amount: { currency: "USDC", units: "10000000", decimals: 7 } }))).order;
      await repo.bindProviderReference(liveOrder.id, "other", liveWallet, "recovery-provider");
      const liveNow = new Date(), liveExpiry = new Date(liveNow.getTime()+600000).toISOString(), liveQuoteId = randomUUID();
      const liveQuote = { ...quote, id: liveQuoteId, cashOutId: liveOrder.id, walletAddress: liveWallet, providerQuoteId: "recovery-quote", providerTransactionId: "recovery-provider", createdAt: new Date(liveNow.getTime()-1000).toISOString(), expiresAt: liveExpiry };
      const liveInstructions = { ...instructions, cashOutId: liveOrder.id, quoteId: liveQuoteId, walletAddress: liveWallet, providerTransactionId: "recovery-provider", assetIssuer: liveIssuer, expiresAt: liveExpiry };
      const liveSaved = await repo.saveCashOutQuote(liveOrder.id, "other", liveWallet, liveQuote, liveInstructions, liveNow);
      const liveInput = { orderId: liveOrder.id, quoteId: liveQuoteId, confirmationHash: liveSaved.hash, userId: "other", walletAddress: liveWallet, sequence: "11", feeStroops: 100, maxFeeStroops: 1000, preparedLedger: 42, now: liveNow };
      const authorizationService = createCashOutAuthorizationService(repo, {
        async preparationLedger() { return { sequence: 42, base_fee_in_stroops: 100, closed_at: liveNow.toISOString() }; },
        async account(address) { assert.equal(address, liveWallet); return { account_id: liveWallet, sequence: "11", thresholds: { med_threshold: 0 }, signers: [{ key: liveWallet, type: "ed25519_public_key", weight: 1 }] }; },
      }, cipher, async () => true);
      const liveOwner = { userId: "other", walletAddress: liveWallet };
      const liveAttempt = await authorizationService.prepare(liveOrder.id, liveQuoteId, liveSaved.hash, liveOwner);
      assert.equal((await authorizationService.latest(liveOrder.id, liveOwner))?.transaction, liveAttempt.transaction);
      assert.equal((await authorizationService.latest(liveOrder.id, liveOwner))?.networkFeeStroops, "100");
      assert.equal(await repo.latestCashOutAttempt(liveOrder.id, "artist", liveWallet), null);
      const liveTx = TransactionBuilder.fromXDR(liveAttempt.transaction, Networks.TESTNET); liveTx.sign(liveKey);
      await authorizationService.authorize(liveOrder.id, liveAttempt.id, liveTx.toXDR(), liveOwner);
      const resumed = await authorizationService.latest(liveOrder.id, liveOwner);
      assert.equal(resumed?.transaction, null);
      assert.equal(resumed?.transactionHash, liveAttempt.transactionHash);
      const staleLease = await repo.leaseCashOut();
      assert.equal(staleLease?.id, liveAttempt.id);
      await db.transaction(async (c) => { await c.query("UPDATE ramp_chain_attempts SET leased_until=NOW()-INTERVAL '1 second',due_at=NOW()-INTERVAL '1 second' WHERE id=$1", [liveAttempt.id]); });
      const newLease = await repo.leaseCashOut();
      assert.equal(newLease?.id, liveAttempt.id);
      assert.notEqual(staleLease?.token, newLease?.token);
      assert.equal(await repo.claimCashOutSubmission(liveAttempt.id, staleLease!.token), false);
      await assert.rejects(repo.recordCashOutReceipt(liveAttempt.id, staleLease!.token, { hash: liveAttempt.transactionHash, successful: true, envelope_xdr: liveTx.toXDR(), ledger: 51, fee_charged: "100" }), /lease expired/);
      await repo.releaseCashOut(liveAttempt.id, staleLease!.token, null);
      const currentLease = await db.transaction(async (c) => (await c.query("SELECT lease_token FROM ramp_chain_attempts WHERE id=$1", [liveAttempt.id])).rows[0]);
      assert.equal(currentLease.lease_token, newLease?.token);
      await repo.releaseCashOut(liveAttempt.id, newLease!.token, null);
      await db.transaction(async (c) => { await c.query("UPDATE ramp_chain_attempts SET due_at=NOW() WHERE id=$1", [liveAttempt.id]); });
      let submissions = 0, found = false;
      const chain = { async ledger() { return { sequence: 50, closed_at: liveNow.toISOString() }; }, async historyCoverage() { return { start: 1, latest: 50, latestClosedAt: liveNow.toISOString() }; },
        async receipt(hash: string) { assert.equal(hash, liveAttempt.transactionHash); return found ? { hash, successful: true, envelope_xdr: liveTx.toXDR(), ledger: 51, fee_charged: "100" } : null; },
        async submit(xdr: string) { submissions++; assert.equal(xdr, liveTx.toXDR()); throw new Error("lost response"); } };
      await reconcileCashOut(repo, chain, cipher);
      assert.equal(submissions, 1);
      assert.equal((await repo.get(liveOrder.id))?.chainState, "unknown");
      const pending = await db.transaction(async (c) => (await c.query("SELECT state,submission_count,last_error_code FROM ramp_chain_attempts WHERE id=$1", [liveAttempt.id])).rows[0]);
      assert.deepEqual(pending, { state: "unknown", submission_count: 1, last_error_code: "submission_unknown" });
      assert.equal((await repo.prepareCashOutAttempt(liveInput)).transactionHash, liveAttempt.transactionHash);
      found = true;
      await db.transaction(async (c) => { await c.query("UPDATE ramp_chain_attempts SET due_at=NOW() WHERE id=$1", [liveAttempt.id]); });
      await reconcileCashOut(repo, chain, cipher);
      assert.equal(submissions, 1);
      assert.equal((await repo.get(liveOrder.id))?.chainState, "confirmed");
      assert.equal((await repo.events(liveOrder.id)).filter((event) => event.kind === "cashout_transfer_confirmed").length, 1);
      assert.equal((await repo.get(liveOrder.id))?.providerState, "created");

      // A closed ledger alone is insufficient when the server has pruned relevant history.
      await db.transaction(async (c) => { await c.query("UPDATE ramp_chain_attempts SET due_at=NOW() WHERE id=$1", [secondAttempt.id]); });
      let oldest = 43;
      const expiredChain = { async ledger() { return { sequence: 50, closed_at: new Date(Date.parse(secondAttempt.expiresAt)+1000).toISOString() }; },
        async historyCoverage() { return { start: oldest, latest: 50, latestClosedAt: new Date(Date.parse(secondAttempt.expiresAt)+1000).toISOString() }; }, async receipt() { return null; }, async submit() { assert.fail("expired transfer must not be submitted"); } };
      await reconcileCashOut(repo, expiredChain, cipher);
      assert.equal((await repo.get(cashOrder.id))?.chainState, "unknown");
      const unresolved = await db.transaction(async (c) => (await c.query("SELECT state,last_error_code FROM ramp_chain_attempts WHERE id=$1", [secondAttempt.id])).rows[0]);
      assert.deepEqual(unresolved, { state: "unknown", last_error_code: "history_unavailable" });
      await assert.rejects(repo.prepareCashOutAttempt({ ...prepareInput, orderId: concurrentOrder.id, quoteId: concurrentQuoteId, confirmationHash: concurrentSaved.hash }), /existing transfer/);
      oldest = 1;
      await db.transaction(async (c) => { await c.query("UPDATE ramp_chain_attempts SET due_at=NOW() WHERE id=$1", [secondAttempt.id]); });
      await reconcileCashOut(repo, expiredChain, cipher);
      assert.equal((await repo.get(cashOrder.id))?.chainState, "expired");
      assert.equal((await repo.events(cashOrder.id)).filter((event) => event.kind === "cashout_transfer_expired").length, 1);
    } finally {
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
      await pool.end();
    }
  },
);
