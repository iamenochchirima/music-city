export const finalizationSchemaStatements = [
  `CREATE TABLE agreement_finalizations (
    id TEXT PRIMARY KEY,
    agreement_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    treasury_address TEXT NOT NULL,
    transaction_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK(status IN ('awaiting_signatures','submitting','submitted','confirmed','failed','expired')),
    payload JSONB NOT NULL,
    FOREIGN KEY(agreement_id,version) REFERENCES agreement_versions(agreement_id,version),
    CHECK(payload->>'status'=status),
    CHECK(payload->>'transactionHash'=transaction_hash)
  )`,
  `CREATE UNIQUE INDEX agreement_one_active_treasury_attempt ON agreement_finalizations(treasury_address)
    WHERE status IN ('awaiting_signatures','submitting','submitted')`,
  `CREATE UNIQUE INDEX agreement_one_confirmed_version ON agreement_finalizations(agreement_id,version) WHERE status='confirmed'`,
  `CREATE FUNCTION protect_agreement_finalization() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.transaction_hash <> OLD.transaction_hash OR
        NEW.payload->>'transaction' <> OLD.payload->>'transaction' OR
        NEW.payload->>'proposalHash' <> OLD.payload->>'proposalHash' OR
        NEW.payload->>'treasuryAddress' <> OLD.payload->>'treasuryAddress' OR
        NEW.payload->>'contractId' <> OLD.payload->>'contractId' OR
        NEW.payload->>'networkPassphrase' <> OLD.payload->>'networkPassphrase' OR
        NEW.payload->'signers' IS DISTINCT FROM OLD.payload->'signers' THEN
        RAISE EXCEPTION 'Finalization transaction context is immutable';
      END IF;
      IF OLD.status='confirmed' AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'Confirmed finalization evidence is immutable';
      END IF;
      RETURN NEW;
    END
  $$`,
  `CREATE TRIGGER agreement_finalization_immutable BEFORE UPDATE ON agreement_finalizations FOR EACH ROW EXECUTE FUNCTION protect_agreement_finalization()`,
  `CREATE FUNCTION verify_effective_agreement() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.effective_version IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM agreement_versions v JOIN agreement_finalizations f ON f.agreement_id=v.agreement_id AND f.version=v.version
        WHERE v.agreement_id=NEW.id AND v.version=NEW.effective_version AND v.state='finalized' AND f.status='confirmed'
      ) THEN RAISE EXCEPTION 'An effective agreement must have confirmed finalization evidence'; END IF;
      RETURN NEW;
    END
  $$`,
  `CREATE TRIGGER agreement_effective_evidence BEFORE INSERT OR UPDATE ON contributor_agreements FOR EACH ROW EXECUTE FUNCTION verify_effective_agreement()`,
];

export const finalizationIntegrityStatements = [
  `ALTER TABLE agreement_finalizations ADD CONSTRAINT finalization_payload_identity CHECK(
    payload->>'agreementId'=agreement_id AND (payload->>'version')::integer=version AND payload->>'treasuryAddress'=treasury_address
  )`,
  `CREATE OR REPLACE FUNCTION protect_agreement_finalization() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.agreement_id IS DISTINCT FROM OLD.agreement_id OR NEW.version IS DISTINCT FROM OLD.version OR
        NEW.treasury_address IS DISTINCT FROM OLD.treasury_address OR NEW.transaction_hash IS DISTINCT FROM OLD.transaction_hash OR
        NEW.payload->>'transaction' IS DISTINCT FROM OLD.payload->>'transaction' OR
        NEW.payload->>'proposalHash' IS DISTINCT FROM OLD.payload->>'proposalHash' OR
        NEW.payload->>'previousFinalizedHash' IS DISTINCT FROM OLD.payload->>'previousFinalizedHash' OR
        NEW.payload->>'treasuryAddress' IS DISTINCT FROM OLD.payload->>'treasuryAddress' OR
        NEW.payload->>'contractId' IS DISTINCT FROM OLD.payload->>'contractId' OR
        NEW.payload->>'networkPassphrase' IS DISTINCT FROM OLD.payload->>'networkPassphrase' OR
        NEW.payload->>'expiresAt' IS DISTINCT FROM OLD.payload->>'expiresAt' OR
        NEW.payload->>'createdAt' IS DISTINCT FROM OLD.payload->>'createdAt' OR
        NEW.payload->'signers' IS DISTINCT FROM OLD.payload->'signers' THEN
        RAISE EXCEPTION 'Finalization transaction context is immutable';
      END IF;
      IF OLD.status='confirmed' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Confirmed finalization evidence is immutable'; END IF;
      RETURN NEW;
    END
  $$`,
  `CREATE TRIGGER agreement_finalization_retained BEFORE DELETE ON agreement_finalizations FOR EACH ROW EXECUTE FUNCTION protect_agreement_evidence()`,
  `CREATE FUNCTION retain_effective_agreement() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.effective_version IS NOT NULL AND (NEW.effective_version IS NULL OR NEW.effective_version < OLD.effective_version) THEN
        RAISE EXCEPTION 'A finalized effective agreement cannot be removed or regressed';
      END IF;
      RETURN NEW;
    END
  $$`,
  `CREATE TRIGGER agreement_effective_retained BEFORE UPDATE ON contributor_agreements FOR EACH ROW EXECUTE FUNCTION retain_effective_agreement()`,
];
