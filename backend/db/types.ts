export type DbId = string;

export interface UserRow {
  id: DbId;
  email: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  xp: number;
  level: number;
  balance: string;
  email_verified: boolean;
  role: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  last_sign_in: string | null;
  password_hash: string | null;
  phone: string | null;
  phone_verified: boolean;
  is_banned: boolean;
  is_bot: boolean;
  referral_code: string | null;
  referred_by_id: DbId | null;
  referral_reward_paid: boolean;
  verified_at: string | null;
  verification_method: string | null;
  is_deleted: boolean;
  referral_code_used: string | null;
  first_deposit_bonus_paid: boolean;
  matched_balance: string;
}

export interface WalletTransactionRow {
  id: DbId;
  user_id: DbId;
  type: string;
  amount: string;
  balance_before: string;
  balance_after: string;
  matched_before: string;
  matched_after: string;
  source_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface PackRow {
  id: DbId;
  name: string;
  price: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  pack_type: string | null;
}

export interface PackCardRow {
  id: DbId;
  pack_id: DbId;
  card_name: string;
  rarity: string | null;
  pull_chance: string | null;
  estimated_value: string | null;
  card_image_url: string | null;
  sort_order: number | null;
  quantity: number | null;
  original_quantity: number | null;
}

export interface InventoryRow {
  id: DbId;
  user_id: DbId;
  card_id: DbId | null;
  card_name: string;
  rarity: string | null;
  value: string;
  emoji: string | null;
  is_favorite: boolean;
  created_at: string;
  card_image_url: string | null;
  pack_name: string | null;
  is_locked: boolean;
  battle_id: DbId | null;
}
