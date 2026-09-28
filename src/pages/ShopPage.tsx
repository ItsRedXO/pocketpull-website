import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gem, ShoppingBag, Clock, CheckCircle, XCircle, Lock } from 'lucide-react';
import { getShopRotation, purchaseShopItem, ShopItem } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { GEMS_QUERY_KEY } from '../hooks/useGems';

const RARITY_COLORS: Record<string, string> = {
  common: 'text-gray-400 border-gray-600',
  uncommon: 'text-green-400 border-green-600',
  rare: 'text-blue-400 border-blue-600',
  ultra: 'text-purple-400 border-purple-600',
  secret: 'text-yellow-400 border-yellow-600',
  god: 'text-[#ff9d00] border-[#ff9d00]',
  chase: 'text-red-400 border-red-600',
  premium: 'text-pink-400 border-pink-600',
};

const RARITY_BG: Record<string, string> = {
  common: 'bg-gray-500/10',
  uncommon: 'bg-green-500/10',
  rare: 'bg-blue-500/10',
  ultra: 'bg-purple-500/10',
  secret: 'bg-yellow-500/10',
  god: 'bg-[#ff9d00]/10',
  chase: 'bg-red-500/10',
  premium: 'bg-pink-500/10',
};

const ROW_LABELS = ['Common Finds', 'Rare Picks', 'Premium Pulls', 'Elite Collection'];
const ROW_RANGES = ['500–1,500 💎', '1,600–3,000 💎', '4,000–10,000 💎', '10,100–50,000 💎'];
const ROW_COLORS = [
  'from-blue-500/20 to-transparent border-blue-500/20',
  'from-purple-500/20 to-transparent border-purple-500/20',
  'from-yellow-500/20 to-transparent border-yellow-500/20',
  'from-red-500/20 to-transparent border-red-500/20',
];

