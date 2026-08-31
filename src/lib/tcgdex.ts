/**
 * TCGDex API utility — fetches real Pokémon card data from the public API.
 * TCGDex is CORS-enabled and requires no authentication.
 */

const BASE = 'https://api.tcgdex.net/v2/en';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TcgDexCard {
  id: string;
  localId: string;
  name: string;
  image: string;          // Full URL ending in .png
  set: string;
  rarity: string | null;
  hp: number | null;
  types: string[];
  category: string;
  description: string | null;
  effect: string | null;
  attacks: { name: string; effect?: string; damage?: string | number }[];
  abilities: { name: string; effect?: string }[];
  illustrator: string | null;
  dexId: number[] | null;
  stage: string | null;
  evolveFrom: string | null;
  tcgplayerPrice: number | null;   // USD
  cardmarketPrice: number | null;  // EUR avg30
}

export interface ListEntry {
  id: string;
  localId?: string;
  name: string;
  image?: string;
  category?: string;
  types?: string[];
}

interface DetailCard {
  id: string;
  localId?: string;
  name: string;
  image?: string;
  rarity?: string | null;
  hp?: number | null;
  types?: string[];
  category?: string;
  description?: string | null;
  effect?: string | null;
  attacks?: { name: string; effect?: string; damage?: string | number }[];
  abilities?: { name: string; effect?: string }[];
  illustrator?: string | null;
  dexId?: number[] | null;
  stage?: string | null;
  evolveFrom?: string | null;
  set?: string | { name?: string };
  pricing?: {
    tcgplayer?: {
      holofoil?: { marketPrice?: number };
      normal?: { marketPrice?: number };
    } | null;
    cardmarket?: {
      avg30?: number;
    } | null;
  };
}

// ── Image URL normalisation ───────────────────────────────────────────────────

export function normaliseTcgDexImage(rawImage: string | undefined): string {
  if (!rawImage) return '';
  if (/\.(png|jpg|jpeg|webp)$/i.test(rawImage)) return rawImage;
  return `${rawImage}/high.png`;
}

// ── In-memory cache ──────────────────────────────────────────────────────────

let _cardListCache: ListEntry[] | null = null;
let _fetchPromise: Promise<ListEntry[]> | null = null;

async function getCardList(): Promise<ListEntry[]> {
  if (_cardListCache) return _cardListCache;
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/cards`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`TCGDex list responded with HTTP ${res.status}`);
      const data: ListEntry[] = await res.json();
      if (!Array.isArray(data)) throw new Error('TCGDex list response was not an array');
      _cardListCache = data;
      _fetchPromise = null;
      return data;
    } catch (err) {
      console.error('[TCGDex] Card list fetch failed:', err);
      _fetchPromise = null;
      throw err;
    }
  })();

  return _fetchPromise;
}

// ── Single card detail ────────────────────────────────────────────────────────

async function fetchDetail(id: string): Promise<DetailCard | null> {
  try {
    const res = await fetch(`${BASE}/cards/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return await res.json() as DetailCard;
  } catch (err) {
    console.error(`[TCGDex] Detail fetch failed for ${id}:`, err);
    return null;
  }
}

function extractPrice(detail: DetailCard): { tcgplayer: number | null; cardmarket: number | null } {
  const tcgplayer = detail.pricing?.tcgplayer?.holofoil?.marketPrice ?? detail.pricing?.tcgplayer?.normal?.marketPrice ?? null;
  const cardmarket = detail.pricing?.cardmarket?.avg30 ?? null;
  return { tcgplayer: tcgplayer ?? null, cardmarket: cardmarket ?? null };
}

function extractSetName(detail: DetailCard): string {
  if (!detail.set) return '';
  if (typeof detail.set === 'string') return detail.set;
  return detail.set.name ?? '';
}

// ── Public API ────────────────────────────────────────────────────────────────

const TYPE_MAP: Record<string, string> = {
  'grass': 'Grass', 'fire': 'Fire', 'water': 'Water', 'lightning': 'Lightning', 'electric': 'Lightning', 
  'psychic': 'Psychic', 'fighting': 'Fighting', 'darkness': 'Darkness', 'dark': 'Darkness', 
  'metal': 'Metal', 'steel': 'Metal', 'dragon': 'Dragon', 'fairy': 'Fairy', 'colorless': 'Colorless'
};

/**
 * Get matching cards with basic info only.
 * Supports advanced search modes: type-based and price-based.
 */
