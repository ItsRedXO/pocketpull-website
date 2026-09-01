ALTER TABLE user_nonces ADD COLUMN IF NOT EXISTS pack_nonce bigint;
UPDATE user_nonces SET pack_nonce = nonce WHERE pack_nonce IS NULL;
ALTER TABLE user_nonces ALTER COLUMN pack_nonce SET DEFAULT 0;
