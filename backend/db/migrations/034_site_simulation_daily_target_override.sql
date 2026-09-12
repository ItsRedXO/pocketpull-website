-- Lets an admin see (and optionally pin) the specific number a daily counter
-- will land on today, instead of every day climbing to the same fixed max.
-- Without an override, the day's target is picked pseudo-randomly (seeded by
-- metric + Pacific calendar date, so it's stable across the whole day and
-- the same for every visitor) somewhere inside [min,max] -- see
-- backend/repositories/siteSettings.ts. override_day is a plain 'YYYY-MM-DD'
-- text (Pacific calendar date), not a SQL date type, so comparisons never
-- need timezone-aware date parsing; an override only applies while
-- override_day matches *today's* Pacific date, so it naturally stops
-- applying once the day rolls over instead of needing a cleanup job.
ALTER TABLE site_simulation_settings
  ADD COLUMN IF NOT EXISTS packs_opened_override_day text,
  ADD COLUMN IF NOT EXISTS packs_opened_override_value integer,
  ADD COLUMN IF NOT EXISTS cards_won_override_day text,
  ADD COLUMN IF NOT EXISTS cards_won_override_value integer;
