import assert from "node:assert/strict";
import { Pool, type PoolClient } from "pg";
import { createRampRepository } from "../../src/modules/ramps/ramp.repository.js";
import { createCashOutEnvelopeCipher } from "../../src/modules/cashout/cashout-envelope.js";
import { reconcileCashOut } from "../../src/modules/cashout/cashout-worker.js";

// This fixture has no network transport. It runs only against an isolated test schema.
const url = new URL(process.env.RAMP_TEST_DATABASE_URL!);
const schema = process.env.RAMP_RESTART_SCHEMA!;
assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.endsWith("_test") && !url.search);
assert.match(schema, /^ramp_[a-f0-9]{32}$/);
const pool = new Pool({ connectionString: url.href });
const db = {
  async transaction<T>(work: (client: PoolClient) => Promise<T>) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL search_path TO ${schema}`);
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  },
};
let submissions = 0;
const chain = {
  async ledger() { return { sequence: 50, closed_at: process.env.RAMP_RESTART_TIME! }; },
  async receipt(hash: string) { assert.equal(hash, process.env.RAMP_RESTART_HASH); return null; },
  async historyCoverage() { throw new Error("Unexpected history check"); },
  async submit(xdr: string) {
    assert.equal(xdr, process.env.RAMP_RESTART_XDR);
    submissions++;
    throw new Error("Simulated lost response");
  },
};
try {
  await reconcileCashOut(createRampRepository(db), chain, createCashOutEnvelopeCipher(Buffer.alloc(32, Number(process.env.RAMP_RESTART_KEY))));
  console.log(`simulated submissions: ${submissions}`);
} finally { await pool.end(); }
