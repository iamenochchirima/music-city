import { randomUUID } from "node:crypto";
import { databaseService } from "../../services/database.service.js";
import {
  deliverEmail,
  emailConfigurationError,
  type EmailAdapter,
  type EmailDelivery,
} from "./email-adapter.js";
import { emailAllowed, type NotificationKind } from "./notification-catalog.js";

type Job = EmailDelivery & {
  recipient: string;
  attempts: number;
  first_attempt_at: Date | null;
  kind: NotificationKind;
};
export const notificationWorker = {
  async runOne(send: EmailAdapter = deliverEmail) {
    // Leave unconfigured deliveries queued so configuring a sender resumes them without data repair.
    if (send === deliverEmail && emailConfigurationError()) return false;
    const token = randomUUID();
    const job = await databaseService.transaction(async (client) => {
      const row = (
        await client.query<Job>(`SELECT d.*,n.kind FROM notification_deliveries d JOIN notifications n ON n.id=d.id
        WHERE (d.state='queued' AND d.available_at<=NOW()) OR (d.state='running' AND d.lease_until<NOW())
        ORDER BY d.available_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT 1`)
      ).rows[0];
      if (!row) return null;
      const profile = (
        await client.query(
          "SELECT payload FROM users WHERE wallet_address=$1",
          [row.recipient],
        )
      ).rows[0]?.payload;
      if (
        !profile ||
        profile.email !== row.email ||
        !emailAllowed(row.kind, profile.notificationPreferences)
      ) {
        await client.query(
          "UPDATE notification_deliveries SET state='skipped',error='Recipient email or preferences changed',lease_until=NULL WHERE id=$1",
          [row.id],
        );
        return { skipped: true } as const;
      }
      // Resend retains idempotency keys for 24 hours. Stop automatic retries before that window closes.
      if (
        row.first_attempt_at &&
        Date.now() - new Date(row.first_attempt_at).getTime() > 23 * 3600000
      ) {
        await client.query(
          "UPDATE notification_deliveries SET state='failed',error='Delivery outcome needs review: idempotency window expired',lease_until=NULL WHERE id=$1",
          [row.id],
        );
        return { skipped: true } as const;
      }
      await client.query(
        "UPDATE notification_deliveries SET state='running',attempts=attempts+1,lease_token=$2,lease_until=NOW()+INTERVAL '60 seconds',first_attempt_at=COALESCE(first_attempt_at,NOW()) WHERE id=$1",
        [row.id, token],
      );
      return { ...row, skipped: false, attempts: row.attempts + 1 } as const;
    });
    if (!job) return false;
    if (job.skipped) return true;
    try {
      const providerId = await send(job);
      await databaseService.transaction((client) =>
        client.query(
          "UPDATE notification_deliveries SET state='sent',provider_id=$3,error=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2",
          [job.id, token, providerId],
        ),
      );
    } catch {
      // Do not persist provider response bodies, credentials or recipient addresses in error logs.
      await databaseService.transaction((client) =>
        client.query(
          "UPDATE notification_deliveries SET state=$3,error='Email delivery failed',lease_until=NULL,available_at=NOW()+($4 * INTERVAL '1 second') WHERE id=$1 AND lease_token=$2",
          [
            job.id,
            token,
            job.attempts >= 12 ? "failed" : "queued",
            Math.min(300, 2 ** job.attempts),
          ],
        ),
      );
    }
    return true;
  },
};
