export const rampDeliveryStatements = [
  "CREATE UNIQUE INDEX IF NOT EXISTS ramp_unique_incoming_payment ON ramp_events(event_key) WHERE source='chain' AND kind='incoming_delivery_confirmed'",
];
