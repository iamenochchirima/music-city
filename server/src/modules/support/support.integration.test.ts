import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import type { SupportPayment, SupportRecipient } from "@music-city/shared";
const url = process.env.SUPPORT_TEST_DATABASE_URL;
test(
  "PostgreSQL direct support lifecycle, concurrency, signatures, and retained evidence",
  { skip: !url },
  async (t) => {
    const target = new URL(url!);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(target.hostname) &&
        target.pathname.endsWith("_test"),
    );
    process.env.DATABASE_URL = url;
    process.env.NODE_ENV = "test";
    const { databaseService: db } =
      await import("../../services/database.service.js");
    const { env } = await import("../../config/env.js");
    const { supportService: s } = await import("./support.service.js");
    const { supportChain: chain } = await import("./support-chain.js");
    const originalChain = { ...chain },
      originalRecipient = s.recipient;
    env.STELLAR_NETWORK_PASSPHRASE = Networks.TESTNET;
    env.STELLAR_SETTLEMENT_ASSET_CODE = "USDC";
    env.STELLAR_SETTLEMENT_ASSET_ISSUER =
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
    const sender = Keypair.random(),
      artist = Keypair.random(),
      contributor = Keypair.random(),
      outsider = Keypair.random();
    let now = Date.now(),
      sequence = 100,
      submitted = 0;
    const receipts = new Map<
      string,
      Awaited<ReturnType<typeof chain.receipt>>
    >();
    await db.initialize({ repair: false });
    const ids = new Map<string, string>();
    for (const [name, key] of [
      ["Supporter", sender],
      ["Artist", artist],
      ["Contributor", contributor],
    ] as const) {
      const id = randomUUID();
      ids.set(key.publicKey(), id);
      await db.upsertUser(
        id,
        key.publicKey(),
        name === "Artist" ? "artist" : "listener",
        "complete",
        "complete",
        1,
        new Date().toISOString(),
        {
          id,
          walletAddress: key.publicKey(),
          displayName: name,
          primaryIntent: name === "Artist" ? "artist" : "listener",
          onboardingStatus: "complete",
        },
      );
    }
    const recipients: SupportRecipient[] = [
      {
        name: "Artist",
        role: "Artist",
        walletAddress: artist.publicKey(),
        target: { kind: "artist", profileId: ids.get(artist.publicKey())! },
      },
      {
        name: "Contributor",
        role: "Producer",
        walletAddress: contributor.publicKey(),
        target: {
          kind: "contributor",
          profileId: ids.get(contributor.publicKey())!,
          trackId: "track",
        },
      },
    ];
    s.recipient = async (target) => {
      const r = recipients.find(
        (r) => JSON.stringify(r.target) === JSON.stringify(target),
      );
      if (!r) throw new Error("Recipient unavailable");
      return r;
    };
    chain.account = async (wallet) => ({
      account_id: wallet,
      sequence: String(sequence++),
      subentry_count: 1,
      balances: [
        { asset_type: "native", balance: "50" },
        {
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          asset_issuer: env.STELLAR_SETTLEMENT_ASSET_ISSUER,
          balance: "20",
          limit: "1000",
          is_authorized: true,
        },
      ],
      thresholds: { med_threshold: 1 },
      signers: [{ key: wallet, weight: 1, type: "ed25519_public_key" }],
    });
    chain.ledger = async () => ({
      closed_at: new Date(now).toISOString(),
      sequence: 100,
      base_fee_in_stroops: 100,
      base_reserve_in_stroops: 5000000,
    });
    chain.historyStart = async () => 1;
    chain.receipt = async (hash) => receipts.get(hash) ?? null;
    chain.submit = async (signed) => {
      submitted++;
      const tx = TransactionBuilder.fromXDR(signed, Networks.TESTNET);
      const persisted = await db.transaction((c) =>
        c.query(
          "SELECT signed_transaction,status FROM support_payments WHERE transaction_hash=$1",
          [tx.hash().toString("hex")],
        ),
      );
      assert.equal(persisted.rows[0]?.status, "submitting");
      assert.equal(persisted.rows[0]?.signed_transaction, signed);
      throw new Error("Timeout after possible acceptance");
    };
    const input = (r = recipients[0]!) => ({
      target: r.target,
      amount: "1.0000001",
      requestKey: randomUUID(),
    });
    const sign = (p: SupportPayment, key = sender) => {
      const tx = TransactionBuilder.fromXDR(p.transaction, Networks.TESTNET);
      tx.sign(key);
      return tx.toXDR();
    };
    try {
      let p: SupportPayment;
      await t.test(
        "concurrent duplicate preparation returns one exact payment",
        async () => {
          const i = input();
          const pair = await Promise.all([
            s.prepare(sender.publicKey(), i),
            s.prepare(sender.publicKey(), i),
          ]);
          p = pair[0]!;
          assert.equal(pair[0]!.id, pair[1]!.id);
          assert.equal(p.amount, "1.0000001");
          assert.notEqual(p.recipient.walletAddress, contributor.publicKey());
          await assert.rejects(
            s.prepare(sender.publicKey(), { ...i, amount: "2" }),
            /different details/,
          );
        },
      );
      await t.test(
        "wrong sender, recipient authorization, altered signature and outsider cannot authorize",
        async () => {
          await assert.rejects(
            s.authorize(outsider.publicKey(), p.id, sign(p)),
            /not found/,
          );
          await assert.rejects(
            s.authorize(artist.publicKey(), p.id, sign(p)),
            /Only the sender/,
          );
          await assert.rejects(
            s.authorize(sender.publicKey(), p.id, sign(p, outsider)),
            /does not authorize/,
          );
          assert.equal(
            (await s.get(sender.publicKey(), p.id)).status,
            "prepared",
          );
        },
      );
      await t.test(
        "uncertain submission persists its signature and blocks a replacement payment",
        async () => {
          await s.authorize(sender.publicKey(), p.id, sign(p));
          const pending = await s.submit(sender.publicKey(), p.id);
          assert.equal(pending.status, "submitting");
          assert.equal(submitted, 1);
          await assert.rejects(
            s.prepare(sender.publicKey(), input()),
            /unfinished support payment/,
          );
          await assert.rejects(
            s.cancel(sender.publicKey(), p.id),
            /no longer be cancelled/,
          );
        },
      );
      await t.test(
        "reconciliation confirms one exact payment visible to both parties",
        async () => {
          receipts.set(p.transactionHash, {
            hash: p.transactionHash,
            successful: true,
            envelope_xdr: sign(p),
            ledger: 123,
            fee_charged: "100",
          });
          assert.equal(
            (await s.get(artist.publicKey(), p.id)).status,
            "confirmed",
          );
          assert.equal(
            (await s.submit(sender.publicKey(), p.id)).status,
            "confirmed",
          );
          assert.equal(submitted, 1);
          const events = await db.transaction((c) =>
            c.query(
              "SELECT action FROM support_events WHERE payment_id=$1 AND action='confirmed'",
              [p.id],
            ),
          );
          assert.equal(events.rowCount, 1);
          assert.ok(
            (await s.list(sender.publicKey())).some((r) => r.id === p.id),
          );
          assert.ok(
            (await s.list(artist.publicKey())).some((r) => r.id === p.id),
          );
          assert.deepEqual(await s.list(outsider.publicKey()), []);
        },
      );
      await t.test(
        "payment terms, finalized outcomes, and audit events cannot be rewritten",
        async () => {
          await assert.rejects(
            db.transaction((c) =>
              c.query(
                "UPDATE support_payments SET payload=jsonb_set(payload,'{amount}','\"2.0000000\"') WHERE id=$1",
                [p.id],
              ),
            ),
            /immutable/,
          );
          await assert.rejects(
            db.transaction((c) =>
              c.query("DELETE FROM support_payments WHERE id=$1", [p.id]),
            ),
            /retained/,
          );
          await assert.rejects(
            db.transaction((c) =>
              c.query("DELETE FROM support_events WHERE payment_id=$1", [p.id]),
            ),
            /append-only/,
          );
        },
      );
      await t.test(
        "contributor support goes directly to the chosen listener contributor",
        async () => {
          const c = await s.prepare(sender.publicKey(), input(recipients[1]));
          assert.equal(c.recipient.walletAddress, contributor.publicKey());
          await s.authorize(sender.publicKey(), c.id, sign(c));
          receipts.set(c.transactionHash, {
            hash: c.transactionHash,
            successful: true,
            envelope_xdr: sign(c),
            ledger: 124,
            fee_charged: "100",
          });
          assert.equal(
            (await s.get(contributor.publicKey(), c.id)).status,
            "confirmed",
          );
        },
      );
      await t.test(
        "cancellation records no signature or submission and rejects later authorization",
        async () => {
          const c = await s.prepare(sender.publicKey(), input());
          assert.equal(
            (await s.cancel(sender.publicKey(), c.id)).status,
            "cancelled",
          );
          await assert.rejects(
            s.authorize(sender.publicKey(), c.id, sign(c)),
            /no longer awaiting/,
          );
          const stored = await db.transaction((cn) =>
            cn.query(
              "SELECT signed_transaction FROM support_payments WHERE id=$1",
              [c.id],
            ),
          );
          assert.equal(stored.rows[0].signed_transaction, null);
        },
      );
      await t.test(
        "expiry requires a closed ledger beyond timebounds, not the local clock",
        async () => {
          const c = await s.prepare(sender.publicKey(), input());
          now = Date.parse(c.expiresAt) - 1;
          assert.equal(
            (await s.get(sender.publicKey(), c.id)).status,
            "prepared",
          );
          now = Date.parse(c.expiresAt) + 1000;
          assert.equal(
            (await s.get(sender.publicKey(), c.id)).status,
            "expired",
          );
        },
      );
      await t.test(
        "pruned history retains an unresolved payment instead of enabling another payment",
        async () => {
          now = Date.now();
          const c = await s.prepare(sender.publicKey(), input());
          now = Date.parse(c.expiresAt) + 1000;
          chain.historyStart = async () => 101;
          await assert.rejects(
            s.get(sender.publicKey(), c.id),
            /remains unresolved/,
          );
          chain.historyStart = async () => 1;
          assert.equal(
            (await s.get(sender.publicKey(), c.id)).status,
            "expired",
          );
        },
      );
      await t.test(
        "failed on-chain receipts consume network fees and never claim USDC success",
        async () => {
          now = Date.now();
          const c = await s.prepare(sender.publicKey(), input());
          await s.authorize(sender.publicKey(), c.id, sign(c));
          receipts.set(c.transactionHash, {
            hash: c.transactionHash,
            successful: false,
            envelope_xdr: sign(c),
            ledger: 125,
            fee_charged: "100",
          });
          const failed = await s.get(sender.publicKey(), c.id);
          assert.equal(failed.status, "failed");
          assert.equal(failed.feeCharged, "100");
        },
      );
    } finally {
      Object.assign(chain, originalChain);
      s.recipient = originalRecipient;
      await db.close();
    }
  },
);
