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

export const expandedGuestPlaybackSchemaStatements = [
  `ALTER TABLE guest_playback_allowances ADD COLUMN IF NOT EXISTS listened_seconds DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'guest_playback_allowances' AND column_name = 'first_track_id') THEN
      UPDATE guest_playback_allowances SET listened_seconds = first_listened_seconds + second_listened_seconds;
      ALTER TABLE guest_playback_allowances DROP COLUMN first_track_id, DROP COLUMN first_listened_seconds,
        DROP COLUMN second_track_id, DROP COLUMN second_listened_seconds;
    END IF;
  END $$`,
];
