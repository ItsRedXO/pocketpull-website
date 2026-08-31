export interface OpenedCard {
  name: string;
  rarity: string;
  value: number;
  imageUrl: string | null;
  packId: string;
  packName: string;
  // Provably fair verification fields (added for Pack Battle audit trail).
  // Backward-compatible: old battle cardsJson rows won't have these keys,
  // and the frontend ignores unknown JSON keys — no migration needed.
  clientSeed?: string;
  nonce?: number;
  rollValue?: number;
  serverSeedHash?: string;
  oddsVersionHash?: string;
  isBot?: boolean;
}

/** Per-pull audit row stored in battle_pull_audits. */
export interface BattlePullAudit {
  id: string;
  battleId: string;
  battlePlayerId: string;
  userId: string;
  packId: string;
  packName: string;
  cardName: string;
  rarity: string;
  cost: number;
  clientSeed: string;
  nonce: number;
  rollValue: number;
  serverSeedHash: string;
  oddsVersionHash: string;
  isBot: number;
}
