-- Final compatibility migration for fields used by current routes.
ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS fulfilled_card_ids JSONB NOT NULL DEFAULT '[]'::jsonb; ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS tracking_number TEXT; ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
