export const settlementChainEventSchemaStatements = [
  `CREATE TABLE settlement_chain_events (
    network_passphrase TEXT NOT NULL,
    contract_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    transaction_hash TEXT NOT NULL,
    ledger BIGINT NOT NULL CHECK(ledger>0),
    batch_id TEXT,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(network_passphrase,contract_id,event_id)
  )`,
  `CREATE INDEX settlement_chain_events_batch_idx ON settlement_chain_events(network_passphrase,contract_id,batch_id)`,
  `CREATE TRIGGER settlement_chain_events_immutable BEFORE UPDATE OR DELETE ON settlement_chain_events FOR EACH ROW EXECUTE FUNCTION protect_settlement_evidence()`,
  `CREATE TABLE settlement_chain_cursors (
    network_passphrase TEXT NOT NULL,
    contract_id TEXT NOT NULL,
    deployment_ledger BIGINT NOT NULL CHECK(deployment_ledger>0),
    cursor TEXT,
    indexed_ledger BIGINT,
    caught_up BOOLEAN NOT NULL DEFAULT FALSE,
    checked_at TIMESTAMPTZ,
    error TEXT,
    PRIMARY KEY(network_passphrase,contract_id)
  )`,
];
settlementChainEventSchemaStatements.push(
  `CREATE FUNCTION protect_settlement_receipts() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF (OLD.payload->>'fundingHash' IS NOT NULL AND NEW.payload->>'fundingHash' IS DISTINCT FROM OLD.payload->>'fundingHash') OR
        (OLD.payload->>'fundedLedger' IS NOT NULL AND NEW.payload->>'fundedLedger' IS DISTINCT FROM OLD.payload->>'fundedLedger') THEN
        RAISE EXCEPTION 'Confirmed settlement funding evidence is immutable';
      END IF;
      RETURN NEW;
    END
  $$`,
  `CREATE TRIGGER settlement_funding_evidence_immutable BEFORE UPDATE ON settlement_batches FOR EACH ROW EXECUTE FUNCTION protect_settlement_receipts()`,
);
settlementChainEventSchemaStatements.push(
  `CREATE TABLE settlement_reconciliation_snapshots (
    network_passphrase TEXT NOT NULL,
    contract_id TEXT NOT NULL,
    payload JSONB,
    error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(network_passphrase,contract_id)
  )`,
);
