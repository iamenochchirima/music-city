import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { Keypair } from "@stellar/stellar-sdk";
import { rampOrderTermsSchema, type RampOrderTerms } from "@music-city/shared";
import { createRampRepository } from "./ramp.repository.js";
import { rampProgressStatements } from "./ramp-progress-migration.js";
import { rampSchemaStatements } from "./ramp-migration.js";
import { rampLeaseStatements } from "./ramp-lease-migration.js";
import { createRampService, verifiedRampCapabilities, type VerifiedRampRoute } from "./ramp-service.js";

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
        for (const sql of [...rampSchemaStatements, ...rampProgressStatements, ...rampLeaseStatements])
          await c.query(sql);
        for (const sql of [...rampSchemaStatements, ...rampProgressStatements, ...rampLeaseStatements])
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
        /check constraint/,
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
      await repo.release(id, oldLease.token, true);
      const stillLeased = await db.transaction(async (c) => (await c.query("SELECT lease_token FROM ramp_reconciliation_jobs WHERE order_id=$1", [id])).rows[0]);
      assert.equal(stillLeased.lease_token, freshLease?.token);
      await repo.release(id, freshLease!.token, true);
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
      await repo.release(id, notifiedLease!.token, false);
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
    } finally {
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
      await pool.end();
    }
  },
);
