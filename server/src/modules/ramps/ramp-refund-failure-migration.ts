export const rampRefundFailureStatements = [
  "ALTER TABLE ramp_orders DROP CONSTRAINT IF EXISTS ramp_orders_provider_state_check",
  "ALTER TABLE ramp_orders ADD CONSTRAINT ramp_orders_provider_state_check CHECK(provider_state IN ('created','awaiting_user','processing','ready_for_pickup','completed','failed','cancelled','refund_pending','refunded','refund_failed','unknown'))",
];
