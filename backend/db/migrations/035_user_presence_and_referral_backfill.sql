-- Presence tracking for the admin panel's online/afk/offline status dots.
-- last_seen_at: updated on every heartbeat while a logged-in user's tab is
--   open and visible (whether or not they're actively doing anything) --
--   used to tell "tab open" from "tab closed".
-- last_active_at: updated only alongside a heartbeat that also reports a
--   real interaction (click/keydown/scroll/touch) since the previous one --
--   used to tell "actively using it" from "left the tab open, AFK".
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Backfill: referral codes have only ever been generated for accounts
-- created through the current Supabase-auth signup route. Every account
-- imported from the legacy Blink backend (i.e. most existing users) never
-- had one generated in the first place, so their referral code shows up
-- blank in the admin panel. One-time backfill, safe to run repeatedly --
-- only touches rows that are still missing a code.
UPDATE users
SET referral_code = UPPER(SUBSTRING(MD5(id || random()::text) FROM 1 FOR 8))
WHERE referral_code IS NULL OR referral_code = '';
