-- PocketPull PostgreSQL migration 004

CREATE TABLE IF NOT EXISTS battles (
  id TEXT PRIMARY KEY,
  host_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  host_username TEXT,
  host_avatar TEXT,
  mode TEXT NOT NULL DEFAULT 'standard',
  player_count INTEGER NOT NULL DEFAULT 2,
  team_mode INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting',
  packs_json TEXT NOT NULL DEFAULT '[]',
  total_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  private_code TEXT,
  player_count_current INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  is_spinning INTEGER NOT NULL DEFAULT 0,
  winner_user_id TEXT,
  winner_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_battles_status_public_created ON battles(status, is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_battles_host ON battles(host_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_battles_private_code ON battles(private_code) WHERE private_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS battle_players (
  id TEXT PRIMARY KEY,
  battle_id TEXT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  username TEXT,
  avatar TEXT,
  is_ai INTEGER NOT NULL DEFAULT 0,
  team_side TEXT,
  cards_json TEXT NOT NULL DEFAULT '[]',
  total_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_winner INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(battle_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_battle_players_battle ON battle_players(battle_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_battle_players_user ON battle_players(user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS battle_pull_audits (
  id TEXT PRIMARY KEY,
  battle_id TEXT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  battle_player_id TEXT NOT NULL REFERENCES battle_players(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  pack_id TEXT NOT NULL REFERENCES packs_catalog(id) ON DELETE RESTRICT,
  pack_name TEXT,
  card_name TEXT,
  rarity TEXT,
  cost NUMERIC(18,2) NOT NULL DEFAULT 0,
  client_seed TEXT NOT NULL,
  nonce BIGINT NOT NULL,
  roll_value NUMERIC(20,12) NOT NULL,
  server_seed_hash TEXT NOT NULL,
  odds_version_hash TEXT,
  is_bot INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_battle_pull_audits_battle ON battle_pull_audits(battle_id, created_at);
CREATE INDEX IF NOT EXISTS idx_battle_pull_audits_user ON battle_pull_audits(user_id, created_at DESC);
