export const rampClaimLinkStatements = [
  "ALTER TABLE ramp_orders ADD COLUMN IF NOT EXISTS associated_claim_batch_id TEXT",
  "ALTER TABLE ramp_orders ADD COLUMN IF NOT EXISTS associated_claim_index INTEGER",
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ramp_orders'::regclass AND conname='ramp_orders_associated_claim_pair_check') THEN
      ALTER TABLE ramp_orders ADD CONSTRAINT ramp_orders_associated_claim_pair_check CHECK (
        (associated_claim_batch_id IS NULL) = (associated_claim_index IS NULL) AND
        (associated_claim_index IS NULL OR associated_claim_index BETWEEN 0 AND 19) AND
        (associated_claim_batch_id IS NULL OR direction='sell') AND
        (terms->'associatedClaim'->>'batchId') IS NOT DISTINCT FROM associated_claim_batch_id AND
        NULLIF(terms->'associatedClaim'->>'claimIndex','')::INTEGER IS NOT DISTINCT FROM associated_claim_index
      );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ramp_orders'::regclass AND conname='ramp_orders_associated_claim_batch_fk') THEN
      ALTER TABLE ramp_orders ADD CONSTRAINT ramp_orders_associated_claim_batch_fk
        FOREIGN KEY (associated_claim_batch_id) REFERENCES settlement_batches(id);
    END IF;
  END $$`,
  `CREATE OR REPLACE FUNCTION protect_ramp_order_terms() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR
         NEW.wallet_address IS DISTINCT FROM OLD.wallet_address OR NEW.request_id IS DISTINCT FROM OLD.request_id OR
         NEW.provider IS DISTINCT FROM OLD.provider OR NEW.direction IS DISTINCT FROM OLD.direction OR
         NEW.environment IS DISTINCT FROM OLD.environment OR NEW.network IS DISTINCT FROM OLD.network OR
         NEW.terms_hash IS DISTINCT FROM OLD.terms_hash OR NEW.terms IS DISTINCT FROM OLD.terms OR
         NEW.associated_claim_batch_id IS DISTINCT FROM OLD.associated_claim_batch_id OR
         NEW.associated_claim_index IS DISTINCT FROM OLD.associated_claim_index OR
         (OLD.provider_transaction_id IS NOT NULL AND NEW.provider_transaction_id IS DISTINCT FROM OLD.provider_transaction_id)
      THEN RAISE EXCEPTION 'Ramp order terms are immutable'; END IF;
      RETURN NEW;
    END $$`,
];
