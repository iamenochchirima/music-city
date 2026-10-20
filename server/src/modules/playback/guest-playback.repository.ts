import { GUEST_PLAYBACK_SECONDS } from "@music-city/shared";
import { databaseService } from "../../services/database.service.js";

export const guestPlaybackRepository = {
  async claimTime(guestIdHash: string, durationSeconds: number) {
    return databaseService.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [guestIdHash]);
      const result = await client.query<{ listened_seconds: number }>(
        `INSERT INTO guest_playback_allowances (guest_id_hash, window_started_at, expires_at)
         VALUES ($1, NOW(), NOW() + INTERVAL '24 hours')
         ON CONFLICT (guest_id_hash) DO UPDATE SET
           listened_seconds = CASE WHEN guest_playback_allowances.expires_at <= NOW() THEN 0 ELSE guest_playback_allowances.listened_seconds END,
           window_started_at = CASE WHEN guest_playback_allowances.expires_at <= NOW() THEN NOW() ELSE guest_playback_allowances.window_started_at END,
           expires_at = CASE WHEN guest_playback_allowances.expires_at <= NOW() THEN NOW() + INTERVAL '24 hours' ELSE guest_playback_allowances.expires_at END,
           updated_at = NOW()
         RETURNING listened_seconds`, [guestIdHash],
      );
      return {
        maximumSeconds: durationSeconds,
        budgetRemainingSeconds: Math.max(0, GUEST_PLAYBACK_SECONDS - Number(result.rows[0]!.listened_seconds)),
        remainingSeconds: Math.max(0, Math.min(durationSeconds, GUEST_PLAYBACK_SECONDS - Number(result.rows[0]!.listened_seconds))),
      };
    });
  },

  async addListenedSeconds(guestIdHash: string, seconds: number) {
    if (seconds <= 0) return;
    await databaseService.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [guestIdHash]);
      await client.query(
        `UPDATE guest_playback_allowances SET listened_seconds = LEAST($3, listened_seconds + $2), updated_at = NOW()
         WHERE guest_id_hash = $1 AND expires_at > NOW()`, [guestIdHash, seconds, GUEST_PLAYBACK_SECONDS],
      );
    });
  },
};
