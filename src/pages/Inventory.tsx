import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blink, INVENTORY_CHANNEL, INVENTORY_UPDATED_EVENT } from '../lib/blink';
import { useAuth, useUserStats } from '../hooks/useAuth';
import { useBalance } from '../hooks/useBalance';
import { CardImageLightbox } from '../components/CardImageLightbox';
import { RawCard, InventoryCard } from './inventory/inventoryTypes';
import { InventoryHeader } from './inventory/InventoryHeader';
import { InventoryStats } from './inventory/InventoryStats';
import { InventoryFilters } from './inventory/InventoryFilters';
import { InventoryGrid } from './inventory/InventoryGrid';
import { RefreshCw } from 'lucide-react';
import { lockCard, favoriteCard, sellCard, sellAllCards } from '../lib/api';

export const INVENTORY_QUERY_KEY = ['inventory'];

export const Inventory: React.FC<{ onDepositOpen?: () => void; onProfileOpen?: () => void }> = ({ onDepositOpen, onProfileOpen }) => {
  const { user, isAuthenticated } = useAuth();
  const { stats, updateBalance } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const { balance: liveBalance } = useBalance(user?.id);
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sellConfirm, setSellConfirm] = useState<string | null>(null);
  const [selling, setSelling] = useState<string | null>(null);
  const [sellMsg, setSellMsg] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string; rarityColor: string } | null>(null);
  const [sellAllConfirm, setSellAllConfirm] = useState(false);
  const [sellingAll, setSellingAll] = useState(false);

  const { data: rawCards = [], isLoading: loading, refetch: loadInventory } = useQuery<RawCard[]>({
    queryKey: [...INVENTORY_QUERY_KEY, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      const rows = await blink.db.inventory.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      return Array.isArray(rows) ? rows.filter((r: any) => Number(r.sold ?? r.isSold ?? 0) === 0).map((r: any) => ({
        id: r.id,
        cardId: r.cardId || r.card_id,
        cardName: r.cardName || r.card_name,
        rarity: r.rarity,
        value: Number(r.value) || 0,
        emoji: r.emoji || '🃏',
        isFavorite: Number(r.isFavorite ?? r.is_favorite) > 0,
        isLocked: Number(r.isLocked ?? r.is_locked) > 0,
        createdAt: r.createdAt || r.created_at || '',
        cardImageUrl: r.cardImageUrl || r.card_image_url || null,
        packName: r.packName || r.pack_name || null,
      })) : [];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user?.id) return;
    let unsubFn: (() => void) | null = null;
    const sub = async () => {
      try {
        unsubFn = await blink.realtime.subscribe(`${INVENTORY_CHANNEL}-${user.id}`, (msg) => {
          if (msg.event === INVENTORY_UPDATED_EVENT) loadInventory();
        });
      } catch (err) {
        console.warn('Realtime subscription failed:', err);
      }
    };
    sub();
    return () => { if (unsubFn) unsubFn(); };
  }, [user?.id, loadInventory]);

  const setRawCards = useCallback((updater: (prev: RawCard[]) => RawCard[]) => {
    qc.setQueryData([...INVENTORY_QUERY_KEY, user?.id], updater);
  }, [qc, user?.id]);

  const grouped: InventoryCard[] = useMemo(() => rawCards.map(row => ({ ...row, isFavorite: Boolean(row.isFavorite), isLocked: Boolean(row.isLocked), quantity: 1, allIds: [row.id] })), [rawCards]);

  const filtered = useMemo(() => {
    const base = grouped.filter(c => {
      const matchSearch = !search || c.cardName.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'all' || c.rarity === filter;
      return matchSearch && matchFilter;
    });
    return [...base].sort((a, b) => b.value - a.value);
  }, [grouped, search, filter]);

  const statsValues = useMemo(() => {
    const totalCards = rawCards.length;
    const totalValue = rawCards.reduce((acc, c) => acc + Number(c.value), 0);
    const rarePlus = rawCards.filter(c => ['rare', 'ultra', 'secret', 'god', 'rainbow'].includes(c.rarity)).length;
    const favorites = rawCards.filter(c => Boolean(c.isFavorite)).length;
    const lockedCount = rawCards.filter(c => Boolean(c.isLocked)).length;
    const sellableCards = grouped.filter(c => !c.isLocked);
    const sellableValue = rawCards.filter(r => !Boolean(r.isLocked)).reduce((acc, c) => acc + Number(c.value), 0);
    return { totalCards, totalValue, rarePlus, favorites, lockedCount, sellableCards, sellableValue };
  }, [rawCards, grouped]);

  const toggleFavorite = async (card: InventoryCard) => {
    if (!user?.id) return;
    const newFav = !card.isFavorite;
    setRawCards(prev => prev.map(r => card.allIds.includes(r.id) ? { ...r, isFavorite: newFav } : r));
    try { await favoriteCard(card.allIds[0], newFav); } catch (err) { console.error('Failed to toggle favorite:', err); setRawCards(prev => prev.map(r => card.allIds.includes(r.id) ? { ...r, isFavorite: !newFav } : r)); }
  };

  const toggleLock = async (card: InventoryCard) => {
    if (!user?.id) return;
    const newLocked = !card.isLocked;
    setRawCards(prev => prev.map(r => card.allIds.includes(r.id) ? { ...r, isLocked: newLocked } : r));
    try { await lockCard(card.allIds[0], newLocked); } catch (err) { console.error('Failed to toggle lock:', err); setRawCards(prev => prev.map(r => card.allIds.includes(r.id) ? { ...r, isLocked: !newLocked } : r)); }
  };

  const handleSell = async (card: InventoryCard) => {
    if (!user?.id || card.isLocked) return;
    const idToRemove = card.allIds[0];
    setSelling(card.cardId);
    setRawCards(prev => prev.filter(r => r.id !== idToRemove));
    qc.setQueryData([...INVENTORY_QUERY_KEY, user.id], (prev: RawCard[] | undefined) => (prev || []).filter((r: RawCard) => r.id !== idToRemove));
    setSellMsg(`Selling ${card.cardName} for ${card.value.toFixed(2)}...`);
    try {
      const result = await sellCard(idToRemove);
      updateBalance(result.newBalance);
      setSellMsg(`Sold ${card.cardName} for ${card.value.toFixed(2)}!`);
    } catch (err: any) {
      setSellMsg(err.message || 'Failed to sell card.');
      setRawCards(prev => [...prev, card]);
      qc.invalidateQueries({ queryKey: [...INVENTORY_QUERY_KEY, user.id] });
    } finally {
      setSelling(null);
      setSellConfirm(null);
      setTimeout(() => setSellMsg(null), 3000);
    }
  };

  const handleSellAll = async () => {
    const { sellableCards } = statsValues;
    if (!user?.id || sellableCards.length === 0 || sellingAll) return;
    setSellingAll(true);
    setSellMsg(`Selling ${sellableCards.length} cards...`);
    try {
      const result = await sellAllCards();
      setRawCards(prev => prev.filter(r => Boolean(r.isLocked)));
      qc.setQueryData([...INVENTORY_QUERY_KEY, user.id], (prev: RawCard[] | undefined) => (prev || []).filter((r: RawCard) => Boolean(r.isLocked)));
      updateBalance(result.newBalance);
      setSellMsg(`Sold ${result.count} card${result.count !== 1 ? 's' : ''} for ${result.totalValue.toFixed(2)}!`);
      setTimeout(() => setSellMsg(null), 4000);
    } catch (err: any) {
      setSellMsg(err.message || 'Failed to sell all cards.');
      setTimeout(() => setSellMsg(null), 3000);
    } finally {
      setSellingAll(false);
      setSellAllConfirm(false);
    }
  };

  if (!isAuthenticated) return <div className="min-h-[60vh] flex items-center justify-center"><div className="text-center space-y-4 px-4"><div className="text-6xl mb-4 text-[#00c8ff]/20">🔒</div><h2 className="text-2xl font-display text-white uppercase tracking-tight">Sign In Required</h2><p className="text-gray-400 text-sm max-w-xs mx-auto">Log in to view and manage your personal card collection.</p></div></div>;

  return <>
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="min-h-screen bg-[#0a0b0f] pb-24">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6"><InventoryHeader totalCards={statsValues.totalCards} totalValue={statsValues.totalValue} lockedCount={statsValues.lockedCount} sellableCount={statsValues.sellableCards.length} sellableValue={statsValues.sellableValue} sellAllConfirm={sellAllConfirm} sellingAll={sellingAll} sellMsg={sellMsg} onSetSellAllConfirm={setSellAllConfirm} onHandleSellAll={handleSellAll} /><div className="flex items-center gap-3"><button onClick={() => loadInventory()} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40 font-bold text-xs uppercase tracking-widest"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button></div></div>
        <InventoryStats totalCards={statsValues.totalCards} totalValue={statsValues.totalValue} rarePlus={statsValues.rarePlus} favorites={statsValues.favorites} />
        <InventoryFilters search={search} onSearchChange={setSearch} filter={filter} onFilterChange={setFilter} />
        <InventoryGrid loading={loading} groupedCount={grouped.length} filtered={filtered} selling={selling} sellConfirm={sellConfirm} onToggleLock={toggleLock} onToggleFavorite={toggleFavorite} onSetLightbox={setLightbox} onSetSellConfirm={setSellConfirm} onHandleSell={handleSell} />
      </div>
    </motion.div>
    {lightbox && <CardImageLightbox src={lightbox.src} alt={lightbox.alt} rarityColor={lightbox.rarityColor} onClose={() => setLightbox(null)} />}
  </>;
};
