export const publicationSchemaStatements = [
  `CREATE TABLE publication_requests (
    id TEXT PRIMARY KEY,
    release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
    artist_id TEXT NOT NULL REFERENCES users(id),
    state TEXT NOT NULL CHECK (state IN ('processing','scheduled','published','failed','cancelled')),
    mode TEXT NOT NULL CHECK (mode IN ('published','scheduled')),
    release_at TIMESTAMPTZ,
    target JSONB NOT NULL,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX publication_requests_active_idx ON publication_requests(release_id) WHERE state IN ('processing','scheduled')`,
  `CREATE INDEX publication_requests_due_idx ON publication_requests(state,release_at)`,
  `CREATE TABLE media_jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('media','event','publication','ingest')),
    payload JSONB NOT NULL,
    state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','done','failed')),
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lease_until TIMESTAMPTZ,
    lease_token TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX media_jobs_due_idx ON media_jobs(state,available_at,lease_until)`,
];
