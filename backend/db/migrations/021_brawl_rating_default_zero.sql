-- Poke Brawl global rating now starts new trainers at 0, not 1000. Only
-- changes the default for rows created from here on; existing rows are
-- untouched by this migration (nobody but the one test account had a row
-- at the time this shipped, and that one was reset separately, by hand).
ALTER TABLE brawl_profiles ALTER COLUMN league_rating SET DEFAULT 0;
