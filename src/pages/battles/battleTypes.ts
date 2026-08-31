// ─── Battle Types ──────────────────────────────────────────────────────────

export type BattleMode = 'standard' | 'underdog' | 'shared';
export type BattleTeamSide = 'left' | 'right';
export type BattleStatus = 'waiting' | 'starting' | 'live' | 'finished' | 'canceled';
export type Visibility = 'public' | 'private';

export interface BattlePack {
  id: string;
  name: string;
  emoji: string;
  price: number;
  rarity: string;
  borderColor: string;
  glowColor: string;
}

export interface BattlePlayer {
  id: string;
  battleId: string;
  userId: string;
  username: string;
  avatar: string;
  isAi: boolean;
  cardsJson: string;
  totalValue: number;
  isWinner: boolean;
  joinedAt: string;
  teamSide?: BattleTeamSide | null;
}

export interface Battle {
  id: string;
  hostUserId: string;
  hostUsername: string;
  hostAvatar: string;
  mode: BattleMode;
  playerCount: number;
  isPublic: boolean;
  status: BattleStatus;
  packsJson: string;
  totalCost: number;
  privateCode: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  winnerUserId: string | null;
  winnerUsername: string | null;
  currentRound: number;
  isSpinning: boolean;
  isSimulated?: boolean;
  players?: BattlePlayer[];
  teamMode?: boolean;
}

export interface BattleWithPlayers extends Battle {
  players: BattlePlayer[];
}

export interface OpenedCard {
  id: string;
  name: string;
  emoji: string;
  rarity: string;
  value: number;
  packId: string;
  packName: string;
  imageUrl?: string;
}

export interface PlayerBattleResult {
  playerId: string;
  teamSide?: BattleTeamSide | null;
  userId: string;
  username: string;
  avatar: string;
  isAi: boolean;
  cards: OpenedCard[];
  totalValue: number;
  isWinner: boolean;
}

// ─── Battle Step (single source of truth for animation state) ───────────────
// Every valid state in the pack-battle animation flow.
// Replaces the old separate phase / currentRound / isRoundSpinning / revealIndex.
export type BattleStep =
  | { type: 'idle' }
  | { type: 'countdown'; countdown: number }
  | { type: 'loading' }                              // backend call in progress
  | { type: 'spinning'; round: number }              // spinner animating
  | { type: 'settled'; round: number; landing: boolean } // post-spin lock (landing=true) or pre-spin reset (landing=false)
  | { type: 'revealed'; round: number }              // cards visible, totals updated
  | { type: 'winner'; winner: PlayerBattleResult | null };

export const IDLE_STEP: BattleStep = { type: 'idle' };

// ─── Legacy Phase (derived from BattleStep for BattleRoom rendering) ────────
export type Phase = 'lobby' | 'countdown' | 'opening' | 'results';
