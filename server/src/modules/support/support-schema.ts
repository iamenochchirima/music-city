export const supportSchemaStatements = [
  `CREATE TABLE support_payments (
    id TEXT PRIMARY KEY,
    sender TEXT NOT NULL REFERENCES users(wallet_address),
    recipient TEXT NOT NULL REFERENCES users(wallet_address),
    request_key UUID NOT NULL,
    transaction_hash TEXT NOT NULL UNIQUE CHECK(transaction_hash ~ '^[a-f0-9]{64}$'),
    status TEXT NOT NULL CHECK(status IN ('prepared','submitting','confirmed','failed','expired','cancelled')),
    payload JSONB NOT NULL,
    signed_transaction TEXT,
    checked_at TIMESTAMPTZ,
    UNIQUE(sender,request_key),
    CHECK(sender<>recipient),
    CHECK(payload->>'id'=id AND payload->>'sender'=sender AND payload->'recipient'->>'walletAddress'=recipient AND payload->>'status'=status AND payload->>'transactionHash'=transaction_hash AND payload->>'requestKey'=request_key::text)
  )`,
  `CREATE UNIQUE INDEX support_one_active_sender ON support_payments(sender) WHERE status IN ('prepared','submitting')`,
  `CREATE INDEX support_recipient_idx ON support_payments(recipient)`,
  `CREATE INDEX support_reconcile_idx ON support_payments(status,checked_at)`,
  `CREATE TABLE support_events (
    id BIGSERIAL PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES support_payments(id),
    action TEXT NOT NULL, payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE FUNCTION protect_support_payment() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Support payment evidence is retained'; END IF;
      IF (NEW.payload - ARRAY['status','updatedAt','error','ledger','feeCharged','submissionCount','lastSubmittedAt']) IS DISTINCT FROM
         (OLD.payload - ARRAY['status','updatedAt','error','ledger','feeCharged','submissionCount','lastSubmittedAt']) OR
         NEW.sender IS DISTINCT FROM OLD.sender OR NEW.recipient IS DISTINCT FROM OLD.recipient OR NEW.request_key IS DISTINCT FROM OLD.request_key OR
         NEW.transaction_hash IS DISTINCT FROM OLD.transaction_hash OR NEW.id IS DISTINCT FROM OLD.id OR
         (OLD.signed_transaction IS NOT NULL AND NEW.signed_transaction IS DISTINCT FROM OLD.signed_transaction) THEN
        RAISE EXCEPTION 'Support payment terms are immutable';
      END IF;
      IF OLD.status IN ('confirmed','failed') AND (NEW.payload IS DISTINCT FROM OLD.payload OR NEW.status IS DISTINCT FROM OLD.status) THEN
        RAISE EXCEPTION 'Support payment outcome is immutable';
      END IF;
      RETURN NEW;
    END
  $$`,
  `CREATE TRIGGER support_payment_retained BEFORE UPDATE OR DELETE ON support_payments FOR EACH ROW EXECUTE FUNCTION protect_support_payment()`,
  `CREATE FUNCTION protect_support_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Support events are append-only'; END $$`,
  `CREATE TRIGGER support_event_immutable BEFORE UPDATE OR DELETE ON support_events FOR EACH ROW EXECUTE FUNCTION protect_support_event()`,
];
