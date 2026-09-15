-- Total challenges a player has ever claimed. brawl_challenge_state only
-- ever tracked the single most-recent completion (last_completed) needed for
-- the Challenges tab's toast, with no running total -- the Trainer Profile
-- modal's "Challenges Completed" stat was hardcoded to 0 pending this.
ALTER TABLE brawl_challenge_state ADD COLUMN IF NOT EXISTS completed_count integer NOT NULL DEFAULT 0;
