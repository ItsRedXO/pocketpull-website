import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trees, Coins, Sparkles, X } from 'lucide-react';
import { getBrawlConfig, getBrawlProfile, pullSafariZone, type BrawlSpecies } from '../../lib/brawlApi';
import { typeColor } from './typeColors';

export function SafariZoneTab() {
  const qc = useQueryClient();
  const { data: config } = useQuery({ queryKey: ['brawl-config'], queryFn: getBrawlConfig, staleTime: 60_000 });
  const { data: profile } = useQuery({ queryKey: ['brawl-profile'], queryFn: getBrawlProfile });
  const [pulling, setPulling] = useState<number | null>(null);
  const [pulled, setPulled] = useState<BrawlSpecies[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePull = async (tier: number) => {
    setError(null);
    setPulling(tier);
    try {
      const res = await pullSafariZone(tier);
      setPulled(res.pulled);
      qc.invalidateQueries({ queryKey: ['brawl-profile'] });
      qc.invalidateQueries({ queryKey: ['brawl-roster'] });
    } catch (e: any) {
      setError(e.message || 'Pull failed');
    } finally {
      setPulling(null);
    }
  };

  if (!config || !profile) return <div className="text-white/40 text-sm py-16 text-center">Loading Safari Zone…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2"><Trees size={16} className="text-[#9b5cff]" /><h3 className="font-display text-sm uppercase tracking-widest text-white/70">Safari Zone</h3></div>
        <div className="flex items-center gap-1.5 text-[#facc15] text-xs font-bold"><Coins size={13} /> {profile.balance.toLocaleString()} pokedollars</div>
      </div>
      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {config.safariTiers.map(t => {
          const affordable = profile.balance >= t.cost;
          return (
            <div key={t.tier} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-2">
              <h4 className="font-display text-sm uppercase tracking-wider text-white">Tier {t.tier}</h4>
              <div className="text-[11px] text-white/50">Guarantees {t.count} Pokemon, overall {t.overallMin}-{t.overallMax}</div>
              <div className="text-[10px] text-white/30">Small chance ({Math.round(t.bonusChance * 100)}%) of {t.bonusOverallMin}-{t.bonusOverallMax} overall</div>
              <div className="flex items-center gap-1.5 text-[#facc15] text-sm font-bold mt-1"><Coins size={14} /> {t.cost.toLocaleString()}</div>
              <button onClick={() => handlePull(t.tier)} disabled={!affordable || pulling === t.tier}
                className={`mt-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider ${affordable ? 'bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black' : 'bg-white/5 text-white/25'}`}>
                <Sparkles size={13} /> {pulling === t.tier ? 'Pulling…' : affordable ? 'Enter Safari Zone' : 'Not enough pokedollars'}
              </button>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {pulled && (
          <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="rounded-2xl border border-white/10 p-6 max-w-md w-full text-center relative" style={{ background: '#0d0e14' }}>
              <button onClick={() => setPulled(null)} className="absolute top-3 right-3 text-white/40 hover:text-white"><X size={16} /></button>
              <h3 className="font-display text-lg uppercase tracking-widest text-white mb-4">Safari Zone Catch!</h3>
              <div className="flex justify-center gap-4">
                {pulled.map((p, i) => (
                  <motion.div key={p.id + i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.25, type: 'spring' }}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex flex-col items-center w-28">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-black/20 flex items-center justify-center">
                      {p.artwork_url ? <img src={p.artwork_url} alt={p.name} className="w-full h-full object-contain scale-150" style={{ objectPosition: 'top' }} /> : null}
                    </div>
                    <div className="text-xs font-bold text-white capitalize mt-1 truncate w-full">{p.name}</div>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase font-bold mt-1" style={{ background: `${typeColor(p.primary_type)}30`, color: typeColor(p.primary_type) }}>{p.primary_type}</span>
                    <div className="text-[11px] text-[#00c8ff] font-bold mt-1">OVR {p.overall_rating}</div>
                  </motion.div>
                ))}
              </div>
              <button onClick={() => setPulled(null)} className="mt-6 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black font-bold text-sm uppercase tracking-wider">Nice!</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
