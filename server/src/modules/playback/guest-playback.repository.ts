import { databaseService } from "../../services/database.service.js";
import type { PoolClient } from "pg";

export type GuestPlaybackSlot = "first" | "second";

export type GuestPlaybackAllowance = {
  guestIdHash: string;
  windowStartedAt: string;
  expiresAt: string;
  firstTrackId: string | null;
  firstListenedSeconds: number;
  secondTrackId: string | null;
  secondListenedSeconds: number;
};

type AllowanceRow = {
  guest_id_hash: string;
  window_started_at: Date | string;
  expires_at: Date | string;
  first_track_id: string | null;
  first_listened_seconds: number;
  second_track_id: string | null;
  second_listened_seconds: number;
};

const mapAllowance = (row: AllowanceRow): GuestPlaybackAllowance => ({
  guestIdHash: row.guest_id_hash,
  windowStartedAt: new Date(row.window_started_at).toISOString(),
  expiresAt: new Date(row.expires_at).toISOString(),
  firstTrackId: row.first_track_id,
  firstListenedSeconds: Number(row.first_listened_seconds),
  secondTrackId: row.second_track_id,
  secondListenedSeconds: Number(row.second_listened_seconds),
});

const selectAllowance = async (client: PoolClient, guestIdHash: string) => {
  const result = await client.query<AllowanceRow>(
    `SELECT guest_id_hash, window_started_at, expires_at, first_track_id,
            first_listened_seconds, second_track_id, second_listened_seconds
     FROM guest_playback_allowances WHERE guest_id_hash = $1 FOR UPDATE`,
    [guestIdHash],
  );
  return result.rows[0] ? mapAllowance(result.rows[0]) : null;
};

export const guestPlaybackRepository = {
  async claimTrack(guestIdHash: string, trackId: string, durationSeconds: number) {
    return databaseService.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [guestIdHash]);
      const now = new Date();
      const current = await selectAllowance(client, guestIdHash);
      let allowance = current;

      if (!allowance || Date.parse(allowance.expiresAt) <= now.getTime()) {
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        await client.query(
          `INSERT INTO guest_playback_allowances (
             guest_id_hash, window_started_at, expires_at, first_track_id,
             first_listened_seconds, second_track_id, second_listened_seconds, updated_at
           ) VALUES ($1, $2, $3, $4, 0, NULL, 0, NOW())
           ON CONFLICT (guest_id_hash) DO UPDATE SET
             window_started_at = EXCLUDED.window_started_at,
             expires_at = EXCLUDED.expires_at,
             first_track_id = EXCLUDED.first_track_id,
             first_listened_seconds = 0,
             second_track_id = NULL,
             second_listened_seconds = 0,
             updated_at = NOW()`,
          [guestIdHash, now.toISOString(), expiresAt.toISOString(), trackId],
        );
        allowance = await selectAllowance(client, guestIdHash);
      } else if (!allowance.firstTrackId) {
        await client.query(
          `UPDATE guest_playback_allowances SET first_track_id = $2, updated_at = NOW()
           WHERE guest_id_hash = $1`,
          [guestIdHash, trackId],
        );
        allowance = await selectAllowance(client, guestIdHash);
      } else if (trackId !== allowance.firstTrackId && !allowance.secondTrackId) {
        await client.query(
          `UPDATE guest_playback_allowances SET second_track_id = $2, updated_at = NOW()
           WHERE guest_id_hash = $1`,
          [guestIdHash, trackId],
        );
        allowance = await selectAllowance(client, guestIdHash);
      }

      if (!allowance) throw new Error("Guest playback allowance was not created");

      const slot: GuestPlaybackSlot | null = trackId === allowance.firstTrackId
        ? "first"
        : trackId === allowance.secondTrackId
          ? "second"
          : null;
      const maximumSeconds = slot === "first"
        ? durationSeconds
        : slot === "second"
          ? durationSeconds * 0.5
          : 0;
      const listenedSeconds = slot === "first"
        ? allowance.firstListenedSeconds
        : slot === "second"
          ? allowance.secondListenedSeconds
          : 0;
      return {
        allowance,
        slot,
        maximumSeconds,
        remainingSeconds: Math.max(0, maximumSeconds - listenedSeconds),
      };
    });
  },

  async addListenedSeconds(guestIdHash: string, slot: GuestPlaybackSlot, trackId: string, seconds: number, durationSeconds: number) {
    if (seconds <= 0) return;
    const field = slot === "first" ? "first_listened_seconds" : "second_listened_seconds";
    const maximum = slot === "first" ? durationSeconds : durationSeconds * 0.5;
    await databaseService.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [guestIdHash]);
      await client.query(
        `UPDATE guest_playback_allowances
         SET ${field} = LEAST($4, ${field} + $3), updated_at = NOW()
         WHERE guest_id_hash = $1 AND expires_at > NOW()
           AND ${slot === "first" ? "first_track_id" : "second_track_id"} = $2`,
        [guestIdHash, trackId, seconds, maximum],
      );
    });
  },
};
