import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, Coins, Clock, Package, Check } from 'lucide-react';
import { getBrawlItemShop, getBrawlItemInventory, buyBrawlItem, getBrawlProfile, type BrawlItemDef, type ItemRarity } from '../../lib/brawlApi';

const RARITY_COLORS: Record<ItemRarity, string> = { common: '#8892a4', uncommon: '#4ade80', rare: '#facc15' };
const RARITY_LABEL: Record<ItemRarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare' };

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useCountdown(endsAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return 0;
  return Math.max(0, new Date(endsAt).getTime() - now);
}

function ItemCard({ item, owned, balance, onBuy, buying, justBought }: {
  item: BrawlItemDef; owned: number; balance: number; onBuy: () => void; buying: boolean; justBought: boolean;
}) {
  const color = RARITY_COLORS[item.rarity];
  const affordable = balance >= item.price;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{
      opacity: 1, y: 0,
      boxShadow: buying ? [`0 0 0px ${color}00`, `0 0 24px ${color}80`, `0 0 0px ${color}00`] : `0 0 0px ${color}00`,
    }} transition={{ boxShadow: buying ? { repeat: Infinity, duration: 0.9 } : undefined }}
      whileHover={{ y: -3 }}
      className="relative rounded-xl border p-4 flex flex-col gap-2 overflow-hidden"
      style={{ borderColor: `${color}45`, background: `linear-gradient(160deg, ${color}14 0%, rgba(255,255,255,0.02) 60%)` }}>
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-30" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ background: `${color}25`, color }}>{RARITY_LABEL[item.rarity]}</span>
        {owned > 0 && <span className="text-[10px] text-white/40 font-bold">Owned: {owned}</span>}
      </div>
      <div className="flex items-center justify-center py-2">
        <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ background: '#0d0e14', boxShadow: `inset 0 0 12px ${color}30` }}>
          <img src={item.spriteUrl} alt={item.name} className="w-11 h-11 object-contain" style={{ imageRendering: 'pixelated' }} />
        </div>
      </div>
      <h4 className="font-display text-sm uppercase tracking-wider text-center" style={{ color }}>{item.name}</h4>
      <p className="text-[11px] text-white/50 text-center min-h-[2.5rem]">{item.description}</p>
      <div className="flex items-center justify-center gap-1.5 text-[#facc15] text-sm font-bold mt-1"><Coins size={14} /> {item.price.toLocaleString()}</div>
      <motion.button onClick={onBuy} disabled={!affordable || buying}
        whileHover={affordable && !buying ? { scale: 1.03 } : undefined} whileTap={affordable && !buying ? { scale: 0.96 } : undefined}
        className="mt-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
        style={affordable ? { background: `linear-gradient(90deg, ${color}, #00c8ff)`, color: '#000', opacity: buying ? 0.6 : 1 } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }}>
        {justBought ? <><Check size={13} /> Bought!</> : buying ? 'Buying…' : affordable ? 'Buy' : 'Not enough pokedollars'}
      </motion.button>
    </motion.div>
  );
}

export function ItemsTab() {
  const qc = useQueryClient();
  const { data: shop } = useQuery({ queryKey: ['brawl-item-shop'], queryFn: getBrawlItemShop, refetchInterval: 30_000 });
  const { data: inventoryData } = useQuery({ queryKey: ['brawl-item-inventory'], queryFn: getBrawlItemInventory });
  const { data: profile } = useQuery({ queryKey: ['brawl-profile'], queryFn: getBrawlProfile });
  const [buyingKey, setBuyingKey] = useState<string | null>(null);
  const [justBoughtKey, setJustBoughtKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remainingMs = useCountdown(shop?.nextRotateAt || null);

  const inventory = inventoryData?.inventory || [];
  const ownedByKey = new Map(inventory.map(e => [e.itemKey, e.quantity]));

  const handleBuy = async (itemKey: string) => {
    setError(null);
    setBuyingKey(itemKey);
    try {
      await buyBrawlItem(itemKey);
      qc.invalidateQueries({ queryKey: ['brawl-item-inventory'] });
      qc.invalidateQueries({ queryKey: ['brawl-profile'] });
      qc.invalidateQueries({ queryKey: ['brawl-challenges'] });
      setJustBoughtKey(itemKey);
      setTimeout(() => setJustBoughtKey(null), 1400);
    } catch (e: any) {
      setError(e.message || 'Purchase failed');
    } finally {
      setBuyingKey(null);
    }
  };

  if (!shop || !profile) return <div className="text-white/40 text-sm py-16 text-center">Loading Item Shop…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2"><ShoppingBag size={16} className="text-[#9b5cff]" /><h3 className="font-display text-sm uppercase tracking-widest text-white/70">Item Shop</h3></div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-white/40 text-[11px]"><Clock size={12} /> Rotates in {formatCountdown(remainingMs)}</div>
          <div className="flex items-center gap-1.5 text-[#facc15] text-xs font-bold"><Coins size={13} /> {profile.balance.toLocaleString()} pokedollars</div>
        </div>
      </div>
      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {shop.items.map(item => (
          <ItemCard key={item.key} item={item} owned={ownedByKey.get(item.key) || 0} balance={profile.balance}
            buying={buyingKey === item.key} justBought={justBoughtKey === item.key} onBuy={() => handleBuy(item.key)} />
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3"><Package size={15} className="text-[#9b5cff]" /><h4 className="font-display text-xs uppercase tracking-widest text-white/50">My Items</h4></div>
        {inventory.length === 0 ? (
          <div className="text-white/30 text-xs py-8 text-center border border-dashed border-white/10 rounded-xl">Nothing purchased yet — buy an item above to see it here.</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
            <AnimatePresence>
              {inventory.map(entry => (
                <motion.div key={entry.itemKey} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  title={entry.item.name}
                  className="relative rounded-lg border border-white/10 bg-white/[0.03] p-2 flex flex-col items-center gap-1">
                  <img src={entry.item.spriteUrl} alt={entry.item.name} className="w-8 h-8 object-contain" style={{ imageRendering: 'pixelated' }} />
                  <span className="text-[9px] text-white/50 text-center truncate w-full">{entry.item.name}</span>
                  <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-[#9b5cff] text-white rounded-full w-4 h-4 flex items-center justify-center">{entry.quantity}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
