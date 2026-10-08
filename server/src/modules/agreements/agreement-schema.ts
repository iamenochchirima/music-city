export const agreementSchemaStatements = [
  `CREATE TABLE contributor_agreements (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL UNIQUE REFERENCES tracks(id),
    owner_wallet TEXT NOT NULL REFERENCES users(wallet_address),
    current_version INTEGER NOT NULL CHECK (current_version > 0),
    effective_version INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE agreement_versions (
    agreement_id TEXT NOT NULL REFERENCES contributor_agreements(id),
    version INTEGER NOT NULL CHECK (version > 0),
    proposal_hash TEXT NOT NULL CHECK (proposal_hash ~ '^[a-f0-9]{64}$'),
    state TEXT NOT NULL CHECK (state IN ('draft','proposed','ready','rejected','disputed','finalizing','finalized','cancelled')),
    payload JSONB NOT NULL,
    PRIMARY KEY (agreement_id, version),
    UNIQUE (agreement_id, proposal_hash),
    CHECK (payload->>'state' = state),
    CHECK (payload->>'proposalHash' = proposal_hash)
  )`,
  `ALTER TABLE contributor_agreements ADD CONSTRAINT agreement_current_version_fk
    FOREIGN KEY (id, current_version) REFERENCES agreement_versions(agreement_id, version) DEFERRABLE INITIALLY DEFERRED`,
  `ALTER TABLE contributor_agreements ADD CONSTRAINT agreement_effective_version_fk
    FOREIGN KEY (id, effective_version) REFERENCES agreement_versions(agreement_id, version) DEFERRABLE INITIALLY DEFERRED`,
  `CREATE TABLE agreement_contributors (
    agreement_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
    PRIMARY KEY (agreement_id, version, wallet_address),
    FOREIGN KEY (agreement_id, version) REFERENCES agreement_versions(agreement_id, version)
  )`,
  `CREATE TABLE agreement_challenges (
    id TEXT PRIMARY KEY,
    agreement_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    wallet_address TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    payload JSONB NOT NULL,
    FOREIGN KEY (agreement_id, version, wallet_address) REFERENCES agreement_contributors(agreement_id, version, wallet_address)
  )`,
  `CREATE TABLE agreement_responses (
    challenge_id TEXT PRIMARY KEY REFERENCES agreement_challenges(id),
    agreement_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    wallet_address TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('accept','reject','dispute')),
    payload JSONB NOT NULL,
    UNIQUE (agreement_id, version, wallet_address, action),
    FOREIGN KEY (agreement_id, version, wallet_address) REFERENCES agreement_contributors(agreement_id, version, wallet_address)
  )`,
  `CREATE TABLE agreement_events (
    id BIGSERIAL PRIMARY KEY,
    agreement_id TEXT NOT NULL REFERENCES contributor_agreements(id),
    version INTEGER NOT NULL,
    actor_wallet TEXT NOT NULL,
    action TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (agreement_id, version) REFERENCES agreement_versions(agreement_id, version)
  )`,
  `CREATE FUNCTION protect_agreement_version() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.state <> 'draft' AND (NEW.payload->'proposal' IS DISTINCT FROM OLD.payload->'proposal' OR NEW.proposal_hash <> OLD.proposal_hash) THEN
        RAISE EXCEPTION 'Submitted agreement proposals are immutable';
      END IF;
      IF OLD.state = 'finalized' AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'Finalized agreement versions are immutable';
      END IF;
      RETURN NEW;
    END
  $$`,
  `CREATE TRIGGER agreement_version_immutable BEFORE UPDATE ON agreement_versions
    FOR EACH ROW EXECUTE FUNCTION protect_agreement_version()`,
  `CREATE FUNCTION protect_agreement_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Agreement evidence is append-only'; END
  $$`,
  ...["agreement_events", "agreement_responses"].map(table => `CREATE TRIGGER ${table}_append_only BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION protect_agreement_evidence()`),
  `CREATE INDEX agreement_contributor_wallet_idx ON agreement_contributors(wallet_address)`,
];
