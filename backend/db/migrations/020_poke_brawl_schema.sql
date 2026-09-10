-- Poke Brawl: persistent team-management mini-game.
-- All tables are prefixed brawl_ to avoid any collision with the existing
-- pack-opening "battles" feature (backend/routes/battles). Poke Brawl's
-- currency (brawl_wallets.balance, "pokedollars") is intentionally isolated
-- from the real-money wallet in users.balance / wallet_transactions and is
-- never convertible to or from it.

CREATE TABLE IF NOT EXISTS brawl_pokemon_species (
  id integer PRIMARY KEY, -- PokeAPI national dex id
  name text NOT NULL,
  primary_type text NOT NULL,
  secondary_type text,
  base_hp integer NOT NULL,
  base_attack integer NOT NULL,
  base_defense integer NOT NULL,
  base_sp_attack integer NOT NULL,
  base_sp_defense integer NOT NULL,
  base_speed integer NOT NULL,
  overall_rating integer NOT NULL,
  evolution_stage smallint NOT NULL DEFAULT 1,
  evolution_chain_id integer NOT NULL,
  is_legendary integer NOT NULL DEFAULT 0,
  is_mythical integer NOT NULL DEFAULT 0,
  sprite_url text,
  artwork_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brawl_species_overall ON brawl_pokemon_species(overall_rating);
CREATE INDEX IF NOT EXISTS idx_brawl_species_evolution_chain ON brawl_pokemon_species(evolution_chain_id);

CREATE TABLE IF NOT EXISTS brawl_wallets (
  user_id text PRIMARY KEY REFERENCES users(id),
  balance bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brawl_wallet_transactions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  type text NOT NULL,
  amount bigint NOT NULL,
  balance_before bigint NOT NULL,
  balance_after bigint NOT NULL,
  source_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brawl_wallet_txn_user ON brawl_wallet_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS brawl_profiles (
  user_id text PRIMARY KEY REFERENCES users(id),
  has_completed_intro integer NOT NULL DEFAULT 0,
  league text NOT NULL DEFAULT 'standard',
  league_rating integer NOT NULL DEFAULT 1000,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  local_battles_played integer NOT NULL DEFAULT 0,
  local_tournament_wins integer NOT NULL DEFAULT 0,
  state_tournament_wins integer NOT NULL DEFAULT 0,
  regional_tournament_wins integer NOT NULL DEFAULT 0,
  elite_four_wins integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brawl_pokemon_instances (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  species_id integer NOT NULL REFERENCES brawl_pokemon_species(id),
  nickname text,
  source text NOT NULL, -- starter | safari | shop
  is_on_team integer NOT NULL DEFAULT 0,
  team_slot smallint,
  acquired_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brawl_instances_user ON brawl_pokemon_instances(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brawl_instances_team_slot ON brawl_pokemon_instances(user_id, team_slot) WHERE team_slot IS NOT NULL;

-- One run = one entry into a tier (local_battle | local_tournament | state_tournament
-- | regional_tournament | elite_four). A run has 1..N matches depending on tier.
-- The 250/day cap and per-tier cooldowns are both evaluated off this table, and each
-- run counts as exactly 1 toward the daily cap regardless of how many matches it holds.
CREATE TABLE IF NOT EXISTS brawl_battle_runs (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  tier text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress', -- in_progress | won | eliminated
  entry_cost integer NOT NULL DEFAULT 0,
  total_reward integer NOT NULL DEFAULT 0,
  matches_won smallint NOT NULL DEFAULT 0,
  matches_total smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_brawl_runs_user_created ON brawl_battle_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brawl_runs_user_tier_created ON brawl_battle_runs(user_id, tier, created_at DESC);

CREATE TABLE IF NOT EXISTS brawl_battle_matches (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES brawl_battle_runs(id) ON DELETE CASCADE,
  match_index smallint NOT NULL,
  opponent_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text, -- win | loss, null while in progress
  battle_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, match_index)
);

CREATE TABLE IF NOT EXISTS brawl_safari_pulls (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  tier smallint NOT NULL,
  cost integer NOT NULL,
  species_ids integer[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brawl_safari_pulls_user ON brawl_safari_pulls(user_id, created_at DESC);
