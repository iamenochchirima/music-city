export const guestPlaybackSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS guest_playback_allowances (
    guest_id_hash TEXT PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    first_track_id TEXT,
    first_listened_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
    second_track_id TEXT,
    second_listened_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  "CREATE INDEX IF NOT EXISTS guest_playback_allowances_expires_idx ON guest_playback_allowances (expires_at)",
];
