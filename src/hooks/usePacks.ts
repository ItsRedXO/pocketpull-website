import { useQuery } from '@tanstack/react-query';
import { blink } from '../lib/blink';
import { formatDistanceToNow } from 'date-fns';

export interface PackCatalog {
  id: string;
  packType: 'standard' | 'mystery';
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  glowColor: string;
  borderColor: string;
  isActive: number;
  sortOrder: number;
  quantityLimit: number;
  currentQuantity: number;
  cooldownHours: number;
  expiresAt: string | null;
  nameColor?: string;
  descriptionColor?: string;
  priceColor?: string;
  buttonTextColor?: string;
  openAnotherButtonTextColor?: string;
}

export interface PackCard {
  id: string;
  packId: string;
  cardName: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'ultra' | 'secret' | 'god';
  pullChance: number;
  estimatedValue: number;
  cardImageUrl?: string;
  sortOrder: number;
  quantity?: number;
  originalQuantity?: number;
}

export interface PackCooldown {
  id: string;
  userId: string;
  packId: string;
  lastOpenedAt: string;
}

export function usePacks() {
  return useQuery<PackCatalog[]>({
    queryKey: ['packs-catalog'],
    queryFn: async () => {
      const rows = await blink.db.packsCatalog.list({
        where: { isActive: 1 },
        orderBy: { price: 'asc' },
      });
      if (!Array.isArray(rows)) throw new Error('Invalid packs response');
      return rows
        .map((r: any) => ({
          ...r,
          packType: r.packType === 'mystery' ? 'mystery' as const : 'standard' as const,
          price: Number(r.price),
          sortOrder: Number(r.sortOrder ?? 0),
          isActive: Number(r.isActive ?? 1),
          quantityLimit: Number(r.quantityLimit ?? 0),
          currentQuantity: Number(r.currentQuantity ?? 0),
          cooldownHours: Number(r.cooldownHours ?? 0),
          expiresAt: r.expiresAt || null,
          nameColor: r.nameColor || '#ffffff',
          descriptionColor: r.descriptionColor || '#ffffff',
          priceColor: r.priceColor || '#ffffff',
          buttonTextColor: r.buttonTextColor || '#ffffff',
          openAnotherButtonTextColor: r.openAnotherButtonTextColor || r.buttonTextColor || '#ffffff',
        })) as PackCatalog[];
    },
    staleTime: 60 * 1000,
    refetchInterval: 60_000, // Refetch every 60s (was 10s)
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 6,
    retryDelay: attempt => Math.min(1500 * 2 ** attempt, 15000),
  });
}

export function useUserCooldowns(userId: string | undefined) {
  return useQuery<Record<string, string>>({
    queryKey: ['user-pack-cooldowns', userId],
    enabled: !!userId,
    queryFn: async () => {
      const rows = await blink.db.packCooldowns.list({
        where: { userId: userId! }
      });
      return Object.fromEntries(
        rows.map((r: any) => [r.packId, r.lastOpenedAt])
      );
    },
    staleTime: 20_000,
    refetchInterval: 20_000,
  });
}

