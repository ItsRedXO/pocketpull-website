ALTER TABLE battles ADD COLUMN IF NOT EXISTS host_username text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS host_avatar text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS player_count integer NOT NULL DEFAULT 2;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS team_mode integer NOT NULL DEFAULT 0;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS packs_json text NOT NULL DEFAULT '[]';
ALTER TABLE battles ADD COLUMN IF NOT EXISTS total_cost numeric(18,6) NOT NULL DEFAULT 0;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS private_code text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS battle_seed text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS current_step integer NOT NULL DEFAULT 0;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS winner_username text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS winner_value numeric(18,6);

CREATE TABLE IF NOT EXISTS battle_players (
  id text PRIMARY KEY,
  battle_id text NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id),
  username text,
  avatar text,
  is_ai integer NOT NULL DEFAULT 0,
  ai_name text,
  team_side text,
  cards_json text NOT NULL DEFAULT '[]',
  total_value numeric(18,6) NOT NULL DEFAULT 0,
  is_winner integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(battle_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_battle_players_battle ON battle_players(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_players_user ON battle_players(user_id);
CREATE INDEX IF NOT EXISTS idx_battles_private_code ON battles(private_code);
