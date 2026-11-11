export const adminWalletStatements=[
 `CREATE TABLE admin_wallet_requests (
 id TEXT PRIMARY KEY,admin_id TEXT NOT NULL REFERENCES admins(id),kind TEXT NOT NULL CHECK(kind IN ('link','sign')),attempt_id TEXT REFERENCES pool_attempts(id),
 token_hash TEXT NOT NULL,network_passphrase TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,
 wallet_address TEXT,transaction TEXT,signed_transaction TEXT,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','challenged','signed','completed','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),completed_at TIMESTAMPTZ
 )`,
 `CREATE TABLE admin_wallet_links (admin_id TEXT PRIMARY KEY REFERENCES admins(id),wallet_address TEXT NOT NULL UNIQUE,network_passphrase TEXT NOT NULL,challenge_id TEXT NOT NULL UNIQUE REFERENCES admin_wallet_requests(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
 `CREATE TRIGGER admin_wallet_links_immutable BEFORE UPDATE OR DELETE ON admin_wallet_links FOR EACH ROW EXECUTE FUNCTION protect_settlement_evidence()`,
 `CREATE TRIGGER admin_wallet_requests_retained BEFORE DELETE ON admin_wallet_requests FOR EACH ROW EXECUTE FUNCTION protect_settlement_evidence()`,
 `CREATE FUNCTION protect_admin_wallet_request() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.admin_id IS DISTINCT FROM OLD.admin_id OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.attempt_id IS DISTINCT FROM OLD.attempt_id OR NEW.token_hash IS DISTINCT FROM OLD.token_hash OR NEW.network_passphrase IS DISTINCT FROM OLD.network_passphrase OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
 (OLD.wallet_address IS NOT NULL AND NEW.wallet_address IS DISTINCT FROM OLD.wallet_address) OR (OLD.transaction IS NOT NULL AND NEW.transaction IS DISTINCT FROM OLD.transaction) OR (OLD.signed_transaction IS NOT NULL AND NEW.signed_transaction IS DISTINCT FROM OLD.signed_transaction) OR
 (OLD.status IN ('completed','cancelled') AND NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'Admin wallet challenge and proof are immutable'; END IF; RETURN NEW; END $$`,
 `CREATE TRIGGER admin_wallet_request_integrity BEFORE UPDATE ON admin_wallet_requests FOR EACH ROW EXECUTE FUNCTION protect_admin_wallet_request()`,
];
