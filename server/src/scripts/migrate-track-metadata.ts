import { Pool, type PoolClient } from "pg";
import { pathToFileURL } from "node:url";
import { trackIsrcSchema, trackRecordLabelSchema } from "@music-city/shared";

// Explicit one-time migration. No runtime read fallback and no automatic startup execution.
export async function migrateTrackMetadata(client: PoolClient, apply = false, migrationName?: string) {
  const report = { scanned: 0, labelsCopied: 0, identifiersNormalized: 0, invalidIdentifiers: [] as string[], skippedLabels: [] as string[] };
  await client.query("BEGIN");
  try {
    if (apply && migrationName) {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [migrationName]);
      const recorded = await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [migrationName]);
      if (recorded.rows.length) { await client.query("COMMIT"); return { ...report, alreadyApplied: true }; }
    }
    const result = await client.query(`SELECT t.id, t.artist_id, t.payload, r.artist_id AS release_artist_id,
      r.payload->>'recordLabel' AS release_label FROM tracks t
      LEFT JOIN release_tracks rt ON rt.track_id=t.id LEFT JOIN releases r ON r.id=rt.release_id
      ORDER BY t.id FOR UPDATE OF t`);
    for (const row of result.rows) {
      report.scanned++;
      const patch: Record<string, string> = {};
      if (row.payload.isrc) {
        const parsed = trackIsrcSchema.safeParse(row.payload.isrc);
        if (!parsed.success || !parsed.data) report.invalidIdentifiers.push(row.id);
        else if (parsed.data !== row.payload.isrc) { patch.isrc = parsed.data; report.identifiersNormalized++; }
      }
      if (!row.payload.recordLabel?.trim() && row.release_label?.trim()) {
        const label = trackRecordLabelSchema.safeParse(row.release_label);
        if (row.artist_id !== row.release_artist_id || !label.success) report.skippedLabels.push(row.id);
        else { patch.recordLabel = label.data; report.labelsCopied++; }
      }
      if (apply && Object.keys(patch).length) await client.query("UPDATE tracks SET payload = payload || $2::jsonb WHERE id=$1", [row.id, JSON.stringify(patch)]);
    }
    if (apply && migrationName) await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [migrationName]);
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    return report;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.TRACK_METADATA_DATABASE_URL;
  if (!url) throw new Error("Set TRACK_METADATA_DATABASE_URL explicitly. Project .env files are not loaded.");
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try { console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "apply" : "dry-run", ...await migrateTrackMetadata(client, process.argv.includes("--apply")) }, null, 2)); }
  finally { client.release(); await pool.end(); }
}
