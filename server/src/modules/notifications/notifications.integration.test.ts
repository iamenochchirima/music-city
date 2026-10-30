import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";

const testUrl = process.env.NOTIFICATIONS_TEST_DATABASE_URL;
test("durable notifications and delivery", { skip: !testUrl }, async (t) => {
  const url = new URL(testUrl!);
  assert.ok(
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
      url.pathname.endsWith("_test"),
  );
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = "test";
  process.env.NOTIFICATION_EMAIL_PROVIDER = "sink";
  const { databaseService: db } = await import(
    "../../services/database.service.js"
  );
  const { notify, notificationsService: service } = await import(
    "./notifications.service.js"
  );
  const { notificationWorker: worker } = await import(
    "./notification-worker.js"
  );
  const { env } = await import("../../config/env.js");
  const { emailConfigurationError } = await import("./email-adapter.js");
  const wallets = Array.from({ length: 4 }, () => Keypair.random().publicKey());
  const [owner, contributor, outsider, noEmail] = wallets as [
    string,
    string,
    string,
    string,
  ];
  const ownerId = randomUUID();
  const event = (key: string, recipients = [contributor]) => ({
    key,
    kind: "agreement.proposed" as const,
    recipients,
    href: "/account/agreements/demo",
  });
  const deliveries = () =>
    db.transaction((client) =>
      client.query(
        "SELECT d.* FROM notification_deliveries d WHERE recipient=ANY($1::text[]) ORDER BY created_at,id",
        [wallets],
      ),
    );
  const drain = async () => {
    for (let i = 0; i < 100; i++) if (!(await worker.runOne())) return;
    throw new Error("Worker did not drain");
  };
  try {
    await db.initialize({ repair: false });
    await db.transaction(async (client) => {
      for (const [index, wallet] of wallets.entries())
        await client.query(
          "INSERT INTO users(id,wallet_address,primary_intent,payload) VALUES($1,$2,'artist',$3)",
          [
            index === 0 ? ownerId : randomUUID(),
            wallet,
            {
              email: wallet === noEmail ? "" : `${index}@example.test`,
              notificationPreferences: {
                releaseNotifications: false,
                artistUpdates: false,
                productUpdates: false,
              },
            },
          ],
        );
    });
    await t.test(
      "transaction rollback removes both inbox and delivery",
      async () => {
        await assert.rejects(
          db.transaction(async (client) => {
            await notify(client, event(randomUUID()));
            throw new Error("source failed");
          }),
        );
        assert.equal((await service.list(contributor)).items.length, 0);
        assert.equal((await deliveries()).rowCount, 0);
      },
    );
    await t.test(
      "stable keys suppress duplicates and resolve recipients from profiles",
      async () => {
        const key = randomUUID();
        await Promise.all(
          [1, 2].map(() =>
            db.transaction((client) =>
              notify(client, event(key, [contributor, contributor, noEmail])),
            ),
          ),
        );
        assert.equal((await service.list(contributor)).items.length, 1);
        assert.equal((await service.list(noEmail)).items.length, 1);
        assert.equal((await deliveries()).rowCount, 1);
        assert.equal((await deliveries()).rows[0].email, "1@example.test");
      },
    );
    await t.test(
      "recipient ownership protects lists and read actions",
      async () => {
        const inbox = await service.list(contributor);
        await service.read(outsider, inbox.items[0].id);
        assert.equal((await service.list(outsider)).items.length, 0);
        assert.equal((await service.list(contributor)).unreadCount, 1);
        await service.read(contributor, inbox.items[0].id);
        const readAt = (await service.list(contributor)).items[0].readAt;
        await service.read(contributor, inbox.items[0].id);
        assert.deepEqual(
          (await service.list(contributor)).items[0].readAt,
          readAt,
        );
      },
    );
    await t.test(
      "transactional email ignores marketing opt-outs; optional mail requires opt-in",
      async () => {
        await db.transaction((client) =>
          notify(client, { ...event(randomUUID()), kind: "product.update" }),
        );
        assert.equal((await deliveries()).rowCount, 1);
        await drain();
        const delivery = (await deliveries()).rows[0];
        assert.equal(delivery.state, "sent");
        const sink = await db.transaction((client) =>
          client.query("SELECT * FROM notification_email_sink WHERE id=$1", [
            delivery.id,
          ]),
        );
        assert.match(sink.rows[0].message.text, /account\/agreements\/demo/);
        assert.equal(delivery.provider_id, `sink:${delivery.id}`);
      },
    );
    await t.test(
      "provider configuration leaves pending mail queued",
      async () => {
        await db.transaction((client) => notify(client, event(randomUUID())));
        env.NOTIFICATION_EMAIL_PROVIDER = "disabled";
        assert.match(emailConfigurationError()!, /disabled/);
        assert.equal(await worker.runOne(), false);
        assert.equal((await deliveries()).rows.at(-1).state, "queued");
        env.NOTIFICATION_EMAIL_PROVIDER = "resend";
        env.RESEND_API_KEY = undefined;
        assert.match(emailConfigurationError()!, /requires/);
        env.NOTIFICATION_EMAIL_PROVIDER = "sink";
      },
    );
    await t.test(
      "failed send retries; competing workers cannot lease the same delivery",
      async () => {
        let attempts = 0;
        const send = async () => {
          attempts++;
          throw new Error("fake provider failure");
        };
        await Promise.all([worker.runOne(send), worker.runOne(send)]);
        assert.equal(attempts, 1);
        let row = (await deliveries()).rows.at(-1);
        assert.equal(row.state, "queued");
        assert.equal(row.attempts, 1);
        await db.transaction((client) =>
          client.query(
            "UPDATE notification_deliveries SET available_at=NOW() WHERE id=$1",
            [row.id],
          ),
        );
        await worker.runOne(async (job) => {
          assert.equal(job.id, row.id);
          return "fake-provider-id";
        });
        row = (await deliveries()).rows.at(-1);
        assert.equal(row.state, "sent");
        assert.equal(row.attempts, 2);
      },
    );
    await t.test(
      "expired lease resumes with the same idempotency key; old uncertain outcomes stop",
      async () => {
        await db.transaction((client) => notify(client, event(randomUUID())));
        let row = (await deliveries()).rows.at(-1);
        await db.transaction((client) =>
          client.query(
            "UPDATE notification_deliveries SET state='running',lease_until=NOW()-INTERVAL '1 minute',first_attempt_at=NOW() WHERE id=$1",
            [row.id],
          ),
        );
        await worker.runOne(async (job) => {
          assert.equal(job.id, row.id);
          return "recovered";
        });
        assert.equal((await deliveries()).rows.at(-1).state, "sent");
        await db.transaction((client) => notify(client, event(randomUUID())));
        row = (await deliveries()).rows.at(-1);
        await db.transaction((client) =>
          client.query(
            "UPDATE notification_deliveries SET first_attempt_at=NOW()-INTERVAL '25 hours' WHERE id=$1",
            [row.id],
          ),
        );
        await worker.runOne(async () => {
          throw new Error("must not send");
        });
        assert.equal((await deliveries()).rows.at(-1).state, "failed");
      },
    );
    await t.test(
      "changed email and withdrawn optional consent suppress delivery",
      async () => {
        await db.transaction(async (client) => {
          await notify(client, event(randomUUID()));
          await client.query(
            "UPDATE users SET payload=jsonb_set(payload,'{email}','\"changed@example.test\"') WHERE wallet_address=$1",
            [contributor],
          );
        });
        await drain();
        assert.equal((await deliveries()).rows.at(-1).state, "skipped");
        await db.transaction(async (client) => {
          await client.query(
            "UPDATE users SET payload=jsonb_set(payload,'{notificationPreferences,productUpdates}','true') WHERE wallet_address=$1",
            [contributor],
          );
          await notify(client, {
            ...event(randomUUID()),
            kind: "product.update",
          });
          await client.query(
            "UPDATE users SET payload=jsonb_set(payload,'{notificationPreferences,productUpdates}','false') WHERE wallet_address=$1",
            [contributor],
          );
        });
        await drain();
        assert.equal((await deliveries()).rows.at(-1).state, "skipped");
      },
    );
    await t.test(
      "lease tokens fence late failures and exhausted retries become visible failures",
      async () => {
        await db.transaction((client) => notify(client, event(randomUUID())));
        const row = (await deliveries()).rows.at(-1);
        let release!: () => void;
        const paused = new Promise<void>((resolve) => {
          release = resolve;
        });
        let started!: () => void;
        const ready = new Promise<void>((resolve) => {
          started = resolve;
        });
        const first = worker.runOne(async () => {
          started();
          await paused;
          throw new Error("late failure");
        });
        await ready;
        await db.transaction((client) =>
          client.query(
            "UPDATE notification_deliveries SET lease_until=NOW()-INTERVAL '1 second' WHERE id=$1",
            [row.id],
          ),
        );
        await worker.runOne(async () => "second-worker");
        release();
        await first;
        assert.equal(
          (await deliveries()).rows.at(-1).provider_id,
          "second-worker",
        );
        assert.equal((await deliveries()).rows.at(-1).state, "sent");
        await db.transaction((client) => notify(client, event(randomUUID())));
        const exhausted = (await deliveries()).rows.at(-1);
        await db.transaction((client) =>
          client.query(
            "UPDATE notification_deliveries SET attempts=11 WHERE id=$1",
            [exhausted.id],
          ),
        );
        await worker.runOne(async () => {
          throw new Error("offline");
        });
        assert.equal((await deliveries()).rows.at(-1).state, "failed");
      },
    );
    await t.test(
      "inbox cursor keeps equal timestamps and cannot expose another recipient",
      async () => {
        await db.transaction(async (client) => {
          for (let index = 0; index < 55; index++)
            await notify(client, event(randomUUID(), [noEmail]));
        });
        const first = await service.list(noEmail);
        assert.equal(first.items.length, 50);
        assert.ok(first.nextCursor);
        const second = await service.list(noEmail, first.nextCursor!);
        assert.equal(second.items.length, 6);
        assert.equal(
          new Set([...first.items, ...second.items].map((item) => item.id))
            .size,
          56,
        );
        assert.equal(
          (await service.list(outsider, first.nextCursor!)).items.length,
          0,
        );
      },
    );
    await t.test(
      "send-agreement creates one contributor notification and one email across retries",
      async () => {
        const { agreementsService } = await import(
          "../agreements/agreements.service.js"
        );
        const trackId = randomUUID();
        await db.transaction((client) =>
          client.query(
            "INSERT INTO tracks(id,artist_id,status,visibility,payload) VALUES($1,$2,'draft','unpublished',$3)",
            [trackId, ownerId, {}],
          ),
        );
        const input = {
          trackId,
          submitForApproval: true,
          terms: "Master split",
          recipients: [
            { walletAddress: owner, role: "artist", shareBps: 7000 },
            { walletAddress: contributor, role: "producer", shareBps: 3000 },
          ],
        };
        await db.transaction(async (client) => {
          await client.query(
            "CREATE FUNCTION notification_test_fail_delivery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'outbox unavailable'; END $$",
          );
          await client.query(
            `CREATE TRIGGER notification_test_fail_delivery BEFORE INSERT ON notification_deliveries FOR EACH ROW WHEN (NEW.recipient='${contributor}') EXECUTE FUNCTION notification_test_fail_delivery()`,
          );
        });
        try {
          await assert.rejects(
            agreementsService.create(owner, input),
            /outbox unavailable/,
          );
          const source = await db.transaction((client) =>
            client.query(
              "SELECT id FROM contributor_agreements WHERE track_id=$1",
              [trackId],
            ),
          );
          assert.equal(
            source.rowCount,
            0,
            "an outbox failure must roll back the source agreement",
          );
        } finally {
          await db.transaction(async (client) => {
            await client.query(
              "DROP TRIGGER notification_test_fail_delivery ON notification_deliveries",
            );
            await client.query(
              "DROP FUNCTION notification_test_fail_delivery()",
            );
          });
        }
        const version = await agreementsService.create(owner, input);
        await agreementsService.create(owner, input);
        const inbox = await service.list(contributor);
        const related = inbox.items.filter((item) =>
          item.href.endsWith(version.proposal.agreementId),
        );
        assert.equal(related.length, 1);
        assert.equal((await service.list(owner)).items.length, 0);
        assert.equal((await service.list(outsider)).items.length, 0);
        const delivery = (await deliveries()).rows.find(
          (row) => row.id === related[0].id,
        );
        assert.ok(delivery);
        await service.read(contributor);
        assert.equal((await service.list(contributor)).unreadCount, 0);
      },
    );
    await t.test(
      "payment receipts require confirmed status and remain unique across accounting retries",
      async () => {
        const { paymentsRepository } = await import(
          "../payments/payments.repository.js"
        );
        const intentId = randomUUID(),
          timestamp = new Date().toISOString();
        await db.transaction((client) =>
          client.query(
            "INSERT INTO payment_intents(id,wallet_address,product_type,status,expires_at,payload) VALUES($1,$2,'platform_subscription','pending',NOW()+INTERVAL '1 hour','{}')",
            [intentId, outsider],
          ),
        );
        const payment = {
          id: randomUUID(),
          intentId,
          walletAddress: outsider,
          productType: "platform_subscription" as const,
          txHash: randomUUID(),
          amount: "10",
          assetCode: "XLM",
          status: "failed" as const,
          confirmedAt: timestamp,
          createdAt: timestamp,
        };
        await paymentsRepository.upsertPayment(payment);
        assert.equal((await service.list(outsider)).items.length, 0);
        await paymentsRepository.upsertPayment({
          ...payment,
          status: "confirmed",
        });
        await paymentsRepository.upsertPayment({
          ...payment,
          status: "confirmed",
        });
        const inbox = await service.list(outsider);
        assert.equal(inbox.items.length, 1);
        assert.equal(inbox.items[0].kind, "payment.receipt");
        await drain();
        const delivery = (await deliveries()).rows.find(
          (row) => row.id === inbox.items[0].id,
        );
        assert.equal(delivery.state, "sent");
      },
    );
  } finally {
    await db.close();
  }
});
