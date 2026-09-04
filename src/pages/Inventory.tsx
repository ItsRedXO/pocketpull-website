import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, useUserStats } from '../hooks/useAuth';
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
  const { updateBalance } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
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
      const rows = await fetch('/api/inventory', { credentials: 'include' }).then(r => r.ok ? r.json() : []);
      const list = Array.isArray(rows) ? rows : Array.isArray(rows?.inventory) ? rows.inventory : [];
      return list.filter((r: any) => Number(r.sold ?? r.isSold ?? 0) === 0).map((r: any) => ({
        id: r.id, cardId: r.cardId || r.card_id, cardName: r.cardName || r.card_name,
        rarity: r.rarity, value: Number(r.value) || 0, emoji: r.emoji || '🃏',
        isFavorite: Number(r.isFavorite ?? r.is_favorite) > 0,
        isLocked: Number(r.isLocked ?? r.is_locked) > 0,
        createdAt: r.createdAt || r.created_at || '',
        cardImageUrl: r.cardImageUrl || r.card_image_url || null,
        packName: r.packName || r.pack_name || null,
      }));
    }, staleTime: 0,
  });

  const setRawCards = useCallback((updater: (prev: RawCard[]) => RawCard[]) => {
    qc.setQueryData([...INVENTORY_QUERY_KEY, user?.id], updater);
  }, [qc, user?.id]);

  const grouped: InventoryCard[] = useMemo(() => rawCards.map(row => ({ ...row, isFavorite: Boolean(row.isFavorite), isLocked: Boolean(row.isLocked), quantity: 1, allIds: [row.id] })), [rawCards]);
  const filtered = useMemo(() => grouped.filter(c => (!search || c.cardName.toLowerCase().includes(search.toLowerCase())) && (filter === 'all' || c.rarity === filter)).sort((a, b) => b.value - a.value), [grouped, search, filter]);
  const statsValues = useMemo(() => ({
    totalCards: rawCards.length,
    totalValue: rawCards.reduce((a, c) => a + Number(c.value), 0),
    rarePlus: rawCards.filter(c => ['rare', 'ultra', 'secret', 'god', 'rainbow'].includes(c.rarity)).length,
    favorites: rawCards.filter(c => Boolean(c.isFavorite)).length,
    lockedCount: rawCards.filter(c => Boolean(c.isLocked)).length,
    sellableCards: grouped.filter(c => !c.isLocked),
    sellableValue: rawCards.filter(c => !Boolean(c.isLocked)).reduce((a, c) => a + Number(c.value), 0),
  }), [rawCards, grouped]);

  const toggleFavorite = async (card: InventoryCard) => { const id = card.allIds[0]; const value = !card.isFavorite; setRawCards(p => p.map(r => r.id === id ? { ...r, isFavorite: value } : r)); try { await favoriteCard(id, value); } catch { setRawCards(p => p.map(r => r.id === id ? { ...r, isFavorite: !value } : r)); } };
  const toggleLock = async (card: InventoryCard) => { const id = card.allIds[0]; const value = !card.isLocked; setRawCards(p => p.map(r => r.id === id ? { ...r, isLocked: value } : r)); try { await lockCard(id, value); } catch { setRawCards(p => p.map(r => r.id === id ? { ...r, isLocked: !value } : r)); } };
  const handleSell = async (card: InventoryCard) => {
    if (!user?.id || card.isLocked || selling) return;
    const id = card.allIds[0]; setSelling(card.cardId); setRawCards(p => p.filter(r => r.id !== id)); setSellMsg(`Selling ${card.cardName}...`);
    try { const result = await sellCard(id); qc.setQueryData([...INVENTORY_QUERY_KEY, user.id], (p: RawCard[] | undefined) => (p || []).filter(r => r.id !== id && Number((r as any).sold ?? 0) === 0)); updateBalance(result.newBalance); setSellMsg(`Sold ${card.cardName}!`); }
    catch (err: any) { setSellMsg(err.message || 'Failed to sell card.'); qc.invalidateQueries({ queryKey: [...INVENTORY_QUERY_KEY, user.id] }); }
    finally { setSelling(null); setSellConfirm(null); setTimeout(() => setSellMsg(null), 3000); }
  };
  const handleSellAll = async () => {
    if (!user?.id || !statsValues.sellableCards.length || sellingAll) return; setSellingAll(true); setSellMsg(`Selling ${statsValues.sellableCards.length} cards...`);
    try { const result = await sellAllCards(); setRawCards(p => p.filter(r => Boolean(r.isLocked))); updateBalance(result.newBalance); setSellMsg(`Sold ${result.count} cards!`); }
    catch (err: any) { setSellMsg(err.message || 'Failed to sell all cards.'); } finally { setSellingAll(false); setSellAllConfirm(false); setTimeout(() => setSellMsg(null), 4000); }
  };
  if (!isAuthenticated) return <div className="min-h-[60vh] flex items-center justify-center"><div className="text-center space-y-4 px-4"><div className="text-6xl mb-4 text-[#00c8ff]/20">🔒</div><h2 className="text-2xl font-display text-white uppercase tracking-tight">Sign In Required</h2><p className="text-gray-400 text-sm max-w-xs mx-auto">Log in to view and manage your personal card collection.</p></div></div>;
  return <><motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-[#0a0b0f] pb-24"><div className="container mx-auto px-4 py-12 max-w-7xl"><div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6"><InventoryHeader totalCards={statsValues.totalCards} totalValue={statsValues.totalValue} lockedCount={statsValues.lockedCount} sellableCount={statsValues.sellableCards.length} sellableValue={statsValues.sellableValue} sellAllConfirm={sellAllConfirm} sellingAll={sellingAll} sellMsg={sellMsg} onSetSellAllConfirm={setSellAllConfirm} onHandleSellAll={handleSellAll} /><button onClick={() => loadInventory()} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button></div><InventoryStats totalCards={statsValues.totalCards} totalValue={statsValues.totalValue} rarePlus={statsValues.rarePlus} favorites={statsValues.favorites} /><InventoryFilters search={search} onSearchChange={setSearch} filter={filter} onFilterChange={setFilter} /><InventoryGrid loading={loading} groupedCount={grouped.length} filtered={filtered} selling={selling} sellConfirm={sellConfirm} onToggleLock={toggleLock} onToggleFavorite={toggleFavorite} onSetLightbox={setLightbox} onSetSellConfirm={setSellConfirm} onHandleSell={handleSell} /></div></motion.div>{lightbox && <CardImageLightbox src={lightbox.src} alt={lightbox.alt} rarityColor={lightbox.rarityColor} onClose={() => setLightbox(null)} />}</>;
};