export async function getTcgDexMatches(query: string): Promise<ListEntry[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();

  try {
    // 1. Parse Query for Advanced Modes
    let typeFilter: string | null = null;
    let priceMin: number | null = null;
    let priceMax: number | null = null;
    let remainingQuery = lower;

    // Detect "{type} type" pattern (e.g. "grass type")
    const typeRegex = /(grass|fire|water|lightning|electric|psychic|fighting|darkness|dark|metal|steel|dragon|fairy|colorless)\s+type/i;
    const typeMatch = remainingQuery.match(typeRegex);
    if (typeMatch) {
      const typeKey = typeMatch[1].toLowerCase();
      typeFilter = TYPE_MAP[typeKey];
      remainingQuery = remainingQuery.replace(typeMatch[0], '').trim();
    }

    // Detect price patterns: $5, $5-$10, $5.50
    const priceRangeMatch = remainingQuery.match(/\$(\d+(\.\d+)?)\s*-\s*\$?(\d+(\.\d+)?)/);
    const priceExactMatch = remainingQuery.match(/\$(\d+(\.\d+)?)/);

    if (priceRangeMatch) {
      priceMin = parseFloat(priceRangeMatch[1]);
      priceMax = parseFloat(priceRangeMatch[3]);
      remainingQuery = remainingQuery.replace(priceRangeMatch[0], '').trim();
    } else if (priceExactMatch) {
      priceMin = parseFloat(priceExactMatch[1]);
      priceMax = priceMin;
      remainingQuery = remainingQuery.replace(priceExactMatch[0], '').trim();
    } else if (remainingQuery.includes('price')) {
      const err = new Error('Invalid price format. Use e.g. "$5" or "$5-$10".');
      (err as any).isFriendly = true;
      throw err;
    }

    // 2. Fetch Initial List
    let baseList: ListEntry[] = [];

    if (typeFilter) {
      try {
        const typeRes = await fetch(`${BASE}/types/${typeFilter}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        
        let typeCards: ListEntry[] = [];
        if (typeRes.ok) {
          const typeData = await typeRes.json();
          typeCards = typeData.cards || [];
        }

        const fullList = await getCardList();
        const relatedCards = fullList.filter(c => 
          (c.name || '').toLowerCase().includes(typeFilter!.toLowerCase())
        );

        const mergedMap = new Map<string, ListEntry>();
        typeCards.forEach(c => mergedMap.set(c.id, c));
        relatedCards.forEach(c => mergedMap.set(c.id, c));
        baseList = Array.from(mergedMap.values());
      } catch (err) {
        console.error(`[TCGDex] Type fetch failed for ${typeFilter}:`, err);
        const fullList = await getCardList();
        baseList = fullList.filter(c => (c.name || '').toLowerCase().includes(typeFilter!.toLowerCase()));
      }
    } else {
      baseList = await getCardList();
    }

    // 3. Apply Remaining Text Filter
    let matches = baseList;
    if (remainingQuery) {
      matches = matches.filter(c => (c.name || '').toLowerCase().includes(remainingQuery));
    }

    // 4. Handle Price Filtering (requires hydration in UI)
    if (priceMin !== null) {
      (matches as any)._priceFilter = { min: priceMin, max: priceMax };
    }

    return matches;
  } catch (err) {
    if ((err as any).isFriendly) throw err;
    console.error('[TCGDex] Match search failed:', err);
    return [];
  }
}

/**
 * Hydrate details for a specific set of cards.
 */
export async function hydrateTcgDexCards(entries: ListEntry[]): Promise<TcgDexCard[]> {
  if (!entries || entries.length === 0) return [];
  
  try {
    const details = await Promise.all(entries.map(c => fetchDetail(c.id)));

    return entries.map((entry, i): TcgDexCard => {
      const detail = details[i];
      const { tcgplayer, cardmarket } = detail ? extractPrice(detail) : { tcgplayer: null, cardmarket: null };
      
      return {
        id: entry.id,
        localId: detail?.localId ?? entry.localId ?? '',
        name: entry.name || 'Unknown Card',
        image: normaliseTcgDexImage(detail?.image ?? entry.image),
        set: detail ? extractSetName(detail) : '',
        rarity: detail?.rarity ?? null,
        hp: detail?.hp ?? null,
        types: detail?.types ?? [],
        category: detail?.category ?? '',
        description: detail?.description ?? null,
        effect: detail?.effect ?? null,
        attacks: detail?.attacks ?? [],
        abilities: detail?.abilities ?? [],
        illustrator: detail?.illustrator ?? null,
        dexId: detail?.dexId ?? null,
        stage: detail?.stage ?? null,
        evolveFrom: detail?.evolveFrom ?? null,
        tcgplayerPrice: tcgplayer,
        cardmarketPrice: cardmarket,
      };
    });
  } catch (err) {
    console.error('[TCGDex] Batch hydration failed:', err);
    return [];
  }
}

export async function searchTcgDexCards(query: string, limit = 1000): Promise<TcgDexCard[]> {
  try {
    const matches = await getTcgDexMatches(query);
    if (!matches || matches.length === 0) return [];
    return hydrateTcgDexCards(matches.slice(0, limit));
  } catch (err) {
    console.error('[TCGDex] searchTcgDexCards failed:', err);
    return [];
  }
}

export async function fetchTcgDexCard(id: string): Promise<TcgDexCard | null> {
  try {
    const detail = await fetchDetail(id);
    if (!detail) return null;
    const { tcgplayer, cardmarket } = extractPrice(detail);
    return {
      id: detail.id,
      localId: detail.localId ?? '',
      name: detail.name || 'Unknown Card',
      image: normaliseTcgDexImage(detail.image),
      set: extractSetName(detail),
      rarity: detail.rarity ?? null,
      hp: detail.hp ?? null,
      types: detail.types ?? [],
      category: detail.category ?? '',
      description: detail.description ?? null,
      effect: detail.effect ?? null,
      attacks: detail.attacks ?? [],
      abilities: detail.abilities ?? [],
      illustrator: detail.illustrator ?? null,
      dexId: detail.dexId ?? null,
      stage: detail.stage ?? null,
      evolveFrom: detail.evolveFrom ?? null,
      tcgplayerPrice: tcgplayer,
      cardmarketPrice: cardmarket,
    };
  } catch (err) {
    console.error(`[TCGDex] fetchTcgDexCard failed for ${id}:`, err);
    return null;
  }
}
