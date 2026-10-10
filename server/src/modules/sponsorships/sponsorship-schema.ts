export const sponsorshipSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS artist_sponsorship_campaigns (
    code TEXT PRIMARY KEY,
    terms_revision TEXT NOT NULL,
    currency TEXT NOT NULL CHECK(currency='USD'),
    original_amount_minor INTEGER NOT NULL CHECK(original_amount_minor >= 0),
    discount_amount_minor INTEGER NOT NULL CHECK(discount_amount_minor >= 0),
    amount_due_minor INTEGER NOT NULL CHECK(amount_due_minor >= 0),
    discount_percent INTEGER NOT NULL CHECK(discount_percent BETWEEN 0 AND 100),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK(original_amount_minor - discount_amount_minor = amount_due_minor)
  )`,
  `INSERT INTO artist_sponsorship_campaigns
    (code,terms_revision,currency,original_amount_minor,discount_amount_minor,amount_due_minor,discount_percent,active)
    VALUES('EARLYUSER','v1','USD',2000,2000,0,100,TRUE) ON CONFLICT(code) DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS artist_sponsorship_eligibilities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    campaign_code TEXT NOT NULL REFERENCES artist_sponsorship_campaigns(code),
    terms_revision TEXT NOT NULL,
    currency TEXT NOT NULL CHECK(currency='USD'),
    original_amount_minor INTEGER NOT NULL CHECK(original_amount_minor >= 0),
    discount_amount_minor INTEGER NOT NULL CHECK(discount_amount_minor >= 0),
    amount_due_minor INTEGER NOT NULL CHECK(amount_due_minor >= 0),
    discount_percent INTEGER NOT NULL CHECK(discount_percent BETWEEN 0 AND 100),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK(original_amount_minor - discount_amount_minor = amount_due_minor)
  )`,
  `CREATE INDEX IF NOT EXISTS artist_sponsorship_eligibilities_campaign_idx
    ON artist_sponsorship_eligibilities(campaign_code,captured_at)`,
  `CREATE TABLE IF NOT EXISTS artist_sponsorship_grants (
    id TEXT PRIMARY KEY,
    eligibility_id TEXT NOT NULL UNIQUE REFERENCES artist_sponsorship_eligibilities(id),
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    campaign_code TEXT NOT NULL REFERENCES artist_sponsorship_campaigns(code),
    terms_revision TEXT NOT NULL,
    currency TEXT NOT NULL CHECK(currency='USD'),
    original_amount_minor INTEGER NOT NULL CHECK(original_amount_minor >= 0),
    discount_amount_minor INTEGER NOT NULL CHECK(discount_amount_minor >= 0),
    amount_due_minor INTEGER NOT NULL CHECK(amount_due_minor = 0),
    discount_percent INTEGER NOT NULL CHECK(discount_percent=100),
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK(original_amount_minor - discount_amount_minor = amount_due_minor)
  )`,
  `CREATE TABLE IF NOT EXISTS artist_sponsorship_events (
    id BIGSERIAL PRIMARY KEY,
    campaign_code TEXT NOT NULL REFERENCES artist_sponsorship_campaigns(code),
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK(action IN ('eligibility_captured','artist_activated','campaign_paused','campaign_resumed')),
    actor TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS artist_sponsorship_events_created_idx
    ON artist_sponsorship_events(created_at,id)`,
  `CREATE OR REPLACE FUNCTION protect_artist_sponsorship_terms() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.code IS DISTINCT FROM OLD.code
        OR NEW.terms_revision IS DISTINCT FROM OLD.terms_revision
        OR NEW.currency IS DISTINCT FROM OLD.currency
        OR NEW.original_amount_minor IS DISTINCT FROM OLD.original_amount_minor
        OR NEW.discount_amount_minor IS DISTINCT FROM OLD.discount_amount_minor
        OR NEW.amount_due_minor IS DISTINCT FROM OLD.amount_due_minor
        OR NEW.discount_percent IS DISTINCT FROM OLD.discount_percent THEN
        RAISE EXCEPTION 'Artist sponsorship terms are immutable';
      END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS artist_sponsorship_campaign_terms_guard ON artist_sponsorship_campaigns`,
  `CREATE TRIGGER artist_sponsorship_campaign_terms_guard
    BEFORE UPDATE ON artist_sponsorship_campaigns FOR EACH ROW EXECUTE FUNCTION protect_artist_sponsorship_terms()`,
  `CREATE OR REPLACE FUNCTION protect_artist_sponsorship_record() RETURNS TRIGGER AS $$
    BEGIN RAISE EXCEPTION 'Artist sponsorship records are immutable'; END; $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS artist_sponsorship_eligibility_guard ON artist_sponsorship_eligibilities`,
  `CREATE TRIGGER artist_sponsorship_eligibility_guard
    BEFORE UPDATE OR DELETE ON artist_sponsorship_eligibilities FOR EACH ROW EXECUTE FUNCTION protect_artist_sponsorship_record()`,
  `DROP TRIGGER IF EXISTS artist_sponsorship_grant_guard ON artist_sponsorship_grants`,
  `CREATE TRIGGER artist_sponsorship_grant_guard
    BEFORE UPDATE OR DELETE ON artist_sponsorship_grants FOR EACH ROW EXECUTE FUNCTION protect_artist_sponsorship_record()`,
  `CREATE OR REPLACE FUNCTION protect_artist_sponsorship_event() RETURNS TRIGGER AS $$
    BEGIN RAISE EXCEPTION 'Artist sponsorship events are append only'; END; $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS artist_sponsorship_event_guard ON artist_sponsorship_events`,
  `CREATE TRIGGER artist_sponsorship_event_guard
    BEFORE UPDATE OR DELETE ON artist_sponsorship_events FOR EACH ROW EXECUTE FUNCTION protect_artist_sponsorship_event()`,
];
