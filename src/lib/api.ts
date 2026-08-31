/**
 * Secure API Client — all economy operations go through the backend.
 * Frontend never directly writes balances, inventory, or transaction records.
 */
import { blink } from './blink';

// Backend URL — derived from blink.functions.invoke base
const BACKEND_BASE = 'https://b2nnhe2n.backend.blink.new';

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const token = await blink.auth.getValidToken();
    if (token) {
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
    }
  } catch { /* no token */ }
  return { 'Content-Type': 'application/json' };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_BASE}${path}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data?.error || `API error ${res.status}`);
  }
  return data as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data?.error || `API error ${res.status}`);
  }
  return data as T;
}

// ──────────────────────────────────────────────────────────────
// Pack Opening
// ──────────────────────────────────────────────────────────────
export interface OpenPackResult {
  success: boolean;
  card: {
    name: string;
    rarity: string;
    value: number;
    emoji: string;
    imageUrl: string | null;
  };
  inventoryId: string;
  newBalance: number;
}

export const openPack = (packId: string) =>
  post<OpenPackResult>('/open-pack', { packId });

// ──────────────────────────────────────────────────────────────
// Upgrader
// ──────────────────────────────────────────────────────────────
export interface UpgraderSpinResult {
  success: boolean;
  isWin: boolean;
  winChance: number;
  wonCards: Array<{
    id: string;
    cardId: string;
    name: string;
    rarity: string;
    value: number;
    emoji: string;
    cardImageUrl: string | null;
  }>;
  newBalance: number;
  removedCardIds: string[];
}

export const upgraderSpin = (params: {
  inventoryIds: string[];
  targetCardIds: string[];
  useBalance: boolean;
  addedBalance: number;
  multiplier: number;
}) => post<UpgraderSpinResult>('/upgrader/spin', params);

// ──────────────────────────────────────────────────────────────
// Exchanger
// ──────────────────────────────────────────────────────────────
export interface ExchangeResult {
  success: boolean;
  removedCardIds: string[];
  addedCards: Array<{
    id: string;
    cardId: string;
    cardName: string;
    rarity: string;
    value: number;
    emoji: string;
    cardImageUrl: string | null;
    isLocked: boolean;
  }>;
  refund: number;
  newBalance: number;
}

export const exchangeTrade = (params: {
  offerInventoryIds: string[];
  receivePackCardIds: string[];
}) => post<ExchangeResult>('/exchanger/trade', params);

// ──────────────────────────────────────────────────────────────
// Battles
// ──────────────────────────────────────────────────────────────
export interface CreateBattleResult {
  success: boolean;
  battleId: string;
  privateCode: string | null;
  newBalance: number;
}

export const createBattle = (params: {
  selectedPackIds: string[];
  mode: string;
  playerCount: number;
  isPublic: boolean;
  teamMode?: boolean;
}) => post<CreateBattleResult>('/battles/create', params);

export interface BattleStateResult {
  success: boolean;
  battle: any;
  players: any[];
  packCards: any[];
}

export const fetchBattleStateAPI = (battleId: string) =>
  get<BattleStateResult>(`/battles/state?battleId=${encodeURIComponent(battleId)}`);

export interface JoinBattleResult {
  success: boolean;
  alreadyJoined?: boolean;
  newBalance: number;
}

export const joinBattle = (battleId: string, teamSide?: 'left' | 'right') =>
  post<JoinBattleResult>('/battles/join', { battleId, teamSide });

export const resolvePrivateBattleCode = (privateCode: string) =>
  post<{ success: boolean; battleId: string; privateCode: string }>('/battles/resolve-code', { privateCode });

export const cancelBattle = (battleId: string) =>
  post<{ success: boolean; newBalance: number }>('/battles/cancel', { battleId });

export const addAIOpponent = (battleId: string, aiName?: string) =>
  post<{ success: boolean; aiName: string }>('/battles/add-ai', { battleId, aiName });

