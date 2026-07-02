import { Pool } from "pg";

import { env } from "../config/env.js";

type PersistedRow = {
  id: string;
  payload: unknown;
};

type ReleaseTrackRow = {
  release_id: string;
  track_id: string;
  track_number: number;
  disc_number: number;
  is_focus_track: boolean;
};

type PlaylistTrackRow = {
  playlist_id: string;
  track_id: string;
  position: number;
};

type CountRow = {
  count: string;
};

type DailyStreamsRow = {
  date: string;
  streams: string;
};

type TimestampRow = {
  occurred_at: Date | string;
};

type AppliedMigrationRow = {
  name: string;
};

type SchemaMigration = {
  name: string;
  statements: string[];
};

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

const baseSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT admins_role_check
      CHECK (role IN ('super_admin', 'admin'))
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    payload JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    payload JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    artist_id TEXT NOT NULL,
    status TEXT NOT NULL,
    access TEXT NOT NULL,
    media_provider TEXT,
    payload JSONB NOT NULL,
    CONSTRAINT tracks_artist_id_fk
      FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT tracks_status_check
      CHECK (status IN ('draft', 'awaiting_upload', 'uploaded', 'processing', 'published', 'failed')),
    CONSTRAINT tracks_access_check
      CHECK (access IN ('private', 'subscribers', 'purchase_required', 'public')),
    CONSTRAINT tracks_media_provider_check
      CHECK (media_provider IS NULL OR media_provider IN ('local', 'mux'))
  )`,
  `CREATE TABLE IF NOT EXISTS releases (
    id TEXT PRIMARY KEY,
    artist_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    release_date TIMESTAMPTZ,
    payload JSONB NOT NULL,
    CONSTRAINT releases_artist_id_fk
      FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT releases_type_check
      CHECK (type IN ('single', 'ep', 'album')),
    CONSTRAINT releases_status_check
      CHECK (status IN ('draft', 'scheduled', 'published', 'archived'))
  )`,
  `CREATE TABLE IF NOT EXISTS release_tracks (
    release_id TEXT NOT NULL,
    track_id TEXT NOT NULL UNIQUE,
    track_number INTEGER NOT NULL,
    disc_number INTEGER NOT NULL DEFAULT 1,
    is_focus_track BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (release_id, track_id),
    CONSTRAINT release_tracks_release_id_fk
      FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
    CONSTRAINT release_tracks_track_id_fk
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    visibility TEXT NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT playlists_owner_user_id_fk
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT playlists_visibility_check
      CHECK (visibility IN ('private', 'public'))
  )`,
  `CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, track_id),
    CONSTRAINT playlist_tracks_playlist_id_fk
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    CONSTRAINT playlist_tracks_track_id_fk
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS upload_sessions (
    id TEXT PRIMARY KEY,
    track_id TEXT,
    release_id TEXT,
    provider TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT upload_sessions_track_id_fk
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    CONSTRAINT upload_sessions_release_id_fk
      FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
    CONSTRAINT upload_sessions_provider_check
      CHECK (provider IN ('local', 's3', 'mux'))
  )`,
  `CREATE TABLE IF NOT EXISTS playback_sessions (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT playback_sessions_track_id_fk
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    CONSTRAINT playback_sessions_provider_check
      CHECK (provider IN ('local', 'mux'))
  )`,
  `CREATE TABLE IF NOT EXISTS entitlements (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    track_id TEXT NOT NULL,
    source TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    payload JSONB NOT NULL,
    CONSTRAINT entitlements_track_id_fk
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    CONSTRAINT entitlements_source_check
      CHECK (source IN ('manual', 'purchase', 'subscription', 'stellar_asset'))
  )`,
  `CREATE TABLE IF NOT EXISTS archives (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT archives_track_id_fk
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS payment_intents (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    product_type TEXT NOT NULL,
    track_id TEXT,
    status TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT payment_intents_track_id_fk
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    CONSTRAINT payment_intents_product_type_check
      CHECK (product_type IN ('track_purchase', 'platform_subscription')),
    CONSTRAINT payment_intents_status_check
      CHECK (status IN ('pending', 'confirmed', 'expired', 'failed'))
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL,
    tx_hash TEXT NOT NULL UNIQUE,
    product_type TEXT NOT NULL,
    track_id TEXT,
    confirmed_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT payments_intent_id_fk
      FOREIGN KEY (intent_id) REFERENCES payment_intents(id) ON DELETE CASCADE,
    CONSTRAINT payments_track_id_fk
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    CONSTRAINT payments_product_type_check
      CHECK (product_type IN ('track_purchase', 'platform_subscription'))
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'platform',
    status TEXT NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT subscriptions_scope_check
      CHECK (scope IN ('platform')),
    CONSTRAINT subscriptions_status_check
      CHECK (status IN ('active', 'expired', 'cancelled'))
  )`,
  `CREATE TABLE IF NOT EXISTS royalty_splits (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    status TEXT NOT NULL,
    registry_chain TEXT,
    payload JSONB NOT NULL,
    CONSTRAINT royalty_splits_track_id_fk
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    CONSTRAINT royalty_splits_status_check
      CHECK (status IN ('draft', 'active', 'superseded', 'archived'))
  )`,
  `CREATE TABLE IF NOT EXISTS royalty_ledger (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    recipient_wallet_address TEXT NOT NULL,
    status TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    recipient_chain TEXT NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT royalty_ledger_track_id_fk
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    CONSTRAINT royalty_ledger_status_check
      CHECK (status IN ('pending', 'approved', 'paid', 'reversed'))
  )`,
  `CREATE TABLE IF NOT EXISTS royalty_payouts (
    id TEXT PRIMARY KEY,
    recipient_wallet_address TEXT NOT NULL,
    status TEXT NOT NULL,
    payout_rail TEXT NOT NULL,
    payload JSONB NOT NULL,
    CONSTRAINT royalty_payouts_status_check
      CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed', 'cancelled'))
  )`,
  "CREATE INDEX IF NOT EXISTS users_wallet_address_idx ON users (wallet_address)",
  "CREATE INDEX IF NOT EXISTS users_role_idx ON users (role)",
  "CREATE INDEX IF NOT EXISTS admins_email_idx ON admins (email)",
  "CREATE INDEX IF NOT EXISTS tracks_artist_id_idx ON tracks (artist_id)",
  "CREATE INDEX IF NOT EXISTS tracks_status_idx ON tracks (status)",
  "CREATE INDEX IF NOT EXISTS releases_artist_id_idx ON releases (artist_id)",
  "CREATE INDEX IF NOT EXISTS releases_status_idx ON releases (status)",
  "CREATE INDEX IF NOT EXISTS release_tracks_release_id_idx ON release_tracks (release_id)",
  "CREATE INDEX IF NOT EXISTS playlists_owner_user_id_idx ON playlists (owner_user_id)",
  "CREATE INDEX IF NOT EXISTS playlists_visibility_idx ON playlists (visibility)",
  "CREATE INDEX IF NOT EXISTS playlist_tracks_playlist_id_idx ON playlist_tracks (playlist_id)",
  "CREATE INDEX IF NOT EXISTS upload_sessions_track_id_idx ON upload_sessions (track_id)",
  "CREATE INDEX IF NOT EXISTS playback_sessions_track_id_idx ON playback_sessions (track_id)",
  "CREATE INDEX IF NOT EXISTS entitlements_wallet_address_idx ON entitlements (wallet_address)",
  "CREATE INDEX IF NOT EXISTS entitlements_track_id_idx ON entitlements (track_id)",
  "CREATE INDEX IF NOT EXISTS archives_track_id_idx ON archives (track_id)",
  "CREATE INDEX IF NOT EXISTS payment_intents_wallet_address_idx ON payment_intents (wallet_address)",
  "CREATE INDEX IF NOT EXISTS payment_intents_track_id_idx ON payment_intents (track_id)",
  "CREATE INDEX IF NOT EXISTS payments_wallet_address_idx ON payments (wallet_address)",
  "CREATE INDEX IF NOT EXISTS subscriptions_wallet_address_idx ON subscriptions (wallet_address)",
  "CREATE INDEX IF NOT EXISTS royalty_splits_track_id_idx ON royalty_splits (track_id)",
  "CREATE INDEX IF NOT EXISTS royalty_splits_status_idx ON royalty_splits (status)",
  "CREATE INDEX IF NOT EXISTS royalty_ledger_track_id_idx ON royalty_ledger (track_id)",
  "CREATE INDEX IF NOT EXISTS royalty_ledger_recipient_wallet_idx ON royalty_ledger (recipient_wallet_address)",
  "CREATE INDEX IF NOT EXISTS royalty_ledger_status_idx ON royalty_ledger (status)",
  "CREATE INDEX IF NOT EXISTS royalty_payouts_recipient_wallet_idx ON royalty_payouts (recipient_wallet_address)",
  "CREATE INDEX IF NOT EXISTS royalty_payouts_status_idx ON royalty_payouts (status)",
];

const schemaMigrationTableStatement = `CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const schemaMigrations: SchemaMigration[] = [
  {
    name: "2026-07-02-engagement-analytics-foundation",
    statements: [
      `CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        actor_user_id TEXT,
        artist_id TEXT,
        track_id TEXT,
        release_id TEXT,
        playlist_id TEXT,
        session_id TEXT,
        occurred_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL,
        CONSTRAINT analytics_events_actor_user_id_fk
          FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT analytics_events_artist_id_fk
          FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT analytics_events_track_id_fk
          FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL,
        CONSTRAINT analytics_events_release_id_fk
          FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE SET NULL,
        CONSTRAINT analytics_events_playlist_id_fk
          FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE SET NULL,
        CONSTRAINT analytics_events_session_id_fk
          FOREIGN KEY (session_id) REFERENCES playback_sessions(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS artist_follows (
        user_id TEXT NOT NULL,
        artist_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (user_id, artist_id),
        CONSTRAINT artist_follows_user_id_fk
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT artist_follows_artist_id_fk
          FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS track_likes (
        user_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (user_id, track_id),
        CONSTRAINT track_likes_user_id_fk
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT track_likes_track_id_fk
          FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS track_saves (
        user_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (user_id, track_id),
        CONSTRAINT track_saves_user_id_fk
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT track_saves_track_id_fk
          FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS playback_events (
        id TEXT PRIMARY KEY,
        playback_session_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        artist_id TEXT NOT NULL,
        listener_user_id TEXT,
        event_type TEXT NOT NULL,
        position_seconds DOUBLE PRECISION,
        duration_seconds DOUBLE PRECISION,
        occurred_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL,
        CONSTRAINT playback_events_playback_session_id_fk
          FOREIGN KEY (playback_session_id) REFERENCES playback_sessions(id) ON DELETE CASCADE,
        CONSTRAINT playback_events_track_id_fk
          FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
        CONSTRAINT playback_events_artist_id_fk
          FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT playback_events_listener_user_id_fk
          FOREIGN KEY (listener_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT playback_events_event_type_check
          CHECK (event_type IN ('started', 'progress', 'completed', 'qualified_stream'))
      )`,
      "CREATE INDEX IF NOT EXISTS analytics_events_event_type_idx ON analytics_events (event_type)",
      "CREATE INDEX IF NOT EXISTS analytics_events_occurred_at_idx ON analytics_events (occurred_at)",
      "CREATE INDEX IF NOT EXISTS analytics_events_track_id_idx ON analytics_events (track_id)",
      "CREATE INDEX IF NOT EXISTS analytics_events_artist_id_idx ON analytics_events (artist_id)",
      "CREATE INDEX IF NOT EXISTS analytics_events_release_id_idx ON analytics_events (release_id)",
      "CREATE INDEX IF NOT EXISTS analytics_events_actor_user_id_idx ON analytics_events (actor_user_id)",
      "CREATE INDEX IF NOT EXISTS analytics_events_session_id_idx ON analytics_events (session_id)",
      "CREATE INDEX IF NOT EXISTS artist_follows_artist_id_idx ON artist_follows (artist_id)",
      "CREATE INDEX IF NOT EXISTS artist_follows_user_id_idx ON artist_follows (user_id)",
      "CREATE INDEX IF NOT EXISTS track_likes_track_id_idx ON track_likes (track_id)",
      "CREATE INDEX IF NOT EXISTS track_likes_user_id_idx ON track_likes (user_id)",
      "CREATE INDEX IF NOT EXISTS track_saves_track_id_idx ON track_saves (track_id)",
      "CREATE INDEX IF NOT EXISTS track_saves_user_id_idx ON track_saves (user_id)",
      "CREATE INDEX IF NOT EXISTS playback_events_track_id_idx ON playback_events (track_id)",
      "CREATE INDEX IF NOT EXISTS playback_events_artist_id_idx ON playback_events (artist_id)",
      "CREATE INDEX IF NOT EXISTS playback_events_listener_user_id_idx ON playback_events (listener_user_id)",
      "CREATE INDEX IF NOT EXISTS playback_events_event_type_idx ON playback_events (event_type)",
      "CREATE INDEX IF NOT EXISTS playback_events_occurred_at_idx ON playback_events (occurred_at)",
    ],
  },
  {
    name: "2026-07-02-release-foundation",
    statements: [
      `CREATE TABLE IF NOT EXISTS releases (
        id TEXT PRIMARY KEY,
        artist_id TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        release_date TIMESTAMPTZ,
        payload JSONB NOT NULL,
        CONSTRAINT releases_artist_id_fk
          FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT releases_type_check
          CHECK (type IN ('single', 'ep', 'album')),
        CONSTRAINT releases_status_check
          CHECK (status IN ('draft', 'scheduled', 'published', 'archived'))
      )`,
      `CREATE TABLE IF NOT EXISTS release_tracks (
        release_id TEXT NOT NULL,
        track_id TEXT NOT NULL UNIQUE,
        track_number INTEGER NOT NULL,
        disc_number INTEGER NOT NULL DEFAULT 1,
        is_focus_track BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (release_id, track_id),
        CONSTRAINT release_tracks_release_id_fk
          FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE,
        CONSTRAINT release_tracks_track_id_fk
          FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      )`,
      "CREATE INDEX IF NOT EXISTS releases_artist_id_idx ON releases (artist_id)",
      "CREATE INDEX IF NOT EXISTS releases_status_idx ON releases (status)",
      "CREATE INDEX IF NOT EXISTS release_tracks_release_id_idx ON release_tracks (release_id)",
    ],
  },
  {
    name: "2026-07-02-playlist-foundation",
    statements: [
      `CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        visibility TEXT NOT NULL,
        payload JSONB NOT NULL,
        CONSTRAINT playlists_owner_user_id_fk
          FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT playlists_visibility_check
          CHECK (visibility IN ('private', 'public'))
      )`,
      `CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, track_id),
        CONSTRAINT playlist_tracks_playlist_id_fk
          FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        CONSTRAINT playlist_tracks_track_id_fk
          FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      )`,
      "CREATE INDEX IF NOT EXISTS playlists_owner_user_id_idx ON playlists (owner_user_id)",
      "CREATE INDEX IF NOT EXISTS playlists_visibility_idx ON playlists (visibility)",
      "CREATE INDEX IF NOT EXISTS playlist_tracks_playlist_id_idx ON playlist_tracks (playlist_id)",
    ],
  },
  {
    name: "2026-07-02-platform-subscription-cleanup",
    statements: [
      `UPDATE payment_intents
        SET product_type = 'platform_subscription',
            payload = jsonb_strip_nulls(
              jsonb_set(
                (payload - 'artistId'),
                '{productType}',
                to_jsonb('platform_subscription'::text),
                true
              )
            )
        WHERE product_type = 'artist_subscription'`,
      `UPDATE payment_intents
        SET payload = jsonb_strip_nulls(
          jsonb_set(payload, '{subscriptionScope}', to_jsonb('platform'::text), true)
        )
        WHERE product_type = 'platform_subscription'
          AND COALESCE(payload->>'subscriptionScope', '') <> 'platform'`,
      "ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_product_type_check",
      `ALTER TABLE payment_intents
        ADD CONSTRAINT payment_intents_product_type_check
        CHECK (product_type IN ('track_purchase', 'platform_subscription'))`,
      "ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_artist_id_fk",
      "DROP INDEX IF EXISTS payment_intents_artist_id_idx",
      "ALTER TABLE payment_intents DROP COLUMN IF EXISTS artist_id",
      `UPDATE payments
        SET product_type = 'platform_subscription',
            payload = jsonb_strip_nulls(
              jsonb_set(
                (payload - 'artistId'),
                '{productType}',
                to_jsonb('platform_subscription'::text),
                true
              )
            )
        WHERE product_type = 'artist_subscription'`,
      `UPDATE payments
        SET payload = jsonb_strip_nulls(
          jsonb_set(payload, '{subscriptionScope}', to_jsonb('platform'::text), true)
        )
        WHERE product_type = 'platform_subscription'
          AND COALESCE(payload->>'subscriptionScope', '') <> 'platform'`,
      "ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_product_type_check",
      `ALTER TABLE payments
        ADD CONSTRAINT payments_product_type_check
        CHECK (product_type IN ('track_purchase', 'platform_subscription'))`,
      "ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_artist_id_fk",
      "ALTER TABLE payments DROP COLUMN IF EXISTS artist_id",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS scope TEXT",
      `UPDATE subscriptions
        SET scope = 'platform',
            payload = jsonb_strip_nulls(
              jsonb_set((payload - 'artistId'), '{scope}', to_jsonb('platform'::text), true)
            )
        WHERE scope <> 'platform' OR payload ? 'artistId' OR COALESCE(payload->>'scope', '') <> 'platform'`,
      "ALTER TABLE subscriptions ALTER COLUMN scope SET DEFAULT 'platform'",
      "ALTER TABLE subscriptions ALTER COLUMN scope SET NOT NULL",
      "ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_scope_check",
      `ALTER TABLE subscriptions
        ADD CONSTRAINT subscriptions_scope_check
        CHECK (scope IN ('platform'))`,
      "ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_artist_id_fk",
      "DROP INDEX IF EXISTS subscriptions_artist_id_idx",
      "ALTER TABLE subscriptions DROP COLUMN IF EXISTS artist_id",
      "CREATE INDEX IF NOT EXISTS subscriptions_scope_idx ON subscriptions (scope)",
    ],
  },
  {
    name: "2026-07-02-royalty-constraint-refresh",
    statements: [
      "ALTER TABLE royalty_splits DROP CONSTRAINT IF EXISTS royalty_splits_status_check",
      `ALTER TABLE royalty_splits
        ADD CONSTRAINT royalty_splits_status_check
        CHECK (status IN ('draft', 'active', 'superseded', 'archived'))`,
      "ALTER TABLE royalty_ledger DROP CONSTRAINT IF EXISTS royalty_ledger_status_check",
      `ALTER TABLE royalty_ledger
        ADD CONSTRAINT royalty_ledger_status_check
        CHECK (status IN ('pending', 'approved', 'paid', 'reversed'))`,
      "ALTER TABLE royalty_payouts DROP CONSTRAINT IF EXISTS royalty_payouts_status_check",
      `ALTER TABLE royalty_payouts
        ADD CONSTRAINT royalty_payouts_status_check
        CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed', 'cancelled'))`,
    ],
  },
  {
    name: "2026-07-02-engagement-qualified-stream-idempotency",
    statements: [
      `CREATE UNIQUE INDEX IF NOT EXISTS playback_events_qualified_stream_session_uidx
       ON playback_events (playback_session_id)
       WHERE event_type = 'qualified_stream'`,
    ],
  },
  {
    name: "2026-07-02-upload-sessions-release-support",
    statements: [
      "ALTER TABLE upload_sessions ALTER COLUMN track_id DROP NOT NULL",
      "ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS release_id TEXT",
      `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'upload_sessions_release_id_fk'
        ) THEN
          ALTER TABLE upload_sessions
            ADD CONSTRAINT upload_sessions_release_id_fk
            FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE;
        END IF;
      END $$`,
      "CREATE INDEX IF NOT EXISTS upload_sessions_release_id_idx ON upload_sessions (release_id)",
    ],
  },
];

const mapPayloadRows = <T>(rows: PersistedRow[]) =>
  rows.map((row) => row.payload as T);

export const databaseService = {
  async initialize() {
    await pool.query(schemaMigrationTableStatement);

    for (const statement of baseSchemaStatements) {
      await pool.query(statement);
    }

    const appliedMigrations = await pool.query<AppliedMigrationRow>(
      "SELECT name FROM schema_migrations ORDER BY name",
    );
    const appliedNames = new Set(appliedMigrations.rows.map((row) => row.name));

    for (const migration of schemaMigrations) {
      if (appliedNames.has(migration.name)) {
        continue;
      }

      await pool.query("BEGIN");

      try {
        for (const statement of migration.statements) {
          await pool.query(statement);
        }

        await pool.query(
          "INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
          [migration.name],
        );
        await pool.query("COMMIT");
      } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
      }
    }
  },

  async countRows(table: string) {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${table}`,
    );

    return Number(result.rows[0]?.count ?? "0");
  },

  async listPayloads<T>(table: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM ${table} ORDER BY id`,
    );

    return mapPayloadRows<T>(result.rows);
  },

  async findPayloadById<T>(table: string, id: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM ${table} WHERE id = $1 LIMIT 1`,
      [id],
    );

    return result.rows[0]?.payload as T | null;
  },

  async upsertRelease(
    id: string,
    artistId: string,
    type: string,
    status: string,
    releaseDate: string | null,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO releases (id, artist_id, type, status, release_date, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         artist_id = EXCLUDED.artist_id,
         type = EXCLUDED.type,
         status = EXCLUDED.status,
         release_date = EXCLUDED.release_date,
         payload = EXCLUDED.payload`,
      [id, artistId, type, status, releaseDate, JSON.stringify(payload)],
    );
  },

  async listReleasesByArtist<T>(artistId: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM releases
       WHERE artist_id = $1
       ORDER BY COALESCE(release_date, NOW()) DESC, id DESC`,
      [artistId],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async deleteRelease(id: string) {
    await pool.query(`DELETE FROM releases WHERE id = $1`, [id]);
  },

  async assignTrackToRelease(
    releaseId: string,
    trackId: string,
    trackNumber: number,
    discNumber: number,
    isFocusTrack: boolean,
  ) {
    await pool.query(
      `INSERT INTO release_tracks (
         release_id,
         track_id,
         track_number,
         disc_number,
         is_focus_track
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (track_id) DO UPDATE SET
         release_id = EXCLUDED.release_id,
         track_number = EXCLUDED.track_number,
         disc_number = EXCLUDED.disc_number,
         is_focus_track = EXCLUDED.is_focus_track`,
      [releaseId, trackId, trackNumber, discNumber, isFocusTrack],
    );
  },

  async removeTrackFromRelease(releaseId: string, trackId: string) {
    await pool.query(
      `DELETE FROM release_tracks WHERE release_id = $1 AND track_id = $2`,
      [releaseId, trackId],
    );
  },

  async listReleaseTracks(releaseId: string) {
    const result = await pool.query<ReleaseTrackRow>(
      `SELECT release_id, track_id, track_number, disc_number, is_focus_track
       FROM release_tracks
       WHERE release_id = $1
       ORDER BY disc_number ASC, track_number ASC, track_id ASC`,
      [releaseId],
    );

    return result.rows;
  },

  async upsertPlaylist(
    id: string,
    ownerUserId: string,
    visibility: string,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO playlists (id, owner_user_id, visibility, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         owner_user_id = EXCLUDED.owner_user_id,
         visibility = EXCLUDED.visibility,
         payload = EXCLUDED.payload`,
      [id, ownerUserId, visibility, JSON.stringify(payload)],
    );
  },

  async listPlaylistsByOwner<T>(ownerUserId: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM playlists WHERE owner_user_id = $1 ORDER BY id DESC`,
      [ownerUserId],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async deletePlaylist(id: string) {
    await pool.query(`DELETE FROM playlists WHERE id = $1`, [id]);
  },

  async assignTrackToPlaylist(playlistId: string, trackId: string, position: number) {
    await pool.query(
      `INSERT INTO playlist_tracks (playlist_id, track_id, position)
       VALUES ($1, $2, $3)
       ON CONFLICT (playlist_id, track_id) DO UPDATE SET
         position = EXCLUDED.position`,
      [playlistId, trackId, position],
    );
  },

  async removeTrackFromPlaylist(playlistId: string, trackId: string) {
    await pool.query(
      `DELETE FROM playlist_tracks WHERE playlist_id = $1 AND track_id = $2`,
      [playlistId, trackId],
    );
  },

  async listPlaylistTracks(playlistId: string) {
    const result = await pool.query<PlaylistTrackRow>(
      `SELECT playlist_id, track_id, position
       FROM playlist_tracks
       WHERE playlist_id = $1
       ORDER BY position ASC, track_id ASC`,
      [playlistId],
    );

    return result.rows;
  },

  async upsertUser(
    id: string,
    walletAddress: string,
    role: string,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO users (id, wallet_address, role, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         wallet_address = EXCLUDED.wallet_address,
         role = EXCLUDED.role,
         payload = EXCLUDED.payload`,
      [id, walletAddress, role, JSON.stringify(payload)],
    );
  },

  async findUserByWallet<T>(walletAddress: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM users WHERE wallet_address = $1 LIMIT 1`,
      [walletAddress],
    );

    return result.rows[0]?.payload as T | null;
  },

  async listUsersByRole<T>(role: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM users WHERE role = $1 ORDER BY id`,
      [role],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async findUserById<T>(id: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM users WHERE id = $1 LIMIT 1`,
      [id],
    );

    return result.rows[0]?.payload as T | null;
  },

  async upsertTrack(
    id: string,
    artistId: string,
    status: string,
    access: string,
    mediaProvider: string | null,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO tracks (id, artist_id, status, access, media_provider, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         artist_id = EXCLUDED.artist_id,
         status = EXCLUDED.status,
         access = EXCLUDED.access,
         media_provider = EXCLUDED.media_provider,
         payload = EXCLUDED.payload`,
      [id, artistId, status, access, mediaProvider, JSON.stringify(payload)],
    );
  },

  async listTracksByArtist<T>(artistId: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM tracks WHERE artist_id = $1 ORDER BY id`,
      [artistId],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async deleteTrack(id: string) {
    await pool.query(`DELETE FROM tracks WHERE id = $1`, [id]);
  },

  async upsertUploadSession(
    id: string,
    trackId: string | null,
    releaseId: string | null,
    provider: string,
    expiresAt: string,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO upload_sessions (id, track_id, release_id, provider, expires_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         track_id = EXCLUDED.track_id,
         release_id = EXCLUDED.release_id,
         provider = EXCLUDED.provider,
         expires_at = EXCLUDED.expires_at,
         payload = EXCLUDED.payload`,
      [id, trackId, releaseId, provider, expiresAt, JSON.stringify(payload)],
    );
  },

  async upsertPlaybackSession(
    id: string,
    trackId: string,
    provider: string,
    expiresAt: string,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO playback_sessions (id, track_id, provider, expires_at, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         track_id = EXCLUDED.track_id,
         provider = EXCLUDED.provider,
         expires_at = EXCLUDED.expires_at,
         payload = EXCLUDED.payload`,
      [id, trackId, provider, expiresAt, JSON.stringify(payload)],
    );
  },

  async upsertArtistFollow(userId: string, artistId: string, createdAt: string) {
    await pool.query(
      `INSERT INTO artist_follows (user_id, artist_id, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, artist_id) DO UPDATE SET
         created_at = EXCLUDED.created_at`,
      [userId, artistId, createdAt],
    );
  },

  async deleteArtistFollow(userId: string, artistId: string) {
    await pool.query(
      `DELETE FROM artist_follows WHERE user_id = $1 AND artist_id = $2`,
      [userId, artistId],
    );
  },

  async hasArtistFollow(userId: string, artistId: string) {
    const result = await pool.query(
      `SELECT 1 FROM artist_follows WHERE user_id = $1 AND artist_id = $2 LIMIT 1`,
      [userId, artistId],
    );

    return (result.rowCount ?? 0) > 0;
  },

  async countArtistFollowers(artistId: string) {
    const result = await pool.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM artist_follows WHERE artist_id = $1`,
      [artistId],
    );

    return Number(result.rows[0]?.count ?? "0");
  },

  async upsertTrackLike(userId: string, trackId: string, createdAt: string) {
    await pool.query(
      `INSERT INTO track_likes (user_id, track_id, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, track_id) DO UPDATE SET
         created_at = EXCLUDED.created_at`,
      [userId, trackId, createdAt],
    );
  },

  async deleteTrackLike(userId: string, trackId: string) {
    await pool.query(
      `DELETE FROM track_likes WHERE user_id = $1 AND track_id = $2`,
      [userId, trackId],
    );
  },

  async hasTrackLike(userId: string, trackId: string) {
    const result = await pool.query(
      `SELECT 1 FROM track_likes WHERE user_id = $1 AND track_id = $2 LIMIT 1`,
      [userId, trackId],
    );

    return (result.rowCount ?? 0) > 0;
  },

  async countTrackLikes(trackId: string) {
    const result = await pool.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM track_likes WHERE track_id = $1`,
      [trackId],
    );

    return Number(result.rows[0]?.count ?? "0");
  },

  async upsertTrackSave(userId: string, trackId: string, createdAt: string) {
    await pool.query(
      `INSERT INTO track_saves (user_id, track_id, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, track_id) DO UPDATE SET
         created_at = EXCLUDED.created_at`,
      [userId, trackId, createdAt],
    );
  },

  async deleteTrackSave(userId: string, trackId: string) {
    await pool.query(
      `DELETE FROM track_saves WHERE user_id = $1 AND track_id = $2`,
      [userId, trackId],
    );
  },

  async hasTrackSave(userId: string, trackId: string) {
    const result = await pool.query(
      `SELECT 1 FROM track_saves WHERE user_id = $1 AND track_id = $2 LIMIT 1`,
      [userId, trackId],
    );

    return (result.rowCount ?? 0) > 0;
  },

  async countTrackSaves(trackId: string) {
    const result = await pool.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM track_saves WHERE track_id = $1`,
      [trackId],
    );

    return Number(result.rows[0]?.count ?? "0");
  },

  async insertAnalyticsEvent(
    id: string,
    eventType: string,
    actorUserId: string | null,
    artistId: string | null,
    trackId: string | null,
    releaseId: string | null,
    playlistId: string | null,
    sessionId: string | null,
    occurredAt: string,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO analytics_events (
         id,
         event_type,
         actor_user_id,
         artist_id,
         track_id,
         release_id,
         playlist_id,
         session_id,
         occurred_at,
         payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [
        id,
        eventType,
        actorUserId,
        artistId,
        trackId,
        releaseId,
        playlistId,
        sessionId,
        occurredAt,
        JSON.stringify(payload),
      ],
    );
  },

  async insertPlaybackEvent(
    id: string,
    playbackSessionId: string,
    trackId: string,
    artistId: string,
    listenerUserId: string | null,
    eventType: string,
    positionSeconds: number | null,
    durationSeconds: number | null,
    occurredAt: string,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO playback_events (
         id,
         playback_session_id,
         track_id,
         artist_id,
         listener_user_id,
         event_type,
         position_seconds,
         duration_seconds,
         occurred_at,
         payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [
        id,
        playbackSessionId,
        trackId,
        artistId,
        listenerUserId,
        eventType,
        positionSeconds,
        durationSeconds,
        occurredAt,
        JSON.stringify(payload),
      ],
    );
  },

  async insertQualifiedPlaybackEvent(
    id: string,
    playbackSessionId: string,
    trackId: string,
    artistId: string,
    listenerUserId: string | null,
    positionSeconds: number | null,
    durationSeconds: number | null,
    occurredAt: string,
    payload: unknown,
  ) {
    const result = await pool.query(
      `INSERT INTO playback_events (
         id,
         playback_session_id,
         track_id,
         artist_id,
         listener_user_id,
         event_type,
         position_seconds,
         duration_seconds,
         occurred_at,
         payload
       )
       VALUES ($1, $2, $3, $4, $5, 'qualified_stream', $6, $7, $8, $9::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING occurred_at`,
      [
        id,
        playbackSessionId,
        trackId,
        artistId,
        listenerUserId,
        positionSeconds,
        durationSeconds,
        occurredAt,
        JSON.stringify(payload),
      ],
    );

    return (result.rowCount ?? 0) > 0;
  },

  async findQualifiedStreamCountedAt(playbackSessionId: string) {
    const result = await pool.query<TimestampRow>(
      `SELECT occurred_at
       FROM playback_events
       WHERE playback_session_id = $1
         AND event_type = 'qualified_stream'
       ORDER BY occurred_at DESC
       LIMIT 1`,
      [playbackSessionId],
    );

    const occurredAt = result.rows[0]?.occurred_at;

    if (!occurredAt) {
      return null;
    }

    return occurredAt instanceof Date
      ? occurredAt.toISOString()
      : new Date(occurredAt).toISOString();
  },

  async countQualifiedStreamsByTrack(trackId: string) {
    const result = await pool.query<CountRow>(
      `SELECT COUNT(*)::text AS count
       FROM playback_events
       WHERE track_id = $1 AND event_type = 'qualified_stream'`,
      [trackId],
    );

    return Number(result.rows[0]?.count ?? "0");
  },

  async countQualifiedStreamsByArtist(artistId: string) {
    const result = await pool.query<CountRow>(
      `SELECT COUNT(*)::text AS count
       FROM playback_events
       WHERE artist_id = $1 AND event_type = 'qualified_stream'`,
      [artistId],
    );

    return Number(result.rows[0]?.count ?? "0");
  },

  async countQualifiedStreamsByArtistSince(artistId: string, days: number) {
    const result = await pool.query<CountRow>(
      `SELECT COUNT(*)::text AS count
       FROM playback_events
       WHERE artist_id = $1
         AND event_type = 'qualified_stream'
         AND occurred_at >= NOW() - ($2::text || ' days')::interval`,
      [artistId, String(days)],
    );

    return Number(result.rows[0]?.count ?? "0");
  },

  async countUniqueListenersByArtist(artistId: string) {
    const result = await pool.query<CountRow>(
      `SELECT COUNT(DISTINCT listener_user_id)::text AS count
       FROM playback_events
       WHERE artist_id = $1
         AND event_type = 'qualified_stream'
         AND listener_user_id IS NOT NULL`,
      [artistId],
    );

    return Number(result.rows[0]?.count ?? "0");
  },

  async countUniqueListenersByTrack(trackId: string) {
    const result = await pool.query<CountRow>(
      `SELECT COUNT(DISTINCT listener_user_id)::text AS count
       FROM playback_events
       WHERE track_id = $1
         AND event_type = 'qualified_stream'
         AND listener_user_id IS NOT NULL`,
      [trackId],
    );

    return Number(result.rows[0]?.count ?? "0");
  },

  async listArtistDailyQualifiedStreams(artistId: string, days: number) {
    const result = await pool.query<DailyStreamsRow>(
      `SELECT TO_CHAR(DATE_TRUNC('day', occurred_at), 'YYYY-MM-DD') AS date,
              COUNT(*)::text AS streams
       FROM playback_events
       WHERE artist_id = $1
         AND event_type = 'qualified_stream'
         AND occurred_at >= NOW() - ($2::text || ' days')::interval
       GROUP BY DATE_TRUNC('day', occurred_at)
       ORDER BY DATE_TRUNC('day', occurred_at) ASC`,
      [artistId, String(days)],
    );

    return result.rows.map((row) => ({
      date: row.date,
      streams: Number(row.streams),
    }));
  },

  async upsertEntitlement(
    id: string,
    walletAddress: string,
    trackId: string,
    source: string,
    startsAt: string,
    endsAt: string | null,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO entitlements (id, wallet_address, track_id, source, starts_at, ends_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         wallet_address = EXCLUDED.wallet_address,
         track_id = EXCLUDED.track_id,
         source = EXCLUDED.source,
         starts_at = EXCLUDED.starts_at,
         ends_at = EXCLUDED.ends_at,
         payload = EXCLUDED.payload`,
      [id, walletAddress, trackId, source, startsAt, endsAt, JSON.stringify(payload)],
    );
  },

  async listEntitlementsByWallet<T>(walletAddress: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM entitlements WHERE wallet_address = $1 ORDER BY id`,
      [walletAddress],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async listEntitlementsByTrack<T>(trackId: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM entitlements WHERE track_id = $1 ORDER BY id`,
      [trackId],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async upsertArchive(
    id: string,
    trackId: string,
    createdAt: string,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO archives (id, track_id, created_at, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         track_id = EXCLUDED.track_id,
         created_at = EXCLUDED.created_at,
         payload = EXCLUDED.payload`,
      [id, trackId, createdAt, JSON.stringify(payload)],
    );
  },

  async listArchivesByTrack<T>(trackId: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM archives WHERE track_id = $1 ORDER BY created_at DESC, id`,
      [trackId],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async upsertPaymentIntent(
    id: string,
    walletAddress: string,
    productType: string,
    trackId: string | null,
    status: string,
    expiresAt: string,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO payment_intents (id, wallet_address, product_type, track_id, status, expires_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         wallet_address = EXCLUDED.wallet_address,
         product_type = EXCLUDED.product_type,
         track_id = EXCLUDED.track_id,
         status = EXCLUDED.status,
         expires_at = EXCLUDED.expires_at,
         payload = EXCLUDED.payload`,
      [id, walletAddress, productType, trackId, status, expiresAt, JSON.stringify(payload)],
    );
  },

  async listPaymentIntentsByWallet<T>(walletAddress: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM payment_intents WHERE wallet_address = $1 ORDER BY expires_at DESC, id DESC`,
      [walletAddress],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async upsertPayment(
    id: string,
    intentId: string,
    walletAddress: string,
    txHash: string,
    productType: string,
    trackId: string | null,
    confirmedAt: string,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO payments (id, intent_id, wallet_address, tx_hash, product_type, track_id, confirmed_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         intent_id = EXCLUDED.intent_id,
         wallet_address = EXCLUDED.wallet_address,
         tx_hash = EXCLUDED.tx_hash,
         product_type = EXCLUDED.product_type,
         track_id = EXCLUDED.track_id,
         confirmed_at = EXCLUDED.confirmed_at,
         payload = EXCLUDED.payload`,
      [id, intentId, walletAddress, txHash, productType, trackId, confirmedAt, JSON.stringify(payload)],
    );
  },

  async findPaymentByTxHash<T>(txHash: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM payments WHERE tx_hash = $1 LIMIT 1`,
      [txHash],
    );

    return result.rows[0]?.payload as T | null;
  },

  async findPaymentByIntentId<T>(intentId: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM payments WHERE intent_id = $1 LIMIT 1`,
      [intentId],
    );

    return result.rows[0]?.payload as T | null;
  },

  async listPaymentsByWallet<T>(walletAddress: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM payments WHERE wallet_address = $1 ORDER BY confirmed_at DESC, id DESC`,
      [walletAddress],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async upsertSubscription(
    id: string,
    walletAddress: string,
    scope: string,
    status: string,
    endsAt: string,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO subscriptions (id, wallet_address, scope, status, ends_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         wallet_address = EXCLUDED.wallet_address,
         scope = EXCLUDED.scope,
         status = EXCLUDED.status,
         ends_at = EXCLUDED.ends_at,
         payload = EXCLUDED.payload`,
      [id, walletAddress, scope, status, endsAt, JSON.stringify(payload)],
    );
  },

  async listSubscriptionsByWallet<T>(walletAddress: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM subscriptions WHERE wallet_address = $1 ORDER BY ends_at DESC, id DESC`,
      [walletAddress],
    );

    return mapPayloadRows<T>(result.rows);
  },
  async upsertRoyaltySplit(
    id: string,
    trackId: string,
    version: number,
    status: string,
    registryChain: string | null,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO royalty_splits (id, track_id, version, status, registry_chain, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         track_id = EXCLUDED.track_id,
         version = EXCLUDED.version,
         status = EXCLUDED.status,
         registry_chain = EXCLUDED.registry_chain,
         payload = EXCLUDED.payload`,
      [id, trackId, version, status, registryChain, JSON.stringify(payload)],
    );
  },

  async listRoyaltySplitsByTrack<T>(trackId: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM royalty_splits WHERE track_id = $1 ORDER BY version DESC, id DESC`,
      [trackId],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async upsertRoyaltyLedgerEntry(
    id: string,
    trackId: string,
    recipientWalletAddress: string,
    status: string,
    sourceType: string,
    sourceId: string,
    recipientChain: string,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO royalty_ledger (id, track_id, recipient_wallet_address, status, source_type, source_id, recipient_chain, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         track_id = EXCLUDED.track_id,
         recipient_wallet_address = EXCLUDED.recipient_wallet_address,
         status = EXCLUDED.status,
         source_type = EXCLUDED.source_type,
         source_id = EXCLUDED.source_id,
         recipient_chain = EXCLUDED.recipient_chain,
         payload = EXCLUDED.payload`,
      [id, trackId, recipientWalletAddress, status, sourceType, sourceId, recipientChain, JSON.stringify(payload)],
    );
  },

  async listRoyaltyLedgerEntriesByTrack<T>(trackId: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM royalty_ledger WHERE track_id = $1 ORDER BY id DESC`,
      [trackId],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async listRoyaltyLedgerEntriesBySource<T>(sourceType: string, sourceId: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM royalty_ledger WHERE source_type = $1 AND source_id = $2 ORDER BY id DESC`,
      [sourceType, sourceId],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async listRoyaltyLedgerEntries<T>(filters?: {
    status?: string;
    recipientWalletAddress?: string;
  }) {
    const where: string[] = [];
    const values: string[] = [];

    if (filters?.status) {
      values.push(filters.status);
      where.push(`status = $${values.length}`);
    }

    if (filters?.recipientWalletAddress) {
      values.push(filters.recipientWalletAddress);
      where.push(`recipient_wallet_address = $${values.length}`);
    }

    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM royalty_ledger${
        where.length > 0 ? ` WHERE ${where.join(" AND ")}` : ""
      } ORDER BY id DESC`,
      values,
    );

    return mapPayloadRows<T>(result.rows);
  },

  async listRoyaltyLedgerEntriesByIds<T>(entryIds: string[]) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM royalty_ledger WHERE id = ANY($1::text[]) ORDER BY id DESC`,
      [entryIds],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async upsertRoyaltyPayout(
    id: string,
    recipientWalletAddress: string,
    status: string,
    payoutRail: string,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO royalty_payouts (id, recipient_wallet_address, status, payout_rail, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         recipient_wallet_address = EXCLUDED.recipient_wallet_address,
         status = EXCLUDED.status,
         payout_rail = EXCLUDED.payout_rail,
         payload = EXCLUDED.payload`,
      [id, recipientWalletAddress, status, payoutRail, JSON.stringify(payload)],
    );
  },

  async listRoyaltyPayoutsByRecipient<T>(recipientWalletAddress: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM royalty_payouts WHERE recipient_wallet_address = $1 ORDER BY id DESC`,
      [recipientWalletAddress],
    );

    return mapPayloadRows<T>(result.rows);
  },

  async listRoyaltyPayouts<T>(filters?: {
    status?: string;
    recipientWalletAddress?: string;
  }) {
    const where: string[] = [];
    const values: string[] = [];

    if (filters?.status) {
      values.push(filters.status);
      where.push(`status = $${values.length}`);
    }

    if (filters?.recipientWalletAddress) {
      values.push(filters.recipientWalletAddress);
      where.push(`recipient_wallet_address = $${values.length}`);
    }

    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM royalty_payouts${
        where.length > 0 ? ` WHERE ${where.join(" AND ")}` : ""
      } ORDER BY id DESC`,
      values,
    );

    return mapPayloadRows<T>(result.rows);
  },

  async countAdmins() {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM admins`,
    );

    return Number(result.rows[0]?.count ?? "0");
  },

  async upsertAdmin(
    id: string,
    email: string,
    role: string,
    payload: unknown,
  ) {
    await pool.query(
      `INSERT INTO admins (id, email, role, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         payload = EXCLUDED.payload`,
      [id, email, role, JSON.stringify(payload)],
    );
  },

  async findAdminByEmail<T>(email: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM admins WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email],
    );

    return result.rows[0]?.payload as T | null;
  },

  async findAdminById<T>(id: string) {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM admins WHERE id = $1 LIMIT 1`,
      [id],
    );

    return result.rows[0]?.payload as T | null;
  },

  async listAdmins<T>() {
    const result = await pool.query<PersistedRow>(
      `SELECT id, payload FROM admins ORDER BY id`,
    );

    return mapPayloadRows<T>(result.rows);
  },

  async upsertSetting(key: string, payload: unknown) {
    await pool.query(
      `INSERT INTO app_settings (key, payload)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET
         payload = EXCLUDED.payload`,
      [key, JSON.stringify(payload)],
    );
  },

  async findSetting<T>(key: string) {
    const result = await pool.query<{ payload: unknown }>(
      `SELECT payload FROM app_settings WHERE key = $1 LIMIT 1`,
      [key],
    );

    return (result.rows[0]?.payload as T | undefined) ?? null;
  },
};
