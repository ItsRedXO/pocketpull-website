-- Add reward type support to promo codes so a code can either credit
-- cash (existing behaviour, reward_type='cash') or grant a free open of
-- a specific social pack (reward_type='social_pack', reward_pack_id set).
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS reward_type text NOT NULL DEFAULT 'cash';
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS reward_pack_id text REFERENCES packs_catalog(id);