export const startBattleCountdown = (battleId: string) =>
  post<{ success: boolean; alreadyStarted?: boolean }>('/battles/start-countdown', { battleId });

export interface ExecuteBattleResult {
  success: boolean;
  playerResults: any[];
  winner: any;
  isDraw?: boolean;
}

export const executeBattle = (battleId: string) =>
  post<ExecuteBattleResult>('/battles/execute', { battleId });

export const adminCancelBattle = (battleId: string) =>
  post<{ success: boolean; refundedPlayers: number; totalRefunded: number }>('/battles/admin/cancel', { battleId });

// ──────────────────────────────────────────────────────────────
// Cashout
// ──────────────────────────────────────────────────────────────
export interface CashoutResult {
  success: boolean;
  confirmationNumber: string;
  totalValue: number;
  totalCards: number;
  removedCardIds: string[];
}

export const submitCashout = (params: {
  inventoryIds: string[];
  shipping: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    email: string;
    phone: string;
  };
  idImageUrl: string;
}) => post<CashoutResult>('/cashout/submit', params);

// ──────────────────────────────────────────────────────────────
// Inventory
// ──────────────────────────────────────────────────────────────
export const lockCard = (inventoryId: string, isLocked: boolean) =>
  post<{ success: boolean; inventoryId: string; isLocked: boolean }>(
    '/inventory/lock',
    { inventoryId, isLocked }
  );

export const favoriteCard = (inventoryId: string, isFavorite: boolean) =>
  post<{ success: boolean; inventoryId: string; isFavorite: boolean }>(
    '/inventory/favorite',
    { inventoryId, isFavorite }
  );

export const sellCard = (inventoryId: string) =>
  post<{ success: boolean; newBalance: number; soldCardId: string; cardValue: number }>(
    '/inventory/sell',
    { inventoryId }
  );

export const sellAllCards = () =>
  post<{ success: boolean; newBalance: number; soldCardIds: string[]; totalValue: number; count: number }>(
    '/inventory/sell-all',
    {}
  );

// ──────────────────────────────────────────────────────────────
// Referrals
// ──────────────────────────────────────────────────────────────
export interface ReferralData {
  id: string;
  username: string;
  email: string;
  status: 'Reward Paid' | 'Deposit Pending' | 'Signed Up';
  deposited: boolean;
  createdAt: string;
}

export interface FetchReferralsResult {
  data: ReferralData[];
  total: number;
  page: number;
  totalPages: number;
}

export const fetchReferrals = async (page: number = 1) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_BASE}/referrals?page=${page}`, {
    method: 'GET',
    headers,
  });
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data?.error || `API error ${res.status}`);
  }
  return data as FetchReferralsResult;
};

// ── Provably Fair ───────────────────────────────────────────────────────

export interface ProvablyFairOpening {
  id: string;
  packName: string;
  cardName: string;
  rarity: string;
  cost: number;
  createdAt: string;
  serverSeedHash: string;
  oddsVersionHash: string;
}

export interface ProvablyFairVerifyData {
  id: string;
  packName: string;
  cardName: string;
  rarity: string;
  cost: number;
  createdAt: string;
  clientSeed: string;
  nonce: number;
  rollValue: number;
  serverSeedHash: string;
  oddsVersionHash: string;
  isRevealed: boolean;
  revealedSeed?: string;
  verified?: boolean;
  recomputedRoll?: number;
}

export interface SeedHistoryEntry {
  seedHash: string;
  revealedSeed: string;
  periodStart: string;
  periodEnd: string;
  revealedAt: string;
}

export interface SeedHistoryResult {
  active: { seedHash: string; activeSince: string } | null;
  past: SeedHistoryEntry[];
}

export const fetchProvablyFairOpenings = async () => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_BASE}/provably-fair/my-openings`, { method: 'GET', headers });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as { openings: ProvablyFairOpening[] };
};

