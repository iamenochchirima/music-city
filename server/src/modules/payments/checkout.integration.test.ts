import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import type { PaymentIntentRecord } from "@music-city/shared";
const url = process.env.CHECKOUT_TEST_DATABASE_URL;
test(
  "PostgreSQL durable checkout: real signatures with mocked chain and accounting boundaries",
  { skip: !url },
  async (t) => {
    const target = new URL(url!);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(target.hostname) &&
        target.pathname.endsWith("_test"),
    );
    process.env.DATABASE_URL = url;
    process.env.NODE_ENV = "test";
    const { databaseService: db } = await import(
      "../../services/database.service.js"
    );
    const { env } = await import("../../config/env.js");
    const { checkoutService: service } = await import("./checkout.service.js");
    const { checkoutChain: chain } = await import("./checkout-chain.js");
    const { paymentsService } = await import("./payments.service.js");
    const { paymentsRepository } = await import("./payments.repository.js");
    const original = { ...chain },
      originalConfirm = paymentsService.confirm;
    const sender = Keypair.random(),
      recipient = Keypair.random(),
      outsider = Keypair.random();
    const issuer = Keypair.random().publicKey();
    env.STELLAR_NETWORK_PASSPHRASE = Networks.TESTNET;
    env.STELLAR_SETTLEMENT_ASSET_ISSUER = issuer;
    let closed = Date.now(),
      historyStart = 1,
      sequence = 42,
      submitted = 0,
      confirmed = 0;
    const receipts = new Map<
      string,
      Awaited<ReturnType<typeof chain.receipt>>
    >();
    await db.initialize({ repair: false });
    for (const key of [sender, recipient]) {
      await db.upsertUser(
        randomUUID(),
        key.publicKey(),
        "listener",
        "complete",
        "complete",
        1,
        new Date().toISOString(),
        { walletAddress: key.publicKey() },
      );
    }
    chain.account = async (wallet) => ({
      account_id: wallet,
      sequence: String(sequence++),
      subentry_count: 1,
      balances: [
        { asset_type: "native", balance: "100" },
        {
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          asset_issuer: issuer,
          balance: "100",
          limit: "1000",
          is_authorized: true,
        },
      ],
      thresholds: { med_threshold: 1 },
      signers: [{ key: wallet, type: "ed25519_public_key", weight: 1 }],
    });
    chain.ledger = async () => ({
      sequence: 100,
      closed_at: new Date(closed).toISOString(),
      base_reserve_in_stroops: 5000000,
      base_fee_in_stroops: 100,
    });
    chain.historyStart = async () => historyStart;
    chain.receipt = async (hash) => receipts.get(hash) ?? null;
    chain.submit = async (signed) => {
      const tx = TransactionBuilder.fromXDR(signed, Networks.TESTNET);
      const found = await db.transaction((c) =>
        c.query(
          "SELECT status,signed_transaction FROM payment_checkouts WHERE transaction_hash=$1",
          [tx.hash().toString("hex")],
        ),
      );
      assert.equal(found.rows[0].status, "submitting");
      assert.equal(found.rows[0].signed_transaction, signed);
      submitted++;
      throw new Error("Timeout after possible chain acceptance");
    };
    paymentsService.confirm = async (_wallet, _input) => {
      confirmed++;
      return {} as Awaited<ReturnType<typeof paymentsService.confirm>>;
    };
    async function intent() {
      const id = `payi_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
      const createdAt = new Date().toISOString();
      const record: PaymentIntentRecord = {
        id,
        walletAddress: sender.publicKey(),
        productType: "platform_subscription",
        amount: "1.0000001",
        assetCode: "USDC",
        assetIssuer: issuer,
        destinationAddress: recipient.publicKey(),
        memo: id,
        status: "pending",
        networkPassphrase: Networks.TESTNET,
        createdAt,
        updatedAt: createdAt,
        expiresAt: new Date(Date.now() + 900000).toISOString(),
      };
      return paymentsRepository.upsertIntent(record);
    }
    const sign = (transaction: string, key = sender) => {
      const tx = TransactionBuilder.fromXDR(transaction, Networks.TESTNET);
      tx.sign(key);
      return tx.toXDR();
    };
    try {
      const order = await intent();
      let attempt!: Awaited<ReturnType<typeof service.prepare>>;
      await t.test(
        "concurrent preparations retain one transaction and one prepared event",
        async () => {
          const results = await Promise.all(
            Array.from({ length: 12 }, () =>
              service.prepare(sender.publicKey(), order.id),
            ),
          );
          attempt = results[0]!;
          assert.ok(
            results.every(
              (result) =>
                result.id === attempt.id &&
                result.transactionHash === attempt.transactionHash,
            ),
          );
          const events = await db.transaction((c) =>
            c.query("SELECT action FROM checkout_events WHERE checkout_id=$1", [
              attempt.id,
            ]),
          );
          assert.deepEqual(
            events.rows.map((r) => r.action),
            ["prepared"],
          );
          assert.equal(
            await service
              .activeIntent(sender.publicKey())
              .then((value) => value?.id),
            order.id,
          );
        },
      );
      await t.test(
        "another wallet, changed transaction and wrong signer cannot authorize",
        async () => {
          await assert.rejects(
            service.get(outsider.publicKey(), attempt.id),
            /not found/,
          );
          await assert.rejects(
            service.authorize(
              outsider.publicKey(),
              attempt.id,
              sign(attempt.transaction),
            ),
            /not found/,
          );
          await assert.rejects(
            service.authorize(
              sender.publicKey(),
              attempt.id,
              sign(attempt.transaction, outsider),
            ),
            /does not authorize/,
          );
          const tx = TransactionBuilder.fromXDR(
            attempt.transaction,
            Networks.PUBLIC,
          );
          tx.sign(sender);
          await assert.rejects(
            service.authorize(sender.publicKey(), attempt.id, tx.toXDR()),
            /does not authorize/,
          );
          const next = await intent();
          await assert.rejects(
            service.prepare(sender.publicKey(), next.id),
            /pending payment/,
          );
          assert.equal(submitted, 0);
        },
      );
      await t.test(
        "an unsigned cancellation and retry reuse the original transaction",
        async () => {
          const again = await service.prepare(sender.publicKey(), order.id);
          assert.equal(again.transactionHash, attempt.transactionHash);
          await service.submit(sender.publicKey(), attempt.id);
          assert.equal(submitted, 0);
        },
      );
      await t.test(
        "authorization commits before submission; lost response retains the same hash",
        async () => {
          const signed = sign(attempt.transaction);
          const authorized = await service.authorize(
            sender.publicKey(),
            attempt.id,
            signed,
          );
          assert.equal(authorized.status, "submitting");
          const uncertain = await service.submit(
            sender.publicKey(),
            attempt.id,
          );
          assert.equal(uncertain.status, "submitting");
          assert.equal(uncertain.submissionCount, 1);
          assert.equal(submitted, 1);
          const repeated = await service.submit(sender.publicKey(), attempt.id);
          assert.equal(repeated.transactionHash, attempt.transactionHash);
          assert.equal(submitted, 1);
          const retained = await service.prepare(sender.publicKey(), order.id);
          assert.equal(retained.status, "submitting");
          assert.equal(retained.id, attempt.id);
          receipts.set(attempt.transactionHash, {
            hash: attempt.transactionHash,
            successful: true,
            envelope_xdr: signed,
            ledger: 101,
            fee_charged: "100",
          });
        },
      );
      await t.test(
        "the worker confirms the original transaction exactly once without the browser",
        async () => {
          await service.cycle();
          await service.cycle();
          const current = await service.get(sender.publicKey(), attempt.id);
          assert.equal(current.status, "confirmed");
          assert.equal(current.ledger, 101);
          assert.equal(confirmed, 1);
          assert.equal(submitted, 1);
          const events = await db.transaction((c) =>
            c.query(
              "SELECT action FROM checkout_events WHERE checkout_id=$1 ORDER BY id",
              [attempt.id],
            ),
          );
          assert.deepEqual(
            events.rows.map((r) => r.action),
            [
              "prepared",
              "authorized",
              "submit_attempt",
              "chain_confirmed",
              "confirmed",
            ],
          );
        },
      );
      await t.test(
        "original terms, signed envelopes, terminal outcomes and audit events are immutable",
        async () => {
          for (const sql of [
            "UPDATE payment_checkouts SET payload=jsonb_set(payload,'{transactionHash}',to_jsonb(repeat('a',64))) WHERE id=$1",
            "UPDATE payment_checkouts SET signed_transaction='changed' WHERE id=$1",
            "DELETE FROM payment_checkouts WHERE id=$1",
            "DELETE FROM checkout_events WHERE checkout_id=$1",
          ])
            await assert.rejects(
              db.transaction((c) => c.query(sql, [attempt.id])),
              /immutable|retained|append-only/,
            );
        },
      );
      await t.test(
        "pruned history keeps an expired-looking payment unresolved and blocks a replacement",
        async () => {
          const next = await intent();
          const prepared = await service.prepare(sender.publicKey(), next.id);
          closed = Date.parse(prepared.expiresAt) + 1000;
          historyStart = 101;
          assert.equal(
            (await service.get(sender.publicKey(), prepared.id)).status,
            "prepared",
          );
          await assert.rejects(
            service.prepare(sender.publicKey(), (await intent()).id),
            /pending payment/,
          );
          historyStart = 1;
          assert.equal(
            (await service.get(sender.publicKey(), prepared.id)).status,
            "expired",
          );
          assert.equal(await service.activeIntent(sender.publicKey()), null);
        },
      );
    } finally {
      Object.assign(chain, original);
      paymentsService.confirm = originalConfirm;
      await db.close();
    }
  },
);
