-- Tracks the last time each trainer claimed the Poke Brawl daily pokedollar
-- bonus, so the 24h cooldown is enforced server-side (client only reflects it).
-- Nullable: never claimed yet = eligible immediately.
ALTER TABLE brawl_profiles ADD COLUMN IF NOT EXISTS daily_bonus_claimed_at timestamptz;
