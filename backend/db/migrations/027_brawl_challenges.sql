-- Poke Brawl Challenges: pick-1-of-3 objectives on a 15 minute cooldown.
-- `offered` holds the 3 candidates while the player hasn't picked one yet
-- (empty once a challenge is locked in). `selected` is the locked-in
-- challenge (null while browsing offers or on cooldown). `next_available_at`
-- gates when a fresh set of 3 offers can be generated after a completion.
CREATE TABLE IF NOT EXISTS brawl_challenge_state (
  user_id text PRIMARY KEY REFERENCES users(id),
  offered jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected jsonb,
  progress integer NOT NULL DEFAULT 0,
  next_available_at timestamptz,
  last_completed jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
