import { useEffect, useCallback } from 'react';
import { useAuth, useUserStats } from '../useAuth';
import { useQuery } from '@tanstack/react-query';
import { blink, INVENTORY_CHANNEL, INVENTORY_UPDATED_EVENT } from '../../lib/blink';
import { TargetCard } from '../../pages/upgrader/constants';
import { UpgraderState } from './useUpgraderState';

export const useUpgraderData = (state: UpgraderState) => {
  const { user, isAuthenticated } = useAuth();
  const { stats, updateBalance } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);

  const {
    setInventory, setInvLoading, setAllDbCards, setSelectedCards, loadInventory: stateLoadInventory
  } = state;

  const { data: settingsData } = useQuery({
    queryKey: ['public-upgrader-settings'],
    queryFn: async () => {
      const res = await fetch('https://b2nnhe2n.backend.blink.new/upgrader/settings');
      const data = await res.json();
      return data.settings as Array<{ multiplier: number; maxChance: number }>;
    },
    staleTime: 10000
  });

  const loadInventory = useCallback(async () => {
    setInvLoading(true);
    if (!user?.id) { setInvLoading(false); return; }
    try {
      const rows = await blink.db.inventory.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      setInventory(
        (Array.isArray(rows) ? rows : [])
          .map(r => ({
            id: r.id as string,
            cardId: r.cardId as string,
            cardName: r.cardName as string,
            rarity: r.rarity as string,
            value: Number(r.value),
            emoji: (r.emoji as string) || '🃏',
            isFavorite: Number(r.isFavorite) > 0,
            isLocked: Number(r.isLocked) > 0,
            cardImageUrl: (r.cardImageUrl as string) || null,
          }))
          .filter(c => !c.isLocked)
      );
    } catch (e) {
      console.error('Failed to load inventory:', e);
    } finally {
      setInvLoading(false);
    }
  }, [user?.id, setInventory, setInvLoading]);

  const loadAllCards = useCallback(async () => {
    try {
      const rows = await blink.db.packCards.list({
        orderBy: { estimatedValue: 'desc' },
        limit: 500,
      });
      const cards: TargetCard[] = (Array.isArray(rows) ? rows : []).map((r: any) => ({
        cardId: r.id as string,
        name: (r.cardName as string) || 'Unknown',
        emoji: 'star',
        rarity: (r.rarity as string) || 'common',
        value: Number(r.estimatedValue) || 0,
        cardImageUrl: (r.cardImageUrl as string) || null,
      })).filter(c => c.value > 0);
      const seen = new Set<string>();
      const deduped = cards.filter(c => {
        const key = c.name + '_' + c.rarity;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setAllDbCards(deduped);
    } catch {
      setAllDbCards([]);
    }
  }, [setAllDbCards]);

  useEffect(() => { loadInventory(); loadAllCards(); }, [loadInventory, loadAllCards]);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    let unsubFn: (() => void) | null = null;
    let retryCount = 0;

    const sub = async () => {
      if (!mounted) return;
      try {
        unsubFn = await blink.realtime.subscribe(`${INVENTORY_CHANNEL}-${user.id}`, (msg) => {
          if (!mounted) return;
          if (msg.event === INVENTORY_UPDATED_EVENT) {
            const data = msg.data as any;
            if (data.type === 'remove') {
              setInventory(prev => prev.filter(c => c.id !== data.cardId));
              setSelectedCards(prev => prev.filter(c => c.id !== data.cardId));
            } else if (data.type === 'remove_many') {
              const ids = new Set(data.cardIds);
              setInventory(prev => prev.filter(c => !ids.has(c.id)));
              setSelectedCards(prev => prev.filter(c => !ids.has(c.id)));
            } else if (data.type === 'add') {
              setInventory(prev => [data.card, ...prev].filter(c => !c.isLocked));
            } else {
              loadInventory();
            }
          }
        });
        retryCount = 0;
      } catch (err: any) {
        if (mounted && retryCount < 3) {
          retryCount++;
          setTimeout(sub, 5000);
        }
      }
    };

    sub();
    return () => {
      mounted = false;
      if (unsubFn) unsubFn();
    };
  }, [user?.id, loadInventory, setInventory, setSelectedCards]);

  return {
    user,
    isAuthenticated,
    stats,
    updateBalance,
    settingsData,
    loadInventory
  };
};

export type UpgraderData = ReturnType<typeof useUpgraderData>;
