export const contributorPublicationStatements = [
  `CREATE TABLE contributor_chain_attempts (
    challenge_id TEXT PRIMARY KEY REFERENCES agreement_challenges(id),
    agreement_id TEXT NOT NULL REFERENCES contributor_agreements(id),
    version INTEGER NOT NULL,
    actor TEXT NOT NULL,
    transaction_hash TEXT NOT NULL UNIQUE,
    signed_transaction TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('submitted','confirmed','failed')),
    checked_at TIMESTAMPTZ,
    error TEXT,
    receipt JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX contributor_chain_pending_idx ON contributor_chain_attempts(status)`,
  `CREATE FUNCTION protect_contributor_attempt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.challenge_id<>OLD.challenge_id OR NEW.agreement_id<>OLD.agreement_id OR NEW.version<>OLD.version OR NEW.actor<>OLD.actor OR NEW.transaction_hash<>OLD.transaction_hash OR NEW.signed_transaction<>OLD.signed_transaction THEN RAISE EXCEPTION 'Contributor signing context is immutable'; END IF;
    IF OLD.status='confirmed' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Confirmed contributor evidence is immutable'; END IF;
    RETURN NEW;
  END $$`,
  `CREATE TRIGGER contributor_attempt_retained BEFORE UPDATE ON contributor_chain_attempts FOR EACH ROW EXECUTE FUNCTION protect_contributor_attempt()`,
  `CREATE TRIGGER contributor_attempt_no_delete BEFORE DELETE ON contributor_chain_attempts FOR EACH ROW EXECUTE FUNCTION protect_agreement_evidence()`,
];

export const contributorEffectiveEvidenceStatements = [
  `CREATE OR REPLACE FUNCTION verify_effective_agreement() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF NEW.effective_version IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM agreement_versions v WHERE v.agreement_id=NEW.id AND v.version=NEW.effective_version AND v.state='finalized' AND (
        (v.payload->>'publicationMode'='contributors' AND EXISTS (
          SELECT 1 FROM contributor_chain_attempts a
          WHERE a.agreement_id=v.agreement_id AND a.version=v.version AND a.status='confirmed'
            AND a.transaction_hash=v.payload->'publication'->>'transactionHash'
            AND a.receipt->>'contractId'=v.payload->'publication'->>'contractId'
            AND a.receipt->>'ledger'=v.payload->'publication'->>'ledger'
            AND a.actor=v.payload->'publication'->>'actor'
            AND a.signed_transaction=v.payload->'publication'->>'transaction'
        )) OR (v.payload->>'publicationMode' IS NULL AND EXISTS (
          SELECT 1 FROM agreement_finalizations f WHERE f.agreement_id=v.agreement_id AND f.version=v.version AND f.status='confirmed'
        ))
      )
    ) THEN RAISE EXCEPTION 'An effective agreement must have confirmed finalization evidence'; END IF;
    RETURN NEW;
  END $$`,
];
