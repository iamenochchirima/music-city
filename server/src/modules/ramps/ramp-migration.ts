export const rampSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS ramp_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    wallet_address TEXT NOT NULL,
    request_id UUID NOT NULL,
    provider TEXT NOT NULL CHECK(provider IN ('moonpay','moneygram')),
    direction TEXT NOT NULL CHECK(direction IN ('buy','sell')),
    environment TEXT NOT NULL CHECK(environment='sandbox'),
    network TEXT NOT NULL CHECK(network='stellar:testnet'),
    terms_hash TEXT NOT NULL CHECK(terms_hash ~ '^[a-f0-9]{64}$'),
    terms JSONB NOT NULL,
    provider_transaction_id TEXT,
    provider_state TEXT NOT NULL DEFAULT 'created' CHECK(provider_state IN ('created','awaiting_user','processing','ready_for_pickup','completed','failed','cancelled','refund_pending','refunded','unknown')),
    chain_state TEXT NOT NULL DEFAULT 'unobserved' CHECK(chain_state IN ('unobserved','prepared','submitting','confirmed','failed','unknown')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id,request_id),UNIQUE(provider,environment,provider_transaction_id),
    CHECK ((terms->>'userId'=user_id AND terms->>'walletAddress'=wallet_address AND terms->>'requestId'=request_id::text AND terms->>'provider'=provider AND terms->>'direction'=direction AND terms->>'environment'=environment AND terms->>'network'=network) IS TRUE)
  )`,
  `CREATE INDEX IF NOT EXISTS ramp_orders_owner_history ON ramp_orders(user_id,created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS ramp_quotes (
    id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES ramp_orders(id),
    provider_quote_id TEXT NOT NULL,snapshot JSONB NOT NULL,expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(order_id,provider_quote_id),UNIQUE(id,order_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ramp_chain_attempts (
    id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES ramp_orders(id),quote_id TEXT NOT NULL,
    FOREIGN KEY(quote_id,order_id) REFERENCES ramp_quotes(id,order_id),
    network TEXT NOT NULL CHECK(network='stellar:testnet'),
    transaction_hash TEXT NOT NULL CHECK(transaction_hash ~ '^[a-f0-9]{64}$'),
    prepared_envelope TEXT NOT NULL,signed_envelope_encrypted BYTEA,
    state TEXT NOT NULL CHECK(state IN ('prepared','submitting','confirmed','failed','unknown')),
    expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(network,transaction_hash)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ramp_one_uncertain_transfer ON ramp_chain_attempts(order_id) WHERE state IN ('prepared','submitting','unknown','confirmed')`,
  `CREATE TABLE IF NOT EXISTS ramp_events (
    id BIGSERIAL PRIMARY KEY,order_id TEXT NOT NULL REFERENCES ramp_orders(id),
    source TEXT NOT NULL CHECK(source IN ('app','provider_api','verified_webhook','chain')),
    event_key TEXT NOT NULL,kind TEXT NOT NULL,data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(order_id,source,event_key)
  )`,
  `CREATE OR REPLACE FUNCTION reject_ramp_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Ramp events are append-only'; END $$`,
  `DROP TRIGGER IF EXISTS ramp_event_no_update_delete ON ramp_events`,
  `CREATE TRIGGER ramp_event_no_update_delete BEFORE UPDATE OR DELETE ON ramp_events FOR EACH ROW EXECUTE FUNCTION reject_ramp_event_mutation()`,
  `DROP TRIGGER IF EXISTS ramp_event_no_truncate ON ramp_events`,
  `CREATE TRIGGER ramp_event_no_truncate BEFORE TRUNCATE ON ramp_events FOR EACH STATEMENT EXECUTE FUNCTION reject_ramp_event_mutation()`,
  `CREATE TABLE IF NOT EXISTS ramp_reconciliation_jobs (
    order_id TEXT PRIMARY KEY REFERENCES ramp_orders(id),due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    leased_until TIMESTAMPTZ,attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),last_error_code TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS ramp_reconciliation_due ON ramp_reconciliation_jobs(due_at)`,
];
