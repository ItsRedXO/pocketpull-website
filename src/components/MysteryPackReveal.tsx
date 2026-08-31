import React, { useEffect, useMemo, useState } from 'react';
import { LockKeyhole, ShieldCheck, Sparkles, GripHorizontal, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PackCatalog, PackCard } from '../hooks/usePacks';
import { openPack } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useBalance } from '../hooks/useBalance';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  pack: PackCatalog;
  cards: PackCard[];
  originalTotal: number;
  collectedTotal: number;
  tierTotals?: Array<{ label: string; total: number }>;
  isVaulted: boolean;
  onComplete: (newBalance: number) => void;
}

type RevealPhase = 'idle' | 'charging' | 'tearing' | 'opening' | 'revealing' | 'revealed';
type WonCard = { name: string; rarity: string; value: number; imageUrl: string | null; emoji?: string };

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const RARITY_COLORS: Record<string, string> = {
  common: '#8892a4', uncommon: '#39d98a', rare: '#00c8ff', ultra: '#9b5cff', secret: '#ffd700', god: '#ff4fd8', rainbow: '#ff0060',
};

function VaultParticles({ color, burst = false }: { color: string; burst?: boolean }) {
  const particles = useMemo(() => Array.from({ length: burst ? 34 : 18 }, (_, i) => ({
    x: ((i * 47) % 180) - 90,
    y: -35 - ((i * 29) % 100),
    delay: (i % 8) * 0.045,
    size: 3 + (i % 4),
    rotate: (i * 43) % 180,
  })), [burst]);
  return <div className="pointer-events-none absolute inset-0 overflow-visible">{particles.map((p, i) => <motion.span key={i} className="absolute left-1/2 top-1/2 rounded-sm" initial={{ opacity: 0, x: 0, y: 0, scale: 0 }} animate={{ opacity: [0, 1, 0], x: p.x, y: p.y, scale: [0, 1, 0.25], rotate: p.rotate }} transition={{ duration: burst ? 1.5 : 1.1, delay: p.delay, ease: 'easeOut' }} style={{ width: p.size, height: p.size, background: color, boxShadow: `0 0 10px ${color}` }} />)}</div>;
}

function VaultPack({ phase, color, onRip, disabled }: { phase: RevealPhase; color: string; onRip: () => void; disabled: boolean }) {
  const active = phase !== 'idle';
  const tearing = phase === 'tearing' || phase === 'opening';
  return <div className="relative mx-auto h-[290px] w-[210px] sm:h-[330px] sm:w-[240px]" style={{ perspective: 900 }}>
    <motion.div className="absolute inset-0 rounded-[22px] border-2" animate={active ? { y: [0, -4, 0], rotate: [0, -1, 1, 0] } : { y: 0, rotate: 0 }} transition={{ duration: 1.5, repeat: active ? Infinity : 0 }} style={{ background: `linear-gradient(145deg, #202036, #080910 65%)`, borderColor: `${color}99`, boxShadow: `0 20px 55px -18px ${color}, inset 0 0 35px ${color}18` }}>
      <div className="absolute inset-3 rounded-[17px] border border-white/10" />
      <div className="absolute left-1/2 top-10 -translate-x-1/2 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#ffd700]">PocketPull</p><p className="mt-2 font-display text-3xl uppercase tracking-widest text-white">VAULT</p><div className="mx-auto mt-4 h-px w-20 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent" /></div>
      <div className="absolute bottom-8 left-0 right-0 text-center"><p className="text-[9px] uppercase tracking-[0.28em] text-white/35">Sealed collectible archive</p><div className="mx-auto mt-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#ffd700]/50 text-[#ffd700]"><LockKeyhole size={14} /></div></div>
      <motion.div className="absolute left-0 right-0 top-[68px] h-7 border-y border-[#ffd700]/70 bg-[#ffd700]/10" animate={tearing ? { x: [-2, 2, -3, 3, 0], opacity: [1, 1, 0.4, 0] } : { opacity: 1 }} transition={{ duration: 0.7 }}><span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold uppercase tracking-[0.3em] text-[#ffd700]">tear seal</span></motion.div>
    </motion.div>
    <motion.button type="button" className="absolute -right-5 top-[60px] flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-2 border-[#ffd700] bg-[#191827] text-[#ffd700] shadow-[0_0_20px_rgba(255,215,0,0.35)]" onClick={onRip} whileHover={{ scale: 1.12, rotate: 8 }} whileTap={{ scale: 0.9 }} animate={active ? { x: 20, rotate: 22, opacity: 0 } : { x: 0, rotate: 0, opacity: 1 }} transition={{ duration: 0.65 }} disabled={disabled} aria-label="Pull the vault rip tab"><GripHorizontal size={20} /></motion.button>
    {tearing && <motion.div className="absolute left-1/2 top-[65px] h-10 w-[125%] -translate-x-1/2 border-y-2 border-dashed border-[#ffd700]" initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: [0, 1, 0] }} transition={{ duration: 0.8 }} />}
  </div>;
}

