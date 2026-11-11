export const payoutRunStatements = [
  `CREATE TABLE payout_runs (id TEXT PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'), payload JSONB NOT NULL CHECK(payload->>'id'=id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `CREATE TABLE payout_run_batches (run_id TEXT NOT NULL REFERENCES payout_runs(id), batch_id TEXT PRIMARY KEY REFERENCES settlement_batches(id))`,
  ...["payout_runs", "payout_run_batches"].map(table => `CREATE TRIGGER ${table}_immutable BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION protect_settlement_evidence()`),
];
