export const rampLeaseStatements = [
  "ALTER TABLE ramp_reconciliation_jobs ADD COLUMN IF NOT EXISTS lease_token UUID",
];
