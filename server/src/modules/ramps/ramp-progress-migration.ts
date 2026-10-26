export const rampProgressStatements = [
  "ALTER TABLE ramp_orders ADD COLUMN IF NOT EXISTS provider_observation JSONB",
  "ALTER TABLE ramp_orders ADD COLUMN IF NOT EXISTS launch_issued_at TIMESTAMPTZ",
];
