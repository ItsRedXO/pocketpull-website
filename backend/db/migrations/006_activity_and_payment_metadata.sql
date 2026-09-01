ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE outbound_emails ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS provider_id text;
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_type_created ON activity_logs(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);
