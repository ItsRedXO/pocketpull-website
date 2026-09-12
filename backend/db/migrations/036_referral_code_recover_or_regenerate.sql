-- Re-run of the 035 referral code backfill, still idempotent (only touches
-- rows currently blank), for two reasons:
-- 1. Recover a legacy code from the data jsonb blob first, in case it landed
--    there instead of the dedicated referral_code column for some imported
--    accounts, rather than immediately overwriting with a new one.
-- 2. Switch the generated fallback from 8 hex characters to 5, matching what
--    admins are meant to hand out/read now.
-- Correlated on id (not a bare random()) so Postgres evaluates a fresh code
-- per row instead of computing one value and reusing it for every match.
UPDATE users
SET referral_code = COALESCE(
  NULLIF(data->>'referralCode', ''),
  NULLIF(data->>'referral_code', ''),
  UPPER(SUBSTRING(MD5(id || random()::text || clock_timestamp()::text) FROM 1 FOR 5))
)
WHERE referral_code IS NULL OR referral_code = '';
