export const rampCashOutRecoveryStatements = [
  "ALTER TABLE ramp_orders DROP CONSTRAINT IF EXISTS ramp_orders_chain_state_check",
  "ALTER TABLE ramp_orders ADD CONSTRAINT ramp_orders_chain_state_check CHECK(chain_state IN ('unobserved','prepared','submitting','confirmed','failed','unknown','expired'))",
  "ALTER TABLE ramp_chain_attempts ADD COLUMN IF NOT EXISTS submission_count INTEGER NOT NULL DEFAULT 0 CHECK(submission_count>=0)",
  "ALTER TABLE ramp_chain_attempts ADD COLUMN IF NOT EXISTS last_submitted_at TIMESTAMPTZ",
  "ALTER TABLE ramp_chain_attempts ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
  "ALTER TABLE ramp_chain_attempts ADD COLUMN IF NOT EXISTS leased_until TIMESTAMPTZ",
  "ALTER TABLE ramp_chain_attempts ADD COLUMN IF NOT EXISTS lease_token UUID",
  "ALTER TABLE ramp_chain_attempts ADD COLUMN IF NOT EXISTS last_error_code TEXT",
  "CREATE INDEX IF NOT EXISTS ramp_cashout_recovery_due ON ramp_chain_attempts(due_at) WHERE state IN ('submitting','unknown')",
];
