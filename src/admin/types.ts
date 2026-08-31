export interface UserRow {
  id: string;
  email: string;
  username: string;
  displayName: string;
  balance: number;
  matchedBalance: number;
  createdAt: string;
  isBanned: boolean;
  emailVerified: boolean;
  verifiedAt: string | null;
  verificationMethod: string | null;
  isDeleted: boolean;
  referredById: string | null;
  referralCodeUsed: string | null;
  referrerUsername: string | null;
  referralRewardPaid: boolean;
  role: string;
  avatarUrl: string | null;
}

export interface InventoryRow {
  id: string;
  userId: string;
  cardName: string;
  rarity: string;
  value: number;
  createdAt: string;
  cardImageUrl: string | null;
  packName: string | null;
}

export type FilterTab = 'active' | 'banned' | 'deleted';

export const RARITY_COLOR: Record<string, string> = {
  common: '#8892a4',
  uncommon: '#10b981',
  rare: '#00c8ff',
  ultra: '#9b5cff',
  secret: '#ffd700',
  god: '#ff00ff',
};

export const RARITY_LABEL: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  ultra: 'Ultra Rare',
  secret: 'Secret Rare',
  god: 'GOD PULL',
};
