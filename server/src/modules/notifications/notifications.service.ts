import type { TrackSummary } from "@music-city/shared";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { databaseService } from "../../services/database.service.js";
import {
  emailAllowed,
  notificationCatalog,
  type NotificationKind,
} from "./notification-catalog.js";

// Call with the source event's transaction. The key identifies the logical event, never a delivery attempt.
export async function notify(
  client: PoolClient,
  event: {
    key: string;
    kind: NotificationKind;
    recipients: string[];
    href: string;
  },
) {
  if (!event.href.startsWith("/") || event.href.startsWith("//"))
    throw new Error("Notification links must be local paths");
  const template = notificationCatalog[event.kind];
  for (const recipient of new Set(event.recipients)) {
    const user = (
      await client.query("SELECT payload FROM users WHERE wallet_address=$1", [
        recipient,
      ])
    ).rows[0]?.payload;
    if (!user) continue;
    const id = createHash("sha256")
      .update(JSON.stringify([event.key, recipient]))
      .digest("hex");
    const inserted = await client.query(
      "INSERT INTO notifications(id,event_key,recipient,kind,title,body,href) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(event_key,recipient) DO NOTHING RETURNING id",
      [
        id,
        event.key,
        recipient,
        event.kind,
        template.title,
        template.body,
        event.href,
      ],
    );
    if (!inserted.rowCount) continue;
    const email = z.string().email().safeParse(user.email);
    if (
      email.success &&
      emailAllowed(event.kind, user.notificationPreferences)
    ) {
      await client.query(
        "INSERT INTO notification_deliveries(id,recipient,email,message) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [
          id,
          recipient,
          email.data,
          {
            title: template.title,
            body: template.body,
            href: event.href,
            category: template.category,
          },
        ],
      );
    }
  }
}
export const notificationsService = {
  async list(recipient: string, before?: string) {
    return databaseService.transaction(async (client) => {
      const items = await client.query(
        `SELECT id,kind,title,body,href,created_at AS "createdAt",read_at AS "readAt" FROM notifications WHERE recipient=$1 AND ($2::text IS NULL OR (created_at,id)<(SELECT created_at,id FROM notifications WHERE id=$2 AND recipient=$1)) ORDER BY created_at DESC,id DESC LIMIT 50`,
        [recipient, before ?? null],
      );
      const count = await client.query(
        "SELECT count(*)::integer AS count FROM notifications WHERE recipient=$1 AND read_at IS NULL",
        [recipient],
      );
      return {
        items: items.rows,
        unreadCount: count.rows[0].count,
        nextCursor: items.rows.length === 50 ? items.rows.at(-1).id : null,
      };
    });
  },
  async read(recipient: string, id?: string) {
    await databaseService.transaction((client) =>
      client.query(
        "UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE recipient=$1 AND ($2::text IS NULL OR id=$2)",
        [recipient, id ?? null],
      ),
    );
  },
};

export async function notifyArtist(
  client: PoolClient,
  artistId: string,
  event: { key: string; kind: NotificationKind; href: string },
) {
  const user = (
    await client.query<{ wallet_address: string }>(
      "SELECT wallet_address FROM users WHERE id=$1",
      [artistId],
    )
  ).rows[0];
  if (user)
    await notify(client, { ...event, recipients: [user.wallet_address] });
}

export async function notifyTrackProcessing(
  client: PoolClient,
  current: TrackSummary | undefined,
  next: TrackSummary,
) {
  if (
    !current ||
    !(
      (!current.playbackReady && next.playbackReady) ||
      (current.status !== "failed" && next.status === "failed")
    )
  )
    return;
  const generation =
    next.muxUploadId || next.masterStorageKey || next.muxAssetId || "local";
  await notifyArtist(client, next.artistId, {
    key: `upload:${next.id}:${generation}:${next.playbackReady ? "ready" : "failed"}`,
    kind: next.playbackReady ? "upload.ready" : "upload.failed",
    href: "/dashboard",
  });
}
