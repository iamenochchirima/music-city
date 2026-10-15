export const settlementSchemaStatements = [
  `CREATE TABLE settlement_batches (
    id TEXT PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
    source_key TEXT NOT NULL UNIQUE CHECK(source_key ~ '^[a-f0-9]{64}$'),
    agreement_id TEXT NOT NULL, version INTEGER NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('reserved','funded','closed')),
    payload JSONB NOT NULL,
    checked_at TIMESTAMPTZ,
    FOREIGN KEY(agreement_id,version) REFERENCES agreement_versions(agreement_id,version),
    CHECK(payload->>'id'=id AND payload->>'sourceKey'=source_key AND payload->>'state'=state)
  )`,
  `CREATE TABLE settlement_reservations (
    ledger_id TEXT PRIMARY KEY REFERENCES royalty_ledger(id),
    batch_id TEXT NOT NULL REFERENCES settlement_batches(id),
    allocation_index INTEGER NOT NULL CHECK(allocation_index BETWEEN 0 AND 19),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE financial_attempts (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES settlement_batches(id),
    source_address TEXT NOT NULL,
    checked_at TIMESTAMPTZ,
    transaction_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK(status IN ('awaiting_signatures','submitting','submitted','confirmed','failed','expired')),
    payload JSONB NOT NULL,
    CHECK(payload->>'id'=id AND payload->>'batchId'=batch_id AND payload->>'transactionHash'=transaction_hash AND payload->>'status'=status)
  )`,
  `CREATE UNIQUE INDEX financial_one_active_source ON financial_attempts(source_address) WHERE status IN ('awaiting_signatures','submitting','submitted')`,
  `CREATE INDEX financial_attempts_reconcile_idx ON financial_attempts(status)`,
  `CREATE TABLE settlement_events (
    id BIGSERIAL PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES settlement_batches(id),
    actor TEXT NOT NULL, action TEXT NOT NULL, payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE FUNCTION protect_settlement_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Settlement evidence is retained and append-only'; END
  $$`,
  ...["settlement_events", "settlement_reservations"].map(
    (table) =>
      `CREATE TRIGGER ${table}_immutable BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION protect_settlement_evidence()`,
  ),
  ...["settlement_batches", "financial_attempts"].map(
    (table) =>
      `CREATE TRIGGER ${table}_retained BEFORE DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION protect_settlement_evidence()`,
  ),
  `CREATE FUNCTION protect_settlement_terms() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.source_key IS DISTINCT FROM OLD.source_key OR
        NEW.agreement_id IS DISTINCT FROM OLD.agreement_id OR NEW.version IS DISTINCT FROM OLD.version OR
        (NEW.payload - ARRAY['state','allocations','fundedLedger','fundingHash','updatedAt','discrepancy']) IS DISTINCT FROM
        (OLD.payload - ARRAY['state','allocations','fundedLedger','fundingHash','updatedAt','discrepancy']) OR
        jsonb_array_length(NEW.payload->'allocations') <> jsonb_array_length(OLD.payload->'allocations') OR
        EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.payload->'allocations') WITH ORDINALITY n(value,i)
        JOIN jsonb_array_elements(OLD.payload->'allocations') WITH ORDINALITY o(value,i) USING(i)
        WHERE (n.value - ARRAY['status','updatedLedger','transactionHash']) IS DISTINCT FROM (o.value - ARRAY['status','updatedLedger','transactionHash']) OR
          (o.value->>'status' IN ('claimed','reclaimed') AND (n.value->>'status' IS DISTINCT FROM o.value->>'status' OR n.value->'updatedLedger' IS DISTINCT FROM o.value->'updatedLedger' OR (o.value->>'transactionHash' IS NOT NULL AND n.value->>'transactionHash' IS DISTINCT FROM o.value->>'transactionHash')))) THEN
        RAISE EXCEPTION 'Authorized settlement terms are immutable';
      END IF;
      IF OLD.state='closed' AND NEW.state<>'closed' OR OLD.state='funded' AND NEW.state='reserved' THEN RAISE EXCEPTION 'Settlement cannot regress'; END IF;
      RETURN NEW;
    END
  $$`,
  `CREATE TRIGGER settlement_terms_immutable BEFORE UPDATE ON settlement_batches FOR EACH ROW EXECUTE FUNCTION protect_settlement_terms()`,
  `CREATE FUNCTION protect_financial_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF (NEW.payload - ARRAY['status','signatures','signedBy','updatedAt','ledger','feeCharged','error','submissionCount','lastSubmittedAt']) IS DISTINCT FROM
         (OLD.payload - ARRAY['status','signatures','signedBy','updatedAt','ledger','feeCharged','error','submissionCount','lastSubmittedAt']) OR
         NEW.source_address IS DISTINCT FROM OLD.source_address OR NEW.transaction_hash IS DISTINCT FROM OLD.transaction_hash THEN
         RAISE EXCEPTION 'Financial transaction identity is immutable';
      END IF;
      IF OLD.status IN ('confirmed','failed','expired') AND (NEW.payload IS DISTINCT FROM OLD.payload OR NEW.status IS DISTINCT FROM OLD.status) THEN RAISE EXCEPTION 'Financial transaction outcome is immutable'; END IF;
      RETURN NEW;
    END
  $$`,
  `CREATE TRIGGER financial_attempt_immutable BEFORE UPDATE ON financial_attempts FOR EACH ROW EXECUTE FUNCTION protect_financial_attempt()`,
  `CREATE FUNCTION protect_reserved_earnings() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS(SELECT 1 FROM settlement_reservations WHERE ledger_id=OLD.id) AND
        (TG_OP='DELETE' OR NEW.status='reversed' OR NEW.track_id IS DISTINCT FROM OLD.track_id OR
        NEW.recipient_wallet_address IS DISTINCT FROM OLD.recipient_wallet_address OR
        NEW.source_type IS DISTINCT FROM OLD.source_type OR NEW.source_id IS DISTINCT FROM OLD.source_id OR
        (NEW.payload - ARRAY['status','updatedAt']) IS DISTINCT FROM (OLD.payload - ARRAY['status','updatedAt'])) THEN
        RAISE EXCEPTION 'Reserved earnings cannot be deleted, reversed, or reallocated';
      END IF;
      IF TG_OP='DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END
  $$`,
  `CREATE TRIGGER royalty_reserved_earnings BEFORE UPDATE OR DELETE ON royalty_ledger FOR EACH ROW EXECUTE FUNCTION protect_reserved_earnings()`,
  `CREATE FUNCTION prevent_cross_executor_payout() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.payload->'ledgerEntryIds') e(id) JOIN settlement_reservations r ON r.ledger_id=e.id) THEN
        RAISE EXCEPTION 'This source is reserved for threshold-authorized settlement';
      END IF;
      RETURN NEW;
    END
  $$`,
  `CREATE TRIGGER royalty_prevent_cross_executor BEFORE INSERT OR UPDATE ON royalty_payouts FOR EACH ROW EXECUTE FUNCTION prevent_cross_executor_payout()`,
  `CREATE FUNCTION prevent_late_source_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('royalty-source:' || NEW.source_type || ':' || NEW.source_id));
      IF EXISTS(SELECT 1 FROM settlement_batches b WHERE b.payload->>'trackId'=NEW.track_id AND b.payload->>'sourceType'=NEW.source_type AND b.payload->>'sourceId'=NEW.source_id) THEN
        RAISE EXCEPTION 'Reserved settlement sources cannot receive additional ledger entries';
      END IF;
      RETURN NEW;
    END
  $$`,
  `CREATE TRIGGER royalty_no_late_source BEFORE INSERT ON royalty_ledger FOR EACH ROW EXECUTE FUNCTION prevent_late_source_allocation()`,
];
