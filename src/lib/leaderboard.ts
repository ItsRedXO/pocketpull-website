import { startOfDay } from 'date-fns';
import { generateUsername, seededRandom, getDailySeed } from './simulation';
import { blink } from './blink';

export interface LeaderboardEntry {
  rank: number;
  user: string;
  value: string;
  numericValue: number;
  sub: string;
  avatar: string;
  isReal?: boolean;
}

// Simple avatar helper to match useLeaderboard's logic
function getAvatarEmoji(username: string = '') {
  const emojis = ['🔥', '🌈', '🌙', '🧬', '🐉', '🔴', '💜', '🌌', '🌊', '👑', '📦', '🏆', '🔒', '💛', '⚡', '✨'];
  if (!username) return '👤';
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return emojis[Math.abs(hash) % emojis.length];
}

/**
 * Generates the full top 100 leaderboard deterministically based on current time.
 */
const leaderboardCache = new Map<string, { data: LeaderboardEntry[]; expiresAt: number }>();
const leaderboardRequests = new Map<string, Promise<LeaderboardEntry[]>>();
const LEADERBOARD_CACHE_TTL = 30_000;

function isRateLimitError(error: any) {
  return error?.status === 429 || error?.details?.code === 'RATE_LIMIT_EXCEEDED' || error?.code === 'RATE_LIMIT_EXCEEDED';
}

