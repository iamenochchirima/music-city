import { databaseService } from "../services/database.service.js";
import { createId } from "../services/id.service.js";
import { STREAM_QUALIFICATION_SECONDS } from "@music-city/shared";

const apply = process.argv.includes("--apply");
if (process.argv.slice(2).some((argument) => argument !== "--apply")) {
  throw new Error("Usage: reconcile-stream-counts.js [--apply]");
}

try {
  const summary = await databaseService.transaction(async (client) => {
    const candidates = await client.query<{
      id: string; track_id: string; artist_id: string; listener_user_id: string | null;
      listened_seconds: number; position_seconds: number; occurred_at: string;
    }>(`
      SELECT s.id, s.track_id, t.payload->>'artistId' artist_id,
        s.payload->>'listenerUserId' listener_user_id,
        (s.payload->>'listenedSeconds')::double precision listened_seconds,
        COALESCE((s.payload->>'maxPositionSeconds')::double precision, 0) position_seconds,
        COALESCE(s.payload->>'lastPlaybackEventAt', s.payload->>'createdAt') occurred_at
      FROM playback_sessions s JOIN tracks t ON t.id = s.track_id
      WHERE COALESCE((s.payload->>'listenedSeconds')::double precision, 0) >=
        CASE WHEN t.payload->>'runtime' ~ '^[0-9]+:[0-5][0-9]$'
        THEN CASE WHEN split_part(t.payload->>'runtime', ':', 1)::integer * 60
            + split_part(t.payload->>'runtime', ':', 2)::integer > 0
        THEN LEAST($1::double precision, (split_part(t.payload->>'runtime', ':', 1)::integer * 60
            + split_part(t.payload->>'runtime', ':', 2)::integer) * 0.5)
        ELSE $1::double precision END ELSE $1::double precision END
      AND COALESCE(s.payload->>'lastPlaybackEventAt', s.payload->>'createdAt') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM playback_events e
        WHERE e.playback_session_id = s.id AND e.event_type = 'qualified_stream')
    `, [STREAM_QUALIFICATION_SECONDS]);
    let inserted = 0;
    if (apply) for (const row of candidates.rows) {
      const result = await client.query(`
        INSERT INTO playback_events
          (id, playback_session_id, track_id, artist_id, listener_user_id, event_type,
           position_seconds, duration_seconds, occurred_at, payload)
        VALUES ($1, $2, $3, $4, $5, 'qualified_stream', $6, NULL, $7, $8::jsonb)
        ON CONFLICT DO NOTHING RETURNING id
      `, [createId("evt"), row.id, row.track_id, row.artist_id, row.listener_user_id,
        row.position_seconds, row.occurred_at,
        JSON.stringify({ qualifiedBy: "recorded_listening_reconciliation", listenedSeconds: row.listened_seconds })]);
      if (!result.rowCount) continue;
      inserted++;
      await client.query(`UPDATE playback_sessions
        SET payload = jsonb_set(payload, '{qualifiedStreamCountedAt}', to_jsonb($2::text))
        WHERE id = $1`, [row.id, row.occurred_at]);
    }
    const totals = await client.query<{ id: string; streams: string }>(`
      SELECT t.id, COUNT(e.id)::text streams FROM tracks t
      LEFT JOIN playback_events e ON e.track_id = t.id AND e.event_type = 'qualified_stream'
      GROUP BY t.id, t.payload
      HAVING COALESCE((t.payload->>'plays')::bigint, 0) <> COUNT(e.id)
    `);
    if (apply) for (const row of totals.rows) {
      await client.query(`UPDATE tracks SET payload = jsonb_set(payload, '{plays}', to_jsonb($2::bigint))
        WHERE id = $1`, [row.id, row.streams]);
    }
    return { apply, eligibleSessions: candidates.rowCount, inserted, mismatchedTrackTotals: totals.rowCount };
  });
  console.log(JSON.stringify(summary));
} finally {
  await databaseService.close();
}
