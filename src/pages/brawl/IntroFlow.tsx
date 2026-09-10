import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Swords, Trophy, ShoppingBag, Target } from 'lucide-react';
import { completeBrawlIntro, type BrawlInstance } from '../../lib/brawlApi';
import { typeColor } from './typeColors';

const RULES = [
  { icon: Swords, title: 'Build a team', text: 'You start with 6 random Pokemon. Battle in the Safari Zone or the shop to grow your roster, then pick your active 6.' },
  { icon: Trophy, title: 'Simulated battles', text: 'Every match is an AI-simulated 6v6 with real type matchups — fire beats grass, water beats fire, and so on.' },
  { icon: Target, title: 'Climb the ladder', text: 'Win Local Battles and Tournaments to earn pokedollars, climb the league ladder, and unlock bigger tournaments.' },
  { icon: ShoppingBag, title: 'Pokedollars only', text: 'Everything here uses pokedollars — a separate, earn-only currency. It never touches your real PocketPull balance.' },
];

export function IntroFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<'rules' | 'opening' | 'reveal'>('rules');
  const [roster, setRoster] = useState<BrawlInstance[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setStep('opening');
    setError(null);
    try {
      const result = await completeBrawlIntro();
      if (result.roster) setRoster(result.roster);
      setStep('reveal');
    } catch (e: any) {
      setError(e.message || 'Failed to open your starter pack');
      setStep('rules');
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <AnimatePresence mode="wait">
        {step === 'rules' && (
          <motion.div key="rules" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <h1 className="font-display text-4xl md:text-5xl uppercase tracking-tighter" style={{ textShadow: '0 0 40px rgba(155,92,255,0.6)' }}>Welcome to Poke Brawl</h1>
              <p className="text-white/50 text-sm mt-3">A persistent team-management mini-game. Here's how it works.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-8">
              {RULES.map(r => (
                <div key={r.title} className="flex gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.03]">
                  <r.icon size={18} className="text-[#9b5cff] shrink-0 mt-0.5" />
                  <div><div className="font-bold text-sm text-white">{r.title}</div><div className="text-xs text-white/50 mt-1">{r.text}</div></div>
                </div>
              ))}
            </div>
            {error && <p className="text-center text-red-400 text-xs mb-4">{error}</p>}
            <div className="text-center">
              <button onClick={handleStart} className="px-8 py-3 rounded-xl font-display uppercase tracking-wider text-sm bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black font-bold">
                Open Your Starter Pack
              </button>
              <p className="text-white/30 text-[11px] mt-2">6 random Pokemon, free, right now.</p>
            </div>
          </motion.div>
        )}

        {step === 'opening' && (
          <motion.div key="opening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}>
              <Sparkles size={40} className="text-[#9b5cff]" />
            </motion.div>
            <p className="text-white/50 text-sm uppercase tracking-widest">Opening starter pack…</p>
          </motion.div>
        )}

        {step === 'reveal' && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl w-full text-center">
            <h2 className="font-display text-2xl uppercase tracking-widest text-white mb-1">Your Starter Team</h2>
            <p className="text-white/40 text-xs mb-6">All 6 are on your active team — swap them any time in the Team tab.</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
              {roster.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 24, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.12, type: 'spring' }}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-2 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/20 flex items-center justify-center">
                    {p.artwork_url ? <img src={p.artwork_url} alt={p.name} className="w-full h-full object-contain scale-150" style={{ objectPosition: 'top' }} /> : null}
                  </div>
                  <div className="text-[11px] font-bold text-white capitalize mt-1 truncate w-full">{p.name}</div>
                  <div className="flex gap-1 mt-1">
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase font-bold" style={{ background: `${typeColor(p.primary_type)}30`, color: typeColor(p.primary_type) }}>{p.primary_type}</span>
                  </div>
                  <div className="text-[10px] text-[#00c8ff] font-bold mt-1">OVR {p.overall_rating}</div>
                </motion.div>
              ))}
            </div>
            <button onClick={onComplete} className="px-8 py-3 rounded-xl font-display uppercase tracking-wider text-sm bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black font-bold">
              Enter Poke Brawl
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
