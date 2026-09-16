-- Promo codes players redeem in Profile > Codes for a credits reward, plus
-- an admin-editable settings row for the two other standing "deals" (first
-- deposit match, referral bonus) that used to be hardcoded in
-- backend/lib/payments.ts.

CREATE TABLE IF NOT EXISTS promo_codes (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  description text,
  reward_amount numeric(18,2) NOT NULL,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  is_active integer NOT NULL DEFAULT 1,
  expires_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);

-- One row per user per code -- both blocks a user from redeeming the same
-- code twice and gives promo_codes.use_count a source of truth to reconcile
-- against (use_count is still what the redeem transaction checks against
-- max_uses under a row lock, since this table alone can't do that check
-- atomically under concurrent redemptions).
CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id text PRIMARY KEY,
  code_id text NOT NULL REFERENCES promo_codes(id),
  user_id text NOT NULL REFERENCES users(id),
  amount numeric(18,2) NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_code_redemptions(user_id);

-- Singleton row, same pattern as site_simulation_settings.
CREATE TABLE IF NOT EXISTS deal_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  deposit_match_percent numeric(6,2) NOT NULL DEFAULT 100,
  deposit_match_cap numeric(18,2) NOT NULL DEFAULT 100,
  referral_reward_amount numeric(18,2) NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_settings_single_row CHECK (id = 1)
);
INSERT INTO deal_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
