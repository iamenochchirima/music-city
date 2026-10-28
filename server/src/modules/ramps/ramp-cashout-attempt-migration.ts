export const rampCashOutAttemptStatements = [
  "ALTER TABLE ramp_chain_attempts ADD COLUMN IF NOT EXISTS prepared_ledger BIGINT",
  "ALTER TABLE ramp_chain_attempts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
  "ALTER TABLE ramp_chain_attempts DROP CONSTRAINT IF EXISTS ramp_chain_attempts_state_check",
  "ALTER TABLE ramp_chain_attempts ADD CONSTRAINT ramp_chain_attempts_state_check CHECK(state IN ('prepared','submitting','confirmed','failed','unknown','cancelled','expired'))",
  `CREATE OR REPLACE FUNCTION protect_ramp_chain_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'Ramp transfer attempts are append-only'; END IF;
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.quote_id IS DISTINCT FROM OLD.quote_id OR
         NEW.network IS DISTINCT FROM OLD.network OR NEW.transaction_hash IS DISTINCT FROM OLD.transaction_hash OR
         NEW.prepared_envelope IS DISTINCT FROM OLD.prepared_envelope OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
         NEW.prepared_ledger IS DISTINCT FROM OLD.prepared_ledger OR NEW.created_at IS DISTINCT FROM OLD.created_at OR
         (OLD.signed_envelope_encrypted IS NOT NULL AND NEW.signed_envelope_encrypted IS DISTINCT FROM OLD.signed_envelope_encrypted)
      THEN RAISE EXCEPTION 'Ramp transfer terms are immutable'; END IF;
      IF OLD.state IN ('confirmed','failed','cancelled','expired') AND
         (NEW.state IS DISTINCT FROM OLD.state OR NEW.signed_envelope_encrypted IS DISTINCT FROM OLD.signed_envelope_encrypted)
      THEN RAISE EXCEPTION 'Ramp transfer outcome is immutable'; END IF;
      IF (OLD.state='prepared' AND NEW.state NOT IN ('prepared','submitting','cancelled')) OR
         (OLD.state IN ('submitting','unknown') AND NEW.state NOT IN ('submitting','unknown','confirmed','failed','expired'))
      THEN RAISE EXCEPTION 'Invalid ramp transfer state transition'; END IF;
      IF NEW.state IN ('submitting','unknown','confirmed','failed','expired') AND NEW.signed_envelope_encrypted IS NULL
      THEN RAISE EXCEPTION 'A signed transfer is required'; END IF;
      IF NEW.state='cancelled' AND (OLD.state <> 'prepared' OR OLD.signed_envelope_encrypted IS NOT NULL OR NEW.signed_envelope_encrypted IS NOT NULL)
      THEN RAISE EXCEPTION 'Only an unsigned transfer can be cancelled'; END IF;
      RETURN NEW;
    END $$`,
  "DROP TRIGGER IF EXISTS ramp_chain_attempt_protection ON ramp_chain_attempts",
  "CREATE TRIGGER ramp_chain_attempt_protection BEFORE UPDATE OR DELETE ON ramp_chain_attempts FOR EACH ROW EXECUTE FUNCTION protect_ramp_chain_attempt()",
  "DROP TRIGGER IF EXISTS ramp_chain_attempt_no_truncate ON ramp_chain_attempts",
  "CREATE TRIGGER ramp_chain_attempt_no_truncate BEFORE TRUNCATE ON ramp_chain_attempts FOR EACH STATEMENT EXECUTE FUNCTION protect_ramp_chain_attempt()",
];
