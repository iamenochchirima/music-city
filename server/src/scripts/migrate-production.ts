import { Pool } from "pg";
import { env } from "../config/env.js";
import { databaseService } from "../services/database.service.js";
import { migrateTrackMetadata } from "./migrate-track-metadata.js";

const metadataMigration = "2026-10-14-track-credits-and-identifiers";
const main = async () => {
  // Schema migrations run before the API starts accepting requests.
  await databaseService.initialize();
  const schema = await databaseService.inspectSchemaHealth();
  if (!schema.ok) throw new Error("Database schema checks failed after migrations");
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const metadata = await migrateTrackMetadata(client, true, metadataMigration);
    console.log(JSON.stringify({ ok: true, schema, metadataMigration, metadata }));
  } finally {
    client.release();
    await pool.end();
  }
};
main().catch(error => {
  console.error(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : "Migration failed" }));
  process.exitCode = 1;
}).finally(() => databaseService.close());