export const MysteryPackReveal: React.FC<Props> = ({ pack, cards, originalTotal, collectedTotal, isVaulted, onComplete }) => {
  const { user, isAuthenticated } = useAuth();
  const { balance, matchedBalance, updateBalance } = useBalance(user?.id);
  const qc = useQueryClient();
  const [phase, setPhase] = useState<RevealPhase>('idle');
  const [revealed, setRevealed] = useState<WonCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pressing, setPressing] = useState(false);

  useEffect(() => { setPhase('idle'); setRevealed(null); setError(null); }, [pack.id]);

  const handleRip = async () => {
    if (phase !== 'idle' || isVaulted) return;
    if (!isAuthenticated || !user?.id) { setError('Create an account or sign in to open this vault.'); window.dispatchEvent(new CustomEvent('pocketpull-open-auth', { detail: 'signup' })); return; }
    if (Number(pack.price) > 0 && balance + matchedBalance < Number(pack.price)) { setError('Insufficient balance — deposit funds to open this vault.'); return; }
    setError(null); setPressing(false); setPhase('charging');
    try {
      const resultPromise = openPack(pack.id);
      await wait(700); setPhase('tearing');
      await wait(850); setPhase('opening');
      const result = await resultPromise;
      await updateBalance(result.newBalance); onComplete(result.newBalance);
      setRevealed({ name: result.card.name, rarity: result.card.rarity, value: result.card.value, imageUrl: result.card.imageUrl, emoji: result.card.emoji });
      await wait(900); setPhase('revealing');
      await wait(950); setPhase('revealed');
      qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['pack-cards', pack.id] }); qc.invalidateQueries({ queryKey: ['packs-catalog'] });
    } catch (err: any) { setError(err?.message || 'The vault could not be opened. Please try again.'); setPhase('idle'); }
  };

  const color = revealed ? RARITY_COLORS[revealed.rarity] || '#ffd700' : '#ffd700';
  const isAnimating = phase !== 'idle' && phase !== 'revealed';
  const phaseLabel = phase === 'charging' ? 'The seal is humming…' : phase === 'tearing' ? 'Tear the golden seal!' : phase === 'opening' ? 'Vault breach detected…' : phase === 'revealing' ? 'Your card is emerging…' : '';

  return <div className="space-y-5">
    <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(155,92,255,0.12))', border: '1px solid rgba(255,215,0,0.25)' }}><div className="flex items-center justify-center gap-2 text-[#ffd700] text-[10px] uppercase tracking-[0.25em] font-bold">{isVaulted ? <LockKeyhole size={14} /> : <Sparkles size={14} />} {isVaulted ? 'Vaulted Archive' : 'Mystery Vault'}</div><div className="mt-3 text-white font-display text-2xl">Collected {collectedTotal}/{originalTotal}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#ffd700] to-[#9b5cff] transition-all" style={{ width: `${originalTotal ? (collectedTotal / originalTotal) * 100 : 0}%` }} /></div></div>
    {!isVaulted && <div className="relative overflow-hidden rounded-2xl border border-[#ffd700]/20 bg-[#090a12] px-4 pb-6 pt-10 text-center">
      <AnimatePresence>{isAnimating && <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><VaultParticles color={color} burst={phase === 'opening' || phase === 'revealing'} /></motion.div>}</AnimatePresence>
      <div className="relative z-10"><motion.div animate={phase === 'charging' ? { scale: [1, 1.04, 1], boxShadow: [`0 0 20px ${color}22`, `0 0 75px ${color}99`, `0 0 20px ${color}22`] } : {}} transition={{ duration: 0.7, repeat: phase === 'charging' ? Infinity : 0 }}><VaultPack phase={phase} color={color} onRip={handleRip} disabled={phase !== 'idle'} /></motion.div><AnimatePresence mode="wait"><motion.p key={phaseLabel} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-[#ffd700]">{phaseLabel || 'Pull the tab to rip open the vault'}</motion.p></AnimatePresence><button onPointerDown={() => setPressing(true)} onPointerUp={() => setPressing(false)} onPointerCancel={() => setPressing(false)} onClick={handleRip} disabled={phase !== 'idle'} className="mt-5 rounded-xl border border-[#ffd700]/35 bg-[#ffd700]/10 px-7 py-3 font-display text-sm font-bold uppercase tracking-widest text-[#ffd700] transition-all hover:bg-[#ffd700]/20 disabled:cursor-not-allowed disabled:opacity-50" style={{ transform: pressing ? 'scale(0.96)' : undefined }}>{phase === 'idle' ? 'Pull tab · Rip seal' : phase === 'revealed' ? 'Vault opened' : 'Opening…'}</button></div>
    </div>}
    {error && <p className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-center text-xs text-red-400">{error}</p>}
    {phase === 'revealed' && revealed && <motion.div initial={{ opacity: 0, scale: 0.55, rotateY: 120, y: 40 }} animate={{ opacity: 1, scale: 1, rotateY: 0, y: 0 }} transition={{ type: 'spring', stiffness: 150, damping: 14 }} className="relative overflow-hidden rounded-2xl p-6 text-center" style={{ background: `radial-gradient(circle at 50% 15%, ${color}35, transparent 55%), rgba(255,255,255,0.03)`, border: `1px solid ${color}88`, boxShadow: `0 0 70px -20px ${color}` }}><VaultParticles color={color} burst /><motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ delay: 0.35, duration: 0.7 }} className="relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full" style={{ color, background: `${color}22` }}><Zap size={16} /></motion.div>{revealed.imageUrl ? <motion.img initial={{ y: 35, opacity: 0, rotate: -4 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ delay: 0.25, duration: 0.65, type: 'spring' }} src={revealed.imageUrl} alt={revealed.name} className="relative z-10 mx-auto mt-3 h-56 w-auto object-contain drop-shadow-2xl" /> : <div className="relative z-10 mt-5 text-8xl">{revealed.emoji || '🃏'}</div>}<p className="relative z-10 mt-4 text-[10px] uppercase tracking-[0.28em]" style={{ color }}>Vault pull secured</p><h3 className="relative z-10 mt-2 font-display text-3xl text-white">{revealed.name}</h3><p className="relative z-10 mt-1 text-xs font-bold uppercase tracking-widest" style={{ color }}>{revealed.rarity} · ${revealed.value.toFixed(2)}</p></motion.div>}
    {isVaulted && <div className="space-y-3"><h3 className="text-[11px] uppercase tracking-[0.25em] text-white/40">Complete Vault Contents</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{cards.map(card => <div key={card.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><div className="flex h-28 items-center justify-center rounded-lg bg-black/20">{card.cardImageUrl ? <img src={card.cardImageUrl} alt={card.cardName} className="h-full w-auto object-contain" /> : <span className="text-3xl">🃏</span>}</div><p className="mt-2 truncate text-xs text-white">{card.cardName}</p><p className="text-[10px] text-white/40">{card.rarity} · {card.originalQuantity ?? card.quantity} copies</p></div>)}</div></div>}
  </div>;
};
