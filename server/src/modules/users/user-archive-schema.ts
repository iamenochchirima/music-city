export const userArchiveStatements = [
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ",
];