export const fetchProvablyFairVerify = async (openingId: string) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_BASE}/provably-fair/verify/${encodeURIComponent(openingId)}`, { method: 'GET', headers });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as ProvablyFairVerifyData;
};

export const fetchProvablyFairSeedHistory = async () => {
  const res = await fetch(`${BACKEND_BASE}/provably-fair/seed-history`, { method: 'GET' });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as SeedHistoryResult;
};

// ── Provably Fair Upgrader ────────────────────────────────────────────────

export interface ProvablyFairUpgrade {
  id: string;
  multiplier: number;
  totalInputValue: number;
  balanceUsed: number;
  totalTargetValue: number;
  winChance: number;
  isWin: boolean;
  serverSeedHash: string;
  oddsVersionHash: string;
  createdAt: string;
  provablyFair: boolean;
}

export interface ProvablyFairVerifyUpgradeData {
  id: string;
  multiplier: number;
  totalInputValue: number;
  balanceUsed: number;
  baselineTargetValue: number;
  totalTargetValue: number;
  winChance: number;
  isWin: boolean;
  clientSeed: string;
  nonce: number;
  rollValue: number;
  serverSeedHash: string;
  oddsVersionHash: string;
  wonCardsJson: string;
  removedCardIdsJson: string;
  createdAt: string;
  isRevealed: boolean;
  revealedSeed?: string;
  verified?: boolean;
  recomputedRoll?: number;
  isLegacy?: boolean;
  message?: string;
}

export const fetchProvablyFairUpgrades = async () => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_BASE}/provably-fair/my-upgrades`, { method: 'GET', headers });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as { spins: ProvablyFairUpgrade[] };
};

export const fetchProvablyFairVerifyUpgrade = async (spinId: string) => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_BASE}/provably-fair/verify-upgrade/${encodeURIComponent(spinId)}`, { method: 'GET', headers });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as ProvablyFairVerifyUpgradeData;
};

// ── Admin ────────────────────────────────────────────────────────────────

async function getAdminHeaders(): Promise<Record<string, string>> {
  const pass = localStorage.getItem('pocketpull_admin_pass') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Try Blink Auth Bearer token first (works for role='admin' users)
  try {
    const token = await blink.auth.getValidToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch { /* no token — fall through to admin secret */ }

  // Admin secret as fallback/supplement (dedicated admin_credentials table)
  if (pass) headers['X-Admin-Secret'] = pass;

  return headers;
}

export interface AdminSeedStatus {
  active: { id: string; seedHash: string; periodStart: string } | null;
  pending: { id: string; seedHash: string; periodStart: string } | null;
  past: Array<{
    id: string;
    seedHash: string;
    periodStart: string;
    periodEnd: string;
    revealedAt: string;
    revealedSeed: string;
  }>;
}

export interface GenerateSeedResult {
  success: boolean;
  message: string;
  seedHash: string;
  seed?: string;
  alreadyPending?: boolean;
}

export interface CompleteRotationResult {
  success: boolean;
  message: string;
  oldSeedHash: string;
  newSeedHash: string;
  newSeed?: string;
}

export const fetchAdminSeedStatus = async () => {
  const headers = await getAdminHeaders();
  const res = await fetch(`${BACKEND_BASE}/admin/provably-fair/status`, {
    method: 'GET',
    headers,
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as AdminSeedStatus;
};

export const adminGenerateSeed = async () => {
  const headers = await getAdminHeaders();
  const res = await fetch(`${BACKEND_BASE}/admin/provably-fair/generate-seed`, {
    method: 'POST',
    headers,
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as GenerateSeedResult;
};

export const adminCompleteRotation = async (oldSeed: string) => {
  const headers = await getAdminHeaders();
  const res = await fetch(`${BACKEND_BASE}/admin/provably-fair/complete-rotation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ oldSeed }),
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data as CompleteRotationResult;
};
