CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_idempotency ON wallet_transactions(user_id,type,source_id) WHERE source_id IS NOT NULL;