export function usePackCards(packId: string | null) {
  return useQuery<PackCard[]>({
    queryKey: ['pack-cards', packId],
    enabled: !!packId,
    queryFn: async () => {
      const rows = await blink.db.packCards.list({
        where: { packId: packId! },
        orderBy: { sortOrder: 'asc' },
      });
      return rows.map((r: any) => ({
        ...r,
        pullChance: Number(r.pullChance),
        estimatedValue: Number(r.estimatedValue),
        sortOrder: Number(r.sortOrder ?? 0),
        quantity: Number(r.quantity ?? 0),
        originalQuantity: Number(r.originalQuantity ?? r.quantity ?? 0),
      })) as PackCard[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useAllCards() {
  return useQuery<PackCard[]>({
    queryKey: ['all-pack-cards'],
    queryFn: async () => {
      const activePacks = await blink.db.packsCatalog.list({
        where: { isActive: 1 }
      });
      if (!Array.isArray(activePacks)) throw new Error('Invalid active packs response');
      const standardPacks = activePacks.filter((p: any) => (p.packType || 'standard') === 'standard');
      const activePackIds = standardPacks.map((p: any) => p.id);
      const packMap = Object.fromEntries(standardPacks.map((p: any) => [p.id, p.name]));
      
      if (activePackIds.length === 0) return [];
      
      const rows = await blink.db.packCards.list({
        orderBy: { estimatedValue: 'desc' },
        limit: 3000,
      });
      
      return rows
        .filter((r: any) => activePackIds.includes(r.packId))
        .map((r: any) => ({
          ...r,
          pullChance: Number(r.pullChance),
          estimatedValue: Number(r.estimatedValue),
          sortOrder: Number(r.sortOrder ?? 0),
          quantity: Number(r.quantity ?? 0),
          packName: packMap[r.packId] || 'Mystery Pack',
        })) as any[];
    },
    staleTime: 15 * 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 8000),
  });
}

export function useRecentPulls(limit = 12) {
  return useQuery({
    queryKey: ['recent-pulls', limit],
    queryFn: async () => {
      const pulls = await blink.db.inventory.list({
        orderBy: { createdAt: 'desc' },
        limit,
      });
      if (!Array.isArray(pulls)) throw new Error('Invalid recent pulls response');

      // Get unique user IDs to fetch usernames
      const userIds = [...new Set(pulls.map((p: any) => p.userId))];
      const userResults = await Promise.allSettled(
        userIds.map(id => blink.db.users.get(id))
      );
      const userMap = Object.fromEntries(
        userResults
          .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
          .map(result => result.value)
          .filter((u: any) => u && Number(u.isDeleted || u.is_deleted || 0) === 0 && Number(u.isBanned || u.is_banned || 0) === 0)
          .map((u: any) => [u.id, u.username || u.displayName || 'Trainer'])
      );

      return pulls.map((p: any) => ({
          ...p,
          user: userMap[p.userId] || 'Trainer',
          time: formatDistanceToNow(new Date(p.createdAt), { addSuffix: true }),
        }));
    },
    staleTime: 30000,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 6,
    retryDelay: attempt => Math.min(1500 * 2 ** attempt, 15000),
  });
}

export function useHallOfFame(limit = 5) {
  return useQuery({
    queryKey: ['hall-of-fame', limit],
    queryFn: async () => {
      const pulls = await blink.db.inventory.list({
        orderBy: { value: 'desc' },
        limit,
      });
      const userIds = [...new Set(pulls.map((p: any) => p.userId))];
      const users = await Promise.all(
        userIds.map(id => blink.db.users.get(id))
      );
      const userMap = Object.fromEntries(
        users
          .filter((u: any) => u && Number(u.isDeleted || u.is_deleted || 0) === 0 && Number(u.isBanned || u.is_banned || 0) === 0)
          .map((u: any) => [u.id, u.username || u.displayName || 'Trainer'])
      );
      return pulls
        .filter((p: any) => userMap[p.userId])
        .map((p: any) => ({
          ...p,
          user: userMap[p.userId],
          time: formatDistanceToNow(new Date(p.createdAt), { addSuffix: true }),
        }));
    },
    staleTime: 60000,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 6,
    retryDelay: attempt => Math.min(1500 * 2 ** attempt, 15000),
  });
}

export function useGodPulls() {
  return useQuery({
    queryKey: ['god-pulls-catalog'],
    queryFn: async () => {
      // Fetch all God rarity cards from pack_cards
      const cards = await blink.db.packCards.list({
        where: { rarity: 'god' },
        limit: 50
      });
      if (!Array.isArray(cards)) throw new Error('Invalid god pulls response');

      // Get unique pack IDs to fetch pack names
      const packIds = [...new Set(cards.map((c: any) => c.packId))];
      const packs = await Promise.all(
        packIds.map(id => blink.db.packsCatalog.get(id))
      );
      const packMap = Object.fromEntries(
        packs.filter(Boolean).map((p: any) => [p.id, p.name])
      );

      return cards.map((c: any) => ({
        id: c.id,
        name: c.cardName,
        rarity: c.rarity,
        value: Number(c.estimatedValue) || 0,
        imageUrl: c.cardImageUrl,
        packName: packMap[c.packId] || 'Mystery Pack',
        glow: '#ff00ff'
      }));
    },
    staleTime: 600000, // 10 mins
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: 6,
    retryDelay: attempt => Math.min(1500 * 2 ** attempt, 15000),
  });
}