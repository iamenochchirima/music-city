export const notificationSchemaStatements = [
  `CREATE TABLE notifications (
    id TEXT PRIMARY KEY, event_key TEXT NOT NULL, recipient TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, href TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), read_at TIMESTAMPTZ,
    UNIQUE(event_key,recipient)
  )`,
  `CREATE INDEX notifications_inbox ON notifications(recipient,created_at DESC,id DESC)`,
  `CREATE TABLE notification_deliveries (
    id TEXT PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE, recipient TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    email TEXT NOT NULL, message JSONB NOT NULL,
    state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','sent','failed','skipped')),
    attempts INTEGER NOT NULL DEFAULT 0, available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lease_until TIMESTAMPTZ, lease_token TEXT, first_attempt_at TIMESTAMPTZ,
    error TEXT, provider_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX notification_deliveries_due ON notification_deliveries(state,available_at)`,
  `CREATE TABLE notification_email_sink (
    id TEXT PRIMARY KEY REFERENCES notification_deliveries(id) ON DELETE CASCADE, email TEXT NOT NULL,
    message JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];
