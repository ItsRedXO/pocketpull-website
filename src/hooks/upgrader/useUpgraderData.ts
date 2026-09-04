import { useEffect, useCallback } from 'react';
import { useAuth, useUserStats } from '../useAuth';
import { useQuery } from '@tanstack/react-query';
import { TargetCard } from '../../pages/upgrader/constants';
import { UpgraderState } from './useUpgraderState';
import { blink } from '../../lib/blink';

export const useUpgraderData = (state: UpgraderState) => {
  const { user, isAuthenticated } = useAuth();
  const { stats, updateBalance } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const { setInventory, setInvLoading, setAllDbCards } = state;

  const { data: settingsData } = useQuery({
    queryKey: ['public-upgrader-settings'],
    queryFn: async () => {
      const res = await fetch('/upgrader/settings', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load upgrader settings');
      const data = await res.json();
      return data.settings as Array<{ multiplier: number; maxChance: number }>;
    }, staleTime: 10000
  });

  const loadInventory = useCallback(async () => {
    setInvLoading(true);
    if (!user?.id) { setInvLoading(false); return; }
    try {
      const rows = await blink.db.inventory.list({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, limit: 500 });
      setInventory((Array.isArray(rows) ? rows : []).filter((r:any) => Number(r.sold ?? r.isSold ?? 0) === 0).map((r:any) => ({
        id:r.id, cardId:r.cardId || r.card_id, cardName:r.cardName || r.card_name || 'Unknown Card', rarity:r.rarity || 'common', value:Number(r.value)||0,
        emoji:r.emoji || '🃏', isFavorite:Number(r.isFavorite ?? r.is_favorite)>0, isLocked:Number(r.isLocked ?? r.is_locked)>0, cardImageUrl:r.cardImageUrl || r.card_image_url || null,
      })));
    } catch (e) { console.error('Failed to load inventory:', e); setInventory([]); }
    finally { setInvLoading(false); }
  }, [user?.id, setInventory, setInvLoading]);

  const loadAllCards = useCallback(async () => {
    try {
      const res = await fetch('/api/pack-cards', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load cards');
      const rows = await res.json();
      const cards: TargetCard[] = (Array.isArray(rows) ? rows : []).map((r:any) => ({ cardId:r.id, name:r.cardName || r.card_name || 'Unknown', emoji:'star', rarity:r.rarity || 'common', value:Number(r.estimatedValue ?? r.value)||0, cardImageUrl:r.cardImageUrl || r.card_image_url || null })).filter(c=>c.value>0);
      const seen = new Set<string>(); setAllDbCards(cards.filter(c=>{const key=c.name+'_'+c.rarity;if(seen.has(key))return false;seen.add(key);return true;}));
    } catch { setAllDbCards([]); }
  }, [setAllDbCards]);

  useEffect(() => { loadInventory(); loadAllCards(); }, [loadInventory, loadAllCards]);

  return { user, isAuthenticated, stats, updateBalance, settingsData, loadInventory };
};

export type UpgraderData = ReturnType<typeof useUpgraderData>;
