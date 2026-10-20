import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { guestPlaybackSchemaStatements, expandedGuestPlaybackSchemaStatements } from "./guest-playback-schema.js";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";
const { databaseService } = await import("../../services/database.service.js");
const { guestPlaybackRepository: repository } = await import("./guest-playback.repository.js");

test("guest migration preserves usage and enforces 25 minutes across songs with a daily reset", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await pool.connect();
  const original = databaseService.transaction;
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA guest_test_${process.pid}`);
    await client.query(`SET LOCAL search_path TO guest_test_${process.pid}`);
    for (const statement of guestPlaybackSchemaStatements) await client.query(statement);
    await client.query(`INSERT INTO guest_playback_allowances
      (guest_id_hash, window_started_at, expires_at, first_track_id, first_listened_seconds, second_track_id, second_listened_seconds)
      VALUES ('guest', NOW(), NOW() + INTERVAL '24 hours', 'one', 100, 'two', 50)`);
    for (const statement of expandedGuestPlaybackSchemaStatements) await client.query(statement);
    for (const statement of expandedGuestPlaybackSchemaStatements) await client.query(statement);
    databaseService.transaction = (async (callback: any) => callback(client)) as typeof original;
    assert.equal((await repository.claimTime("guest", 2000)).remainingSeconds, 1350);
    for (let index = 0; index < 6; index++) {
      assert.equal((await repository.claimTime("guest", 100)).remainingSeconds, 100);
      await repository.addListenedSeconds("guest", 100);
    }
    assert.equal((await repository.claimTime("guest", 2000)).remainingSeconds, 750);
    await repository.addListenedSeconds("guest", 740);
    assert.equal((await repository.claimTime("guest", 100)).remainingSeconds, 10);
    await repository.addListenedSeconds("guest", 20);
    assert.equal((await repository.claimTime("guest", 100)).remainingSeconds, 0);
    assert.equal(Number((await client.query("SELECT listened_seconds FROM guest_playback_allowances")).rows[0].listened_seconds), 1500);
    await client.query("UPDATE guest_playback_allowances SET expires_at = NOW() - INTERVAL '1 second'");
    assert.equal((await repository.claimTime("guest", 2000)).remainingSeconds, 1500);
    assert.equal((await repository.claimTime("another-guest", 2000)).remainingSeconds, 1500);
  } finally {
    databaseService.transaction = original;
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