function formatTimeLeft(nextRefresh: string): string {
  const now = Date.now();
  const target = new Date(nextRefresh).getTime();
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface ShopCardProps {
  item: ShopItem;
  gems: number;
  onBuy: (id: string) => void;
  buying: string | null;
}

function ShopCard({ item, gems, onBuy, buying }: ShopCardProps) {
  const isSold = item.is_sold;
  const canAfford = gems >= item.gem_price;
  const isThisBeingBought = buying === item.id;
  const rarity = item.card_rarity || 'rare';
  const rarityColor = RARITY_COLORS[rarity] || RARITY_COLORS.rare;
  const rarityBg = RARITY_BG[rarity] || RARITY_BG.rare;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl border overflow-hidden transition-all duration-200 ${
        isSold
          ? 'border-white/5 opacity-40'
          : canAfford
          ? 'border-[#9b5cff]/30 hover:border-[#9b5cff]/70 hover:shadow-[0_0_20px_rgba(155,92,255,0.15)]'
          : 'border-white/10'
      } bg-[#13141e]`}
    >
      {/* Card image */}
      <div className="relative aspect-[3/4] bg-[#0a0b0f] overflow-hidden">
        {item.card_image_url ? (
          <img
            src={item.card_image_url}
            alt={item.card_name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-600">🃏</div>
        )}

        {/* Sold overlay */}
        {isSold && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1">
            <CheckCircle size={24} className="text-gray-400" />
            <span className="text-gray-300 font-bold text-xs uppercase tracking-wider">Sold</span>
          </div>
        )}

        {/* Rarity badge */}
        <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${rarityColor} ${rarityBg}`}>
          {rarity}
        </div>
      </div>

      {/* Card info */}
      <div className="p-2.5">
        <p className="text-white text-xs font-bold truncate mb-1">{item.card_name}</p>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <Gem size={11} className="text-[#9b5cff] shrink-0" />
            <span className={`text-xs font-bold ${isSold ? 'text-gray-600' : canAfford ? 'text-white' : 'text-red-400'}`}>
              {item.gem_price.toLocaleString()}
            </span>
          </div>
          {!isSold && (
            <button
              onClick={() => onBuy(item.id)}
              disabled={!canAfford || isThisBeingBought}
              className={`text-[10px] px-2 py-1 rounded-lg font-bold transition-all shrink-0 ${
                canAfford
                  ? 'bg-[#9b5cff] hover:bg-[#8b4cef] text-white active:scale-95'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
            >
              {isThisBeingBought ? '…' : canAfford ? 'Buy' : <Lock size={10} />}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface Toast { id: string; type: 'success' | 'error'; message: string; }

export function ShopPage() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [buying, setBuying] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [timeLeft, setTimeLeft] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['shop-rotation'],
    queryFn: getShopRotation,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data?.nextRefresh) return;
    const tick = () => setTimeLeft(formatTimeLeft(data.nextRefresh));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [data?.nextRefresh]);

  const gems = data?.gemsBalance ?? 0;

  function addToast(type: 'success' | 'error', message: string) {
    const id = `${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  async function handleBuy(shopItemId: string) {
    if (!isAuthenticated) { addToast('error', 'Please log in to purchase'); return; }
    setBuying(shopItemId);
    try {
      const result = await purchaseShopItem(shopItemId);
      queryClient.invalidateQueries({ queryKey: ['shop-rotation'] });
      queryClient.invalidateQueries({ queryKey: GEMS_QUERY_KEY });
      addToast('success', `${result.card.name} added to your collection! (−${data?.rotation.find(i => i.id === shopItemId)?.gem_price?.toLocaleString() ?? '?'} 💎)`);
      refetch();
    } catch (err: any) {
      addToast('error', err?.message || 'Purchase failed');
    } finally {
      setBuying(null);
    }
  }

  const rotation = data?.rotation ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#9b5cff]/20 border border-[#9b5cff]/30 flex items-center justify-center">
            <ShoppingBag size={20} className="text-[#9b5cff]" />
          </div>
          <div>
            <h1 className="text-2xl font-display text-white">Card Shop</h1>
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mt-0.5">
              <Clock size={11} />
              <span>Refreshes in {timeLeft || '…'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <div className="flex items-center gap-2 bg-[#9b5cff]/10 border border-[#9b5cff]/30 rounded-xl px-4 py-2.5">
              <Gem size={16} className="text-[#9b5cff]" />
              <div>
                <div className="text-white font-bold text-sm leading-none">{gems.toLocaleString()}</div>
                <div className="text-[#9b5cff] text-[10px] uppercase tracking-wider">Gems</div>
              </div>
            </div>
          )}
          <div className="text-xs text-gray-500 max-w-[200px]">
            Earn gems by opening packs, upgrading cards, and playing battles.
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white/5 animate-pulse aspect-[3/5]" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-16 text-gray-500">
          <XCircle size={32} className="mx-auto mb-3 text-red-500/50" />
          <p>Failed to load shop. Please try again.</p>
          <button onClick={() => refetch()} className="mt-3 px-4 py-2 bg-white/5 rounded-lg text-sm hover:bg-white/10">Retry</button>
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-8">
          {[0, 1, 2, 3].map(rowIdx => {
            const rowItems = rotation.filter(item => item.slot_index >= rowIdx * 5 && item.slot_index < (rowIdx + 1) * 5);
            return (
              <div key={rowIdx}>
                <div className={`flex items-center gap-3 mb-4 pb-3 border-b bg-gradient-to-r ${ROW_COLORS[rowIdx]}`}>
                  <div className="flex-1">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">{ROW_LABELS[rowIdx]}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{ROW_RANGES[rowIdx]}</p>
                  </div>
                  <div className="text-xs text-gray-600">
                    {rowItems.filter(i => !i.is_sold).length}/{rowItems.length} available
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {rowItems.length > 0
                    ? rowItems.map(item => (
                        <ShopCard
                          key={item.id}
                          item={item}
                          gems={gems}
                          onBuy={handleBuy}
                          buying={buying}
                        />
                      ))
                    : Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-white/5 bg-[#13141e] aspect-[3/5] flex items-center justify-center">
                          <span className="text-gray-700 text-xs">Coming Soon</span>
                        </div>
                      ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gem earning info */}
      <div className="mt-10 p-4 rounded-xl border border-white/5 bg-white/2">
        <div className="flex items-center gap-2 mb-3">
          <Gem size={14} className="text-[#9b5cff]" />
          <span className="text-sm font-bold text-white">How to Earn Gems</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-400">
          <div className="flex flex-col gap-1">
            <span className="text-white font-semibold">Pack Openings</span>
            <span>Earn gems every time you open a pack. Rarer pulls = more gems.</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-white font-semibold">Upgrader</span>
            <span>Every spin earns gems. Win bonus for successful upgrades.</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-white font-semibold">Pack Battles</span>
            <span>Earn gems for participating. Winners get a bonus reward.</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-white font-semibold">Poke Brawl</span>
            <span>Each battle run earns a small amount of gems.</span>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-24 lg:bottom-6 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${
                toast.type === 'success'
                  ? 'bg-[#9b5cff] text-white'
                  : 'bg-red-500/90 text-white'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
