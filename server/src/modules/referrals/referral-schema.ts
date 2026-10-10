export const referralSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS referral_campaigns (
    version TEXT PRIMARY KEY, window_days INTEGER NOT NULL CHECK(window_days > 0),
    rewards_enabled BOOLEAN NOT NULL DEFAULT FALSE CHECK(rewards_enabled = FALSE)
  )`,
  `INSERT INTO referral_campaigns(version,window_days) VALUES('registration-v1',30) ON CONFLICT DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS referral_codes (
    code TEXT PRIMARY KEY, inviter_id TEXT NOT NULL UNIQUE REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY, inviter_id TEXT NOT NULL REFERENCES users(id),
    invitee_id TEXT NOT NULL UNIQUE REFERENCES users(id), campaign TEXT NOT NULL REFERENCES referral_campaigns(version),
    captured_at TIMESTAMPTZ NOT NULL, bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ, artist_qualified_at TIMESTAMPTZ,
    excluded_at TIMESTAMPTZ, exclusion_reason TEXT,
    CHECK(inviter_id <> invitee_id),
    CHECK(artist_qualified_at IS NULL OR completed_at IS NOT NULL),
    CHECK((excluded_at IS NULL) = (exclusion_reason IS NULL))
  )`,
  `CREATE INDEX IF NOT EXISTS referrals_inviter_idx ON referrals(inviter_id)`,
  `CREATE TABLE IF NOT EXISTS referral_events (
    id BIGSERIAL PRIMARY KEY, referral_id TEXT NOT NULL REFERENCES referrals(id),
    action TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(referral_id,action)
  )`,
  `CREATE OR REPLACE FUNCTION protect_referral_attribution() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.inviter_id IS DISTINCT FROM OLD.inviter_id OR NEW.invitee_id IS DISTINCT FROM OLD.invitee_id
        OR NEW.campaign IS DISTINCT FROM OLD.campaign OR NEW.captured_at IS DISTINCT FROM OLD.captured_at
        OR NEW.bound_at IS DISTINCT FROM OLD.bound_at THEN
        RAISE EXCEPTION 'Referral attribution is immutable';
      END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS referral_attribution_guard ON referrals`,
  `CREATE TRIGGER referral_attribution_guard BEFORE UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION protect_referral_attribution()`,
];

export const referralActivationSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS referral_paid_activations (
    referral_id TEXT PRIMARY KEY REFERENCES referrals(id), payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id),
    amount TEXT NOT NULL, asset_code TEXT NOT NULL, asset_issuer TEXT, network_passphrase TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE OR REPLACE FUNCTION protect_referral_event() RETURNS TRIGGER AS $$
    BEGIN RAISE EXCEPTION 'Referral events are append only'; END; $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS referral_event_guard ON referral_events`,
  `CREATE TRIGGER referral_event_guard BEFORE UPDATE OR DELETE ON referral_events FOR EACH ROW EXECUTE FUNCTION protect_referral_event()`,
];

export const referralCampaignControlStatements = [
  `ALTER TABLE referral_campaigns ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`,
];