async function loadLeaderboardData(type: 'pulls' | 'packs' | 'upgrades', userId?: string): Promise<LeaderboardEntry[]> {
  const seed = getDailySeed();
  
  // 1. Get real entries from DB
  let realRows: any[] = [];
  try {
    if (type === 'pulls') {
      realRows = await blink.db.leaderboardStats.list({
        orderBy: { biggestPull: 'desc' },
        limit: 100
      });
    } else if (type === 'packs') {
      realRows = await blink.db.leaderboardStats.list({
        orderBy: { packsOpened: 'desc' },
        limit: 100
      });
    } else if (type === 'upgrades') {
      realRows = await blink.db.leaderboardStats.list({
        orderBy: { upgradesAttempted: 'desc' },
        limit: 100
      });
    }
  } catch (e) {
    // Public leaderboard data is optional; keep the deterministic fallback quiet
    // when the shared database rate limit is temporarily exhausted.
    if (!isRateLimitError(e)) console.warn(`Failed to fetch real leaderboard for ${type}`);
  }

  // Read the field matching this tab's type -- not a `||` fallback chain,
  // which always picked biggestPull first whenever it was non-zero and
  // silently mislabeled it as packs/upgrades on the other tabs too.
  const realEntries = realRows.map(r => ({
    user: r.username || 'Trainer',
    numericValue: type === 'pulls' ? Number(r.biggestPull || 0) : type === 'packs' ? Number(r.packsOpened || 0) : Number(r.upgradesAttempted || 0),
    avatar: getAvatarEmoji(r.username),
    isReal: true
  }));

  // 2. Get card pool if needed for pulls
  let cardPool: any[] = [];
  if (type === 'pulls') {
    try {
      cardPool = await blink.db.packCards.list({
        orderBy: { estimatedValue: 'desc' },
        limit: 100
      });
    } catch (e) {
      if (!isRateLimitError(e)) console.warn('Failed to fetch card pool');
    }
  }

  // 3. Generate simulated entries
  const targetCount = 100;
  const rng = seededRandom(seed + type);
  
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const second = new Date().getSeconds();
  const dayProgress = (hour * 60 + minute) / 1440; // 0 to 1
  
  // Add some "active" fluctuation based on time to make it feel alive
  // Every 10 seconds we slightly shift the random values to stay in sync with stats
  const activeSeed = Math.floor(Date.now() / 10000); 

  const simulatedEntries = [];
  const existingUsernames = new Set(realEntries.map(e => e.user.toLowerCase()));

  for (let i = 0; i < targetCount; i++) {
    const username = generateUsername(seed + type + i);
    if (existingUsernames.has(username.toLowerCase())) continue;
    
    // Use an entry-specific RNG for values
    const entryRng = seededRandom(seed + type + username);
    const activeRng = seededRandom(seed + type + username + activeSeed);
    
    let val = 0;
    let cardName = '';
    
    if (type === 'pulls') {
      if (cardPool.length > 0) {
        // Distribute cards: higher index = lower rank
        const poolIdx = Math.min(cardPool.length - 1, Math.floor((i / targetCount) * cardPool.length));
        const card = cardPool[poolIdx];
        const maxAvailableValue = Number(cardPool[0].estimatedValue);
        
        val = Number(card.estimatedValue);
        cardName = card.cardName;
        
        // Growth factor starts low and approaches 1.0 by end of day
        const growthFactor = 0.8 + (dayProgress * 0.2); 
        val = val * growthFactor;

        // Add small fluctuation that moves rank every few seconds
        const noise = (activeRng() * 10 - 5);
        
        // Final value: never exceeds the absolute highest value card in the pool
        val = Math.min(maxAvailableValue, val + noise);
      } else {
        // Fallback pool if the real card list didn't load -- capped near the
        // catalog's actual current highest card value so it doesn't invent a
        // number nothing on the site is actually worth.
        val = 100 + (1 - i / targetCount) * 2900 + (dayProgress * 100);
      }
    } else if (type === 'packs') {
      // A realistic single-day total for even the most active player: top
      // simulated entry lands around 150-180 packs opened today, not
      // thousands (previously topped out near 4,500/day, wildly inflated).
      const dailyIncrease = dayProgress * (10 + entryRng() * 15);
      val = 5 + (1 - i / targetCount) * 150 + dailyIncrease;
      // Active fluctuation
      val += (activeRng() * 1);
    } else if (type === 'upgrades') {
      // Similarly scaled down: top simulated entry lands around 55-65
      // upgrade attempts today (previously topped out near 420/day).
      val = 2 + (1 - i / targetCount) * 45 + (dayProgress * 15);
      // Active fluctuation shifts ranking
      val += (activeRng() * 1);
    }

    simulatedEntries.push({
      user: username,
      numericValue: Math.max(0, val),
      avatar: getAvatarEmoji(username),
      isReal: false,
      cardName: cardName
    });
  }

  // 4. Combine, Sort and Format
  let combined = [...realEntries, ...simulatedEntries];
  // "Biggest pull" can never exceed what's actually the highest-value card in
  // the live catalog -- clamps any entry (including a real recorded pull from
  // before the catalog changed) rather than ever showing a dollar figure
  // nothing on the site is priced at. Display-only: never rewrites the
  // underlying recorded value.
  if (type === 'pulls' && cardPool.length > 0) {
    const maxAvailableValue = Number(cardPool[0].estimatedValue);
    combined = combined.map(e => ({ ...e, numericValue: Math.min(e.numericValue, maxAvailableValue) }));
  }
  const all = combined
    .sort((a, b) => b.numericValue - a.numericValue)
    .slice(0, 100);

  return all.map((e, i) => {
    let valueStr = '';
    let subStr = '';

    if (type === 'pulls') {
      valueStr = `$${e.numericValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      subStr = e.isReal ? 'Record pull' : `Pulled ${e.cardName || 'Rare Card'}`;
    } else if (type === 'packs') {
      valueStr = `${Math.floor(e.numericValue).toLocaleString()} packs`;
      subStr = 'Total opened';
    } else if (type === 'upgrades') {
      valueStr = `${Math.floor(e.numericValue).toLocaleString()} attempts`;
      subStr = e.isReal ? 'Upgrades today' : 'Upgrader usage today';
    }

    return {
      rank: i + 1,
      user: e.user,
      numericValue: e.numericValue,
      value: valueStr,
      sub: subStr,
      avatar: e.avatar,
      isReal: e.isReal
    };
  });
}

export async function getLeaderboardData(type: 'pulls' | 'packs' | 'upgrades', userId?: string): Promise<LeaderboardEntry[]> {
  const cacheKey = `${type}:${userId || 'public'}`;
  const cached = leaderboardCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const pending = leaderboardRequests.get(cacheKey);
  if (pending) return pending;

  const request = loadLeaderboardData(type, userId)
    .then(data => {
      leaderboardCache.set(cacheKey, { data, expiresAt: Date.now() + LEADERBOARD_CACHE_TTL });
      return data;
    })
    .finally(() => leaderboardRequests.delete(cacheKey));
  leaderboardRequests.set(cacheKey, request);
  return request;
}
