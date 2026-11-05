export const rampLaunchStatements = [
  `CREATE TABLE IF NOT EXISTS ramp_launch_sessions (
    order_id TEXT PRIMARY KEY REFERENCES ramp_orders(id),
    encrypted_session BYTEA NOT NULL CHECK(octet_length(encrypted_session)>=30),
    resumable BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE OR REPLACE FUNCTION reject_ramp_launch_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Ramp launch sessions are append-only'; END $$`,
  "DROP TRIGGER IF EXISTS ramp_launch_no_update_delete ON ramp_launch_sessions",
  "CREATE TRIGGER ramp_launch_no_update_delete BEFORE UPDATE OR DELETE ON ramp_launch_sessions FOR EACH ROW EXECUTE FUNCTION reject_ramp_launch_mutation()",
  "DROP TRIGGER IF EXISTS ramp_launch_no_truncate ON ramp_launch_sessions",
  "CREATE TRIGGER ramp_launch_no_truncate BEFORE TRUNCATE ON ramp_launch_sessions FOR EACH STATEMENT EXECUTE FUNCTION reject_ramp_launch_mutation()",
];
