import React from 'react';
import { LockKeyhole, Vault } from 'lucide-react';
import { usePacks, PackCatalog } from '../hooks/usePacks';
import type { Pack } from '../data/mockData';

interface Props { onPackOpen: (pack: Pack) => void; }

const toPack = (p: PackCatalog): Pack => ({
  id: p.id, name: p.name, price: p.price,
  tier: p.price <= 10 ? 'mid' : 'high', emoji: '🎴', rarity: 'secret',
  borderColor: p.borderColor, glowColor: p.glowColor, description: p.description,
  odds: { common: 0, uncommon: 0, rare: 0, ultra: 0, secret: 100 },
  totalOpened: `${p.currentQuantity}/${p.quantityLimit}`, featured: true,
  featuredCards: [], quantityLimit: p.quantityLimit, currentQuantity: p.currentQuantity,
  cooldownHours: p.cooldownHours, expiresAt: p.expiresAt,
});

export const VaultPage: React.FC<Props> = ({ onPackOpen }) => {
  const { data: packs = [], isLoading } = usePacks();
  const vaultPacks = packs.filter(p => p.packType === 'mystery');

  return <section className="min-h-[calc(100vh-7rem)] px-4 md:px-8 py-12 bg-[#0a0b0f]">
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-3"><Vault className="text-[#ffd700]" size={30}/><h1 className="font-display text-3xl uppercase tracking-wider text-white">The Vault</h1></div>
      <p className="text-sm text-white/45 mb-10">Limited mystery packs. Every remaining slab has an equal chance.</p>
      {isLoading ? <div className="text-white/40">Loading Vault…</div> : vaultPacks.length === 0 ? <div className="rounded-2xl border border-white/10 p-12 text-center text-white/45">No mystery packs are available yet.</div> : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">{vaultPacks.map(pack => { const soldOut = pack.quantityLimit > 0 && pack.currentQuantity <= 0; const opened = Math.max(0, pack.quantityLimit - pack.currentQuantity); return <button key={pack.id} disabled={soldOut} onClick={() => onPackOpen(toPack(pack))} className={`text-left rounded-2xl border p-4 transition-all ${soldOut ? 'opacity-45 grayscale cursor-not-allowed border-white/10' : 'border-[#ffd700]/25 hover:border-[#ffd700]/70 hover:shadow-[0_0_28px_rgba(255,215,0,.18)]'}`}><div className="relative h-48 flex items-center justify-center"><img src={pack.imageUrl} alt={pack.name} className="max-h-44 max-w-full object-contain"/>{soldOut && <span className="absolute inset-0 flex items-center justify-center font-display text-xl tracking-widest text-[#ffd700]">VAULTED</span>}</div><h2 className="font-display text-lg uppercase text-white">{pack.name}</h2><div className="mt-2 flex justify-between text-xs text-white/55"><span>{opened}/{pack.quantityLimit} opened</span><span>{soldOut ? 'Complete' : `$${pack.price.toFixed(2)}`}</span></div><div className="mt-2 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#ffd700] to-[#9b5cff]" style={{width: `${pack.quantityLimit ? Math.min(100, opened / pack.quantityLimit * 100) : 0}%`}}/></div></button>})}</div>}
    </div>
  </section>;
};
