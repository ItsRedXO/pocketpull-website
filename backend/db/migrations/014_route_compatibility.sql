ALTER TABLE inventory ADD COLUMN IF NOT EXISTS battle_id text;
ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS fulfilled_card_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS processed_at timestamptz;
ALTER TABLE outbound_emails ADD COLUMN IF NOT EXISTS from_address text;
ALTER TABLE outbound_emails ADD COLUMN IF NOT EXISTS reply_to text;
CREATE INDEX IF NOT EXISTS idx_inventory_battle_id ON inventory(battle_id) WHERE battle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cashout_requests_confirmation ON cashout_requests(confirmation_number);
