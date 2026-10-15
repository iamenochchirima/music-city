import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  prepareSupportSchema,
  supportTargetSchema,
  type SupportPayment,
  type SupportRecipient,
  type SupportTarget,
  type UserProfile,
} from "@music-city/shared";
import { databaseService as db } from "../../services/database.service.js";
import { usersRepository } from "../users/users.repository.js";
import { usersService } from "../users/users.service.js";
import { tracksService } from "../tracks/tracks.service.js";
import { finalizedSplitsRepository } from "../agreements/effective-split.js";
import { HttpError } from "../../utils/http-error.js";
import { logger } from "../../utils/logger.js";
import { amountUnits, formatUnits } from "../settlements/settlement-domain.js";
import {
  assertSupportNetwork,
  buildSupportTransaction,
  supportChain,
  supportConfig,
  validateSupportReadiness,
  verifySupportReceipt,
  verifySupportSignature,
} from "./support-chain.js";

type Row = { payload: SupportPayment; signed_transaction: string | null };
const terminal = (p: SupportPayment) =>
  ["confirmed", "failed", "expired"].includes(p.status);
async function event(
  client: PoolClient,
  payment: SupportPayment,
  action: string,
) {
  await client.query(
    "INSERT INTO support_events(payment_id,action,payload) VALUES($1,$2,$3)",
    [
      payment.id,
      action,
      {
        status: payment.status,
        transactionHash: payment.transactionHash,
        ledger: payment.ledger,
        feeCharged: payment.feeCharged,
        submissionCount: payment.submissionCount,
      },
    ],
  );
}
async function update(
  client: PoolClient,
  old: SupportPayment,
  patch: Partial<SupportPayment>,
  action: string,
  signed?: string,
) {
  const payment = { ...old, ...patch, updatedAt: new Date().toISOString() };
  await client.query(
    "UPDATE support_payments SET status=$2,payload=$3,signed_transaction=COALESCE(signed_transaction,$4),checked_at=NOW() WHERE id=$1",
    [payment.id, payment.status, payment, signed ?? null],
  );
  await event(client, payment, action);
  return payment;
}
async function withPayment<T>(
  id: string,
  actor: string | null,
  action: (client: PoolClient, row: Row) => Promise<T>,
) {
  return db.transaction(async (client) => {
    const found = await client.query<Row>(
      "SELECT payload,signed_transaction FROM support_payments WHERE id=$1",
      [id],
    );
    const first = found.rows[0];
    if (
      !first ||
      (actor &&
        first.payload.sender !== actor &&
        first.payload.recipient.walletAddress !== actor)
    )
      throw new HttpError(404, "Support payment not found");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `support:${first.payload.sender}`,
    ]);
    const locked = await client.query<Row>(
      "SELECT payload,signed_transaction FROM support_payments WHERE id=$1 FOR UPDATE",
      [id],
    );
    return action(client, locked.rows[0]!);
  });
}
async function reconcile(
  client: PoolClient,
  row: Row,
): Promise<SupportPayment> {
  let payment = row.payload;
  if (terminal(payment)) return payment;
  assertSupportNetwork(payment);
  // Read the closed ledger first, then the hash. Local clocks never decide payment expiry.
  const ledger = await supportChain.ledger();
  const receipt = await supportChain.receipt(payment.transactionHash);
  if (receipt) {
    verifySupportReceipt(payment, receipt);
    return update(
      client,
      payment,
      {
        status: receipt.successful ? "confirmed" : "failed",
        ledger: receipt.ledger,
        feeCharged: receipt.fee_charged,
        error: receipt.successful
          ? undefined
          : "Payment failed. No USDC was sent.",
      },
      receipt.successful ? "confirmed" : "failed",
    );
  }
  if (Date.parse(ledger.closed_at) > Date.parse(payment.expiresAt)) {
    if (
      !Number.isSafeInteger(payment.preparedLedger) ||
      (await supportChain.historyStart()) > payment.preparedLedger
    )
      throw new HttpError(
        503,
        "Payment history is unavailable. This payment remains unresolved; do not send again.",
      );
    if (payment.status !== "cancelled")
      payment = await update(
        client,
        payment,
        {
          status: "expired",
          error: "Payment expired. No confirmed payment was found.",
        },
        "expired",
      );
  }
  await client.query(
    "UPDATE support_payments SET checked_at=NOW() WHERE id=$1",
    [payment.id],
  );
  return payment;
}
async function send(client: PoolClient, row: Row) {
  let payment = await reconcile(client, row);
  if (
    payment.status !== "submitting" ||
    !row.signed_transaction ||
    payment.submissionCount >= 5 ||
    (payment.lastSubmittedAt &&
      Date.now() - Date.parse(payment.lastSubmittedAt) < 15000)
  )
    return payment;
  payment = await update(
    client,
    payment,
    {
      submissionCount: payment.submissionCount + 1,
      lastSubmittedAt: new Date().toISOString(),
      error: undefined,
    },
    "submit_attempt",
  );
  try {
    await supportChain.submit(row.signed_transaction);
  } catch {
    payment = await update(
      client,
      payment,
      { error: "Waiting for confirmation. Do not send again." },
      "confirmation_pending",
    );
  }
  try {
    return await reconcile(client, { ...row, payload: payment });
  } catch {
    return payment;
  }
}
export const supportService = {
  async artistRecipient(profileId: string): Promise<SupportRecipient> {
    const profile = await usersService.getPublicArtistProfile(profileId);
    if (!profile) throw new HttpError(404, "Artist not found");
    return {
      target: { kind: "artist", profileId },
      name: profile.displayName,
      walletAddress: profile.walletAddress,
      role: "Artist",
    };
  },
  async trackRecipients(trackId: string): Promise<SupportRecipient[]> {
    const track = await tracksService.getTrack(trackId);
    if (!track || !(await tracksService.isTrackPublic(trackId)))
      throw new HttpError(404, "Song not found");
    const owner = await this.artistRecipient(track.artistId);
    const recipients: SupportRecipient[] = [owner];
    const effective = await finalizedSplitsRepository.effective(trackId);
    const linked: { profile: UserProfile | null; role: string }[] =
      await Promise.all(
        (track.credits ?? [])
          .filter((c) => c.artistId)
          .map(async (c) => ({
            profile: await usersRepository.findById(c.artistId!),
            role: c.role,
          })),
      );
    for (const recipient of effective?.recipients ?? [])
      linked.push({
        profile: await usersRepository.findByWallet(recipient.walletAddress),
        role: recipient.role,
      });
    for (const { profile, role } of linked) {
      if (
        !profile ||
        profile.onboardingStatus !== "complete" ||
        recipients.some((r) => r.walletAddress === profile.walletAddress)
      )
        continue;
      recipients.push({
        target: { kind: "contributor", profileId: profile.id, trackId },
        name: profile.displayName,
        walletAddress: profile.walletAddress,
        role:
          role === "lyricist"
            ? "Author"
            : role.charAt(0).toUpperCase() + role.slice(1),
      });
    }
    return recipients;
  },
  async recipient(input: SupportTarget) {
    const target = supportTargetSchema.parse(input);
    if (target.kind === "artist") return this.artistRecipient(target.profileId);
    const recipients = await this.trackRecipients(target.trackId);
    const found = recipients.find(
      (r) =>
        r.target.kind === "contributor" &&
        r.target.profileId === target.profileId,
    );
    if (!found) throw new HttpError(404, "Contributor not found for this song");
    return found;
  },
  async prepare(sender: string, input: unknown) {
    const parsed = prepareSupportSchema.parse(input);
    const amount = formatUnits(amountUnits(parsed.amount));
    if (amountUnits(amount) <= 0n)
      throw new HttpError(400, "Enter an amount greater than zero");
    return db.transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [`support:${sender}`],
      );
      const existing = (
        await client.query<Row>(
          "SELECT payload,signed_transaction FROM support_payments WHERE sender=$1 AND request_key=$2",
          [sender, parsed.requestKey],
        )
      ).rows[0];
      if (existing) {
        if (
          existing.payload.amount !== amount ||
          existing.payload.recipient.target.kind !== parsed.target.kind ||
          existing.payload.recipient.target.profileId !==
            parsed.target.profileId ||
          (existing.payload.recipient.target.kind === "contributor" &&
            parsed.target.kind === "contributor" &&
            existing.payload.recipient.target.trackId !== parsed.target.trackId)
        )
          throw new HttpError(
            409,
            "This payment request already has different details",
          );
        return existing.payload;
      }
      const active = (
        await client.query<Row>(
          "SELECT payload,signed_transaction FROM support_payments WHERE sender=$1 AND status IN ('prepared','submitting') FOR UPDATE",
          [sender],
        )
      ).rows[0];
      if (active && !terminal(await reconcile(client, active)))
        throw new HttpError(
          409,
          "You have an unfinished support payment. Open Support history before sending another.",
        );
      const profile = await usersRepository.findByWallet(sender);
      if (!profile || profile.onboardingStatus !== "complete")
        throw new HttpError(
          403,
          "Finish your account setup before sending support",
        );
      const recipient = await this.recipient(parsed.target);
      if (recipient.walletAddress === sender)
        throw new HttpError(400, "Choose someone else to support");
      const config = supportConfig();
      const [source, destination, ledger] = await Promise.all([
        supportChain.account(sender),
        supportChain.account(recipient.walletAddress),
        supportChain.ledger(),
      ]);
      validateSupportReadiness(
        source,
        config.assetIssuer,
        amountUnits(amount),
        false,
        ledger,
      );
      validateSupportReadiness(
        destination,
        config.assetIssuer,
        amountUnits(amount),
        true,
        ledger,
      );
      const id = randomUUID(),
        now = new Date().toISOString();
      const payment: SupportPayment = {
        id,
        requestKey: parsed.requestKey,
        sender,
        senderName: profile.displayName,
        recipient,
        amount,
        ...buildSupportTransaction(
          id,
          sender,
          recipient.walletAddress,
          amount,
          source.sequence,
          ledger,
          Date.parse(ledger.closed_at),
        ),
        status: "prepared",
        submissionCount: 0,
        preparedLedger: ledger.sequence,
        createdAt: now,
        updatedAt: now,
      };
      await client.query(
        "INSERT INTO support_payments(id,sender,recipient,request_key,transaction_hash,status,payload) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          sender,
          recipient.walletAddress,
          parsed.requestKey,
          payment.transactionHash,
          payment.status,
          payment,
        ],
      );
      await event(client, payment, "prepared");
      return payment;
    });
  },
  async authorize(sender: string, id: string, signed: string) {
    // This transaction commits authorization before any outbound submission.
    return withPayment(id, sender, async (client, row) => {
      const payment = row.payload;
      if (payment.sender !== sender)
        throw new HttpError(403, "Only the sender can authorize this payment");
      assertSupportNetwork(payment);
      if (payment.status !== "prepared") {
        if (
          row.signed_transaction === signed &&
          ["submitting", "confirmed"].includes(payment.status)
        )
          return payment;
        throw new HttpError(
          409,
          "This payment is no longer awaiting authorization",
        );
      }
      if (Date.now() >= Date.parse(payment.expiresAt))
        throw new HttpError(
          409,
          "This payment has expired. Check Support history",
        );
      const account = await supportChain.account(sender);
      const verified = verifySupportSignature(payment, signed, account);
      return update(
        client,
        payment,
        { status: "submitting", error: undefined },
        "authorized",
        verified,
      );
    });
  },
  async submit(sender: string, id: string) {
    return withPayment(id, sender, async (client, row) => {
      if (row.payload.sender !== sender)
        throw new HttpError(403, "Only the sender can submit this payment");
      return send(client, row);
    });
  },
  async cancel(sender: string, id: string) {
    return withPayment(id, sender, async (client, row) => {
      if (row.payload.sender !== sender)
        throw new HttpError(403, "Only the sender can cancel this payment");
      const payment = await reconcile(client, row);
      if (payment.status === "cancelled") return payment;
      if (payment.status !== "prepared")
        throw new HttpError(409, "This payment can no longer be cancelled");
      return update(
        client,
        payment,
        { status: "cancelled", error: undefined },
        "cancelled",
      );
    });
  },
  async get(actor: string, id: string) {
    return withPayment(id, actor, (client, row) => reconcile(client, row));
  },
  async list(actor: string) {
    return db.transaction(async (client) =>
      (
        await client.query<{ payload: SupportPayment }>(
          "SELECT payload FROM support_payments WHERE sender=$1 OR recipient=$1 ORDER BY payload->>'createdAt' DESC LIMIT 100",
          [actor],
        )
      ).rows.map((r) => r.payload),
    );
  },
  async cycle() {
    const ids = await db.transaction(
      async (client) =>
        (
          await client.query<{ id: string }>(
            "SELECT id FROM support_payments WHERE status IN ('prepared','submitting') OR (status='cancelled' AND (checked_at IS NULL OR checked_at < (payload->>'expiresAt')::timestamptz)) ORDER BY checked_at NULLS FIRST LIMIT 20",
          )
        ).rows,
    );
    for (const { id } of ids)
      try {
        await withPayment(id, null, (client, row) =>
          row.payload.status === "submitting"
            ? send(client, row)
            : reconcile(client, row),
        );
      } catch (error) {
        logger.error("Support payment reconciliation pending", {
          paymentId: id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
  },
};
