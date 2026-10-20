export const checkoutSchemaStatements = [
  `CREATE TABLE payment_checkouts (
    id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL UNIQUE REFERENCES payment_intents(id),
    wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
    status TEXT NOT NULL CHECK(status IN ('prepared','submitting','confirmed','failed','expired')),
    transaction_hash TEXT NOT NULL UNIQUE CHECK(transaction_hash ~ '^[a-f0-9]{64}$'),
    payload JSONB NOT NULL,
    signed_transaction TEXT,
    checked_at TIMESTAMPTZ,
    CHECK(payload->>'id'=id AND payload->>'intentId'=intent_id AND payload->>'walletAddress'=wallet_address AND payload->>'status'=status AND payload->>'transactionHash'=transaction_hash)
  )`,
  `CREATE UNIQUE INDEX checkout_one_active_wallet ON payment_checkouts(wallet_address) WHERE status IN ('prepared','submitting')`,
  `CREATE INDEX checkout_reconcile_idx ON payment_checkouts(status,checked_at)`,
  `CREATE TABLE checkout_events (
    id BIGSERIAL PRIMARY KEY,
    checkout_id TEXT NOT NULL REFERENCES payment_checkouts(id),
    action TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE FUNCTION protect_checkout() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Checkout evidence is retained'; END IF;
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.intent_id IS DISTINCT FROM OLD.intent_id OR
      NEW.wallet_address IS DISTINCT FROM OLD.wallet_address OR NEW.transaction_hash IS DISTINCT FROM OLD.transaction_hash OR
      (NEW.payload - ARRAY['status','updatedAt','submissionCount','lastSubmittedAt','ledger','feeCharged','error']) IS DISTINCT FROM
      (OLD.payload - ARRAY['status','updatedAt','submissionCount','lastSubmittedAt','ledger','feeCharged','error']) OR
      (OLD.signed_transaction IS NOT NULL AND NEW.signed_transaction IS DISTINCT FROM OLD.signed_transaction) THEN
      RAISE EXCEPTION 'Checkout terms are immutable';
    END IF;
    IF OLD.status IN ('confirmed','failed','expired') AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.payload IS DISTINCT FROM OLD.payload) THEN
      RAISE EXCEPTION 'Checkout outcome is immutable';
    END IF;
    RETURN NEW;
  END $$`,
  `CREATE TRIGGER checkout_retained BEFORE UPDATE OR DELETE ON payment_checkouts FOR EACH ROW EXECUTE FUNCTION protect_checkout()`,
  `CREATE FUNCTION protect_checkout_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Checkout events are append-only'; END $$`,
  `CREATE TRIGGER checkout_event_retained BEFORE UPDATE OR DELETE ON checkout_events FOR EACH ROW EXECUTE FUNCTION protect_checkout_event()`,
];
