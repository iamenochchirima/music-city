export const poolStatements=[
 `CREATE TABLE pool_orders (contract_id TEXT NOT NULL, id TEXT NOT NULL, payload JSONB NOT NULL, PRIMARY KEY(contract_id,id), CHECK(payload->>'id'=id AND payload->>'contractId'=contract_id))`,
 `CREATE TABLE pool_attempts (id TEXT PRIMARY KEY,contract_id TEXT NOT NULL,source_address TEXT NOT NULL,transaction_hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL,payload JSONB NOT NULL,checked_at TIMESTAMPTZ, CHECK(payload->>'id'=id AND payload->>'poolContractId'=contract_id AND payload->>'transactionHash'=transaction_hash AND payload->>'status'=status))`,
 `CREATE UNIQUE INDEX pool_one_active_wallet ON pool_attempts(source_address) WHERE status IN ('awaiting_signatures','submitting','submitted')`,
 `CREATE TABLE pool_events (contract_id TEXT NOT NULL,event_id TEXT NOT NULL,transaction_hash TEXT NOT NULL,ledger INTEGER NOT NULL,payload JSONB NOT NULL,PRIMARY KEY(contract_id,event_id))`,
 `CREATE TABLE pool_cursors (contract_id TEXT PRIMARY KEY,cursor TEXT NOT NULL,caught_up BOOLEAN NOT NULL DEFAULT FALSE,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
 ...["pool_orders","pool_attempts"].map(table=>`CREATE TRIGGER ${table}_retained BEFORE DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION protect_settlement_evidence()`),
 `CREATE TRIGGER pool_events_immutable BEFORE UPDATE OR DELETE ON pool_events FOR EACH ROW EXECUTE FUNCTION protect_settlement_evidence()`,
 `CREATE FUNCTION protect_pool_attempt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.contract_id IS DISTINCT FROM OLD.contract_id OR NEW.source_address IS DISTINCT FROM OLD.source_address OR NEW.transaction_hash IS DISTINCT FROM OLD.transaction_hash OR
 (NEW.payload - ARRAY['status','signatures','signedBy','updatedAt','ledger','feeCharged','error','submissionCount','lastSubmittedAt']) IS DISTINCT FROM (OLD.payload - ARRAY['status','signatures','signedBy','updatedAt','ledger','feeCharged','error','submissionCount','lastSubmittedAt']) THEN RAISE EXCEPTION 'Pool signing context is immutable'; END IF;
 IF OLD.status IN ('confirmed','failed','expired') AND NEW.payload IS DISTINCT FROM OLD.payload THEN RAISE EXCEPTION 'Terminal pool evidence is immutable'; END IF; RETURN NEW; END $$`,
 `CREATE TRIGGER pool_attempt_immutable BEFORE UPDATE ON pool_attempts FOR EACH ROW EXECUTE FUNCTION protect_pool_attempt()`,
 `CREATE FUNCTION protect_pool_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NEW.payload-'claims') IS DISTINCT FROM (OLD.payload-'claims') OR jsonb_array_length(NEW.payload->'claims')<>jsonb_array_length(OLD.payload->'claims') OR EXISTS (
 SELECT 1 FROM jsonb_array_elements(NEW.payload->'claims') WITH ORDINALITY n(value,i) JOIN jsonb_array_elements(OLD.payload->'claims') WITH ORDINALITY o(value,i) USING(i)
 WHERE (n.value-ARRAY['claimed','ledger']) IS DISTINCT FROM (o.value-ARRAY['claimed','ledger']) OR (o.value->>'claimed'='true' AND n.value IS DISTINCT FROM o.value)) THEN RAISE EXCEPTION 'Pool purchase terms and consumed claims are immutable'; END IF; RETURN NEW; END $$`,
 `CREATE TRIGGER pool_order_immutable BEFORE UPDATE ON pool_orders FOR EACH ROW EXECUTE FUNCTION protect_pool_order()`,
];

export const poolSignatureStatements=[
 `CREATE TABLE pool_signature_approvals (
   attempt_id TEXT NOT NULL REFERENCES pool_attempts(id), signer_wallet TEXT NOT NULL,
   actor TEXT NOT NULL, actor_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   PRIMARY KEY(attempt_id,signer_wallet)
 )`,
 `CREATE TRIGGER pool_signature_approvals_immutable BEFORE UPDATE OR DELETE ON pool_signature_approvals FOR EACH ROW EXECUTE FUNCTION protect_settlement_evidence()`,
];
