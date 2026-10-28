export const rampQuoteStatements = [
  `CREATE OR REPLACE FUNCTION reject_ramp_quote_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Ramp quotes are append-only'; END $$`,
  "DROP TRIGGER IF EXISTS ramp_quote_no_update_delete ON ramp_quotes",
  "CREATE TRIGGER ramp_quote_no_update_delete BEFORE UPDATE OR DELETE ON ramp_quotes FOR EACH ROW EXECUTE FUNCTION reject_ramp_quote_mutation()",
  "DROP TRIGGER IF EXISTS ramp_quote_no_truncate ON ramp_quotes",
  "CREATE TRIGGER ramp_quote_no_truncate BEFORE TRUNCATE ON ramp_quotes FOR EACH STATEMENT EXECUTE FUNCTION reject_ramp_quote_mutation()",
  `CREATE OR REPLACE FUNCTION protect_ramp_order_terms() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR
         NEW.wallet_address IS DISTINCT FROM OLD.wallet_address OR NEW.request_id IS DISTINCT FROM OLD.request_id OR
         NEW.provider IS DISTINCT FROM OLD.provider OR NEW.direction IS DISTINCT FROM OLD.direction OR
         NEW.environment IS DISTINCT FROM OLD.environment OR NEW.network IS DISTINCT FROM OLD.network OR
         NEW.terms_hash IS DISTINCT FROM OLD.terms_hash OR NEW.terms IS DISTINCT FROM OLD.terms OR
         (OLD.provider_transaction_id IS NOT NULL AND NEW.provider_transaction_id IS DISTINCT FROM OLD.provider_transaction_id)
      THEN RAISE EXCEPTION 'Ramp order terms are immutable'; END IF;
      RETURN NEW;
    END $$`,
  "DROP TRIGGER IF EXISTS ramp_order_immutable_terms ON ramp_orders",
  "CREATE TRIGGER ramp_order_immutable_terms BEFORE UPDATE ON ramp_orders FOR EACH ROW EXECUTE FUNCTION protect_ramp_order_terms()",
];
