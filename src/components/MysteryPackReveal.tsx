import React, { useEffect, useMemo, useState } from 'react';
import { LockKeyhole, Sparkles, GripHorizontal, Zap } from 'lucide-react';
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
const BIG_PULL = new Set(['secret', 'god', 'rainbow']);
const DRAG_THRESHOLD = 68;

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

// Rotating light rays behind the emerging card — the classic pack-app "big moment" backdrop.
// Masked with a radial fade so the rays taper off softly instead of getting a hard
// clip against the panel's border (which reads as the rays "leaking" past the edge).
function LightRays({ color, intense = false }: { color: string; intense?: boolean }) {
  const fade = 'radial-gradient(circle, black 0%, black 45%, transparent 78%)';
  const size = 320;
  return (
    // framer-motion's animate (scale/rotate) owns this element's `transform`, which
    // would silently clobber Tailwind's translate-based centering classes -- so
    // center with a fixed negative margin instead of -translate-x/y-1/2.
    <motion.div
      className="pointer-events-none absolute overflow-hidden"
      style={{ width: size, height: size, left: '50%', top: '50%', marginLeft: -size / 2, marginTop: -size / 2 }}
      initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
      animate={{ opacity: intense ? [0, 0.9, 0.65] : [0, 0.5], scale: 1, rotate: 90 }}
      transition={{ duration: intense ? 1.6 : 1.2, ease: 'easeOut' }}
    >
      <div
        className="h-full w-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${color}55 8deg, transparent 16deg, transparent 40deg, ${color}55 48deg, transparent 56deg, transparent 80deg, ${color}55 88deg, transparent 96deg, transparent 120deg, ${color}55 128deg, transparent 136deg, transparent 160deg, ${color}55 168deg, transparent 176deg, transparent 200deg, ${color}55 208deg, transparent 216deg, transparent 240deg, ${color}55 248deg, transparent 256deg, transparent 280deg, ${color}55 288deg, transparent 296deg, transparent 320deg, ${color}55 328deg, transparent 336deg, transparent 360deg)`,
          borderRadius: '50%',
          WebkitMaskImage: fade,
          maskImage: fade,
        }}
      />
    </motion.div>
  );
}

function VaultPack({
  phase, color, dragX, onDragStart, onDrag, onDragEnd, disabled,
}: {
  phase: RevealPhase; color: string; dragX: number;
  onDragStart: () => void; onDrag: (dx: number) => void; onDragEnd: (dx: number) => void; disabled: boolean;
}) {
  const active = phase !== 'idle';
  const flashing = phase === 'tearing';
  const dissolving = phase === 'opening' || phase === 'revealing' || phase === 'revealed';
  const dragProgress = Math.min(1, Math.max(0, dragX / DRAG_THRESHOLD));

  return <div className="relative mx-auto h-[290px] w-[210px] sm:h-[330px] sm:w-[240px]" style={{ perspective: 900 }}>
    <motion.div
      className="absolute inset-0 rounded-[22px] border-2"
      animate={
        dissolving
          ? { scale: [1, 1.08, 0.2], opacity: [1, 1, 0] }
          : active
            ? { y: [0, -4, 0], rotate: [0, -1, 1, 0], scale: 1 + dragProgress * 0.03 }
            : { y: 0, rotate: 0, scale: 1 }
      }
      transition={dissolving ? { duration: 0.6, ease: 'easeIn' } : { duration: 1.5, repeat: active ? Infinity : 0 }}
      style={{
        background: `linear-gradient(145deg, #202036, #080910 65%)`,
        borderColor: `${color}99`,
        boxShadow: `0 20px 55px -18px ${color}, inset 0 0 ${35 + dragProgress * 30}px ${color}${flashing ? '55' : '18'}`,
      }}
    >
      <div className="absolute inset-3 rounded-[17px] border border-white/10" />
      <div className="absolute left-1/2 top-10 -translate-x-1/2 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#ffd700]">PocketPull</p><p className="mt-2 font-display text-3xl uppercase tracking-widest text-white">VAULT</p><div className="mx-auto mt-4 h-px w-20 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent" /></div>
      <div className="absolute bottom-8 left-0 right-0 text-center"><p className="text-[9px] uppercase tracking-[0.28em] text-white/35">Sealed collectible archive</p><div className="mx-auto mt-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#ffd700]/50 text-[#ffd700]"><LockKeyhole size={14} /></div></div>

      {/* Seal — cracks and flashes brighter the further the tab is dragged */}
      <motion.div
        className="absolute left-0 right-0 top-[68px] h-7 border-y bg-[#ffd700]/10"
        animate={
          flashing
            ? { x: [-2, 2, -3, 3, 0], opacity: [1, 1, 0.4, 0], borderColor: ['#ffd70099', '#ffffffcc', '#ffd70099'] }
            : { opacity: 1, borderColor: `#ffd700${70 + Math.round(dragProgress * 85)}` as string }
        }
        transition={{ duration: 0.7 }}
        style={{ boxShadow: dragProgress > 0.15 ? `0 0 ${dragProgress * 22}px #ffd700aa` : 'none' }}
      >
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold uppercase tracking-[0.3em] text-[#ffd700]">tear seal</span>
      </motion.div>
    </motion.div>

    {flashing && <motion.div className="absolute top-[65px] h-10 w-[125%] border-y-2 border-dashed border-[#ffd700]" style={{ left: '50%', marginLeft: '-62.5%' }} initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: [0, 1, 0] }} transition={{ duration: 0.8 }} />}

    {/* Draggable pull tab — drag right past the threshold to tear the seal; release early and it snaps back.
        Uses framer-motion's own drag gesture (not a hand-rolled pointer listener) since it already
        handles preventDefault/pointer-capture/touch-action correctly across browsers. */}
    {!active && (
      <motion.div
        className="absolute -right-5 top-[60px] flex h-12 w-12 cursor-grab items-center justify-center rounded-full border-2 border-[#ffd700] bg-[#191827] text-[#ffd700] shadow-[0_0_20px_rgba(255,215,0,0.35)] active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        animate={{ scale: 1 + dragProgress * 0.15 }}
        drag={disabled ? false : 'x'}
        dragConstraints={{ left: 0, right: DRAG_THRESHOLD + 24 }}
        dragElastic={0.12}
        dragMomentum={false}
        dragSnapToOrigin
        onDragStart={() => onDragStart()}
        onDrag={(_e, info) => onDrag(Math.max(0, info.offset.x))}
        onDragEnd={(_e, info) => onDragEnd(Math.max(0, info.offset.x))}
        aria-label="Drag to tear the vault seal open"
      >
        <GripHorizontal size={20} />
      </motion.div>
    )}
  </div>;
}

export const MysteryPackReveal: React.FC<Props> = ({ pack, cards, originalTotal, collectedTotal, isVaulted, onComplete }) => {
  const { user, isAuthenticated } = useAuth();
  const { balance, matchedBalance, updateBalance } = useBalance(user?.id);
  const qc = useQueryClient();
  const [phase, setPhase] = useState<RevealPhase>('idle');
  const [revealed, setRevealed] = useState<WonCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { setPhase('idle'); setRevealed(null); setError(null); setDragX(0); }, [pack.id]);

  const handleRip = async () => {
    if (phase !== 'idle' || isVaulted) return;
    if (!isAuthenticated || !user?.id) { setError('Create an account or sign in to open this vault.'); window.dispatchEvent(new CustomEvent('pocketpull-open-auth', { detail: 'signup' })); return; }
    if (Number(pack.price) > 0 && balance + matchedBalance < Number(pack.price)) { setError('Insufficient balance — deposit funds to open this vault.'); return; }
    setError(null); setDragging(false); setPhase('charging');
    try {
      const resultPromise = openPack(pack.id);
      await wait(550); setPhase('tearing');
      await wait(700); setPhase('opening');
      const result = await resultPromise;
      const won: WonCard = { name: result.card.name, rarity: result.card.rarity, value: result.card.value, imageUrl: result.card.imageUrl, emoji: result.card.emoji };
      await updateBalance(result.newBalance); onComplete(result.newBalance);
      await wait(650); setPhase('revealing');
      const big = BIG_PULL.has(won.rarity);
      await wait(big ? 1150 : 800);
      setRevealed(won);
      setPhase('revealed');
      setDragX(0);
      qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['pack-cards', pack.id] }); qc.invalidateQueries({ queryKey: ['packs-catalog'] });
    } catch (err: any) { setError(err?.message || 'The vault could not be opened. Please try again.'); setPhase('idle'); setDragX(0); }
  };

  const handleDragEnd = (offsetX: number) => {
    setDragging(false);
    if (offsetX >= DRAG_THRESHOLD) { handleRip(); return; }
    setDragX(0);
  };

  const color = revealed ? RARITY_COLORS[revealed.rarity] || '#ffd700' : '#ffd700';
  const isAnimating = phase !== 'idle' && phase !== 'revealed';
  const isBigPull = !!revealed && BIG_PULL.has(revealed.rarity);
  const phaseLabel = phase === 'charging' ? 'The seal is humming…' : phase === 'tearing' ? 'Tearing open…' : phase === 'opening' ? 'Vault breach detected…' : phase === 'revealing' ? 'Your card is emerging…' : '';

  return <div className="space-y-5">
    <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(155,92,255,0.12))', border: '1px solid rgba(255,215,0,0.25)' }}><div className="flex items-center justify-center gap-2 text-[#ffd700] text-[10px] uppercase tracking-[0.25em] font-bold">{isVaulted ? <LockKeyhole size={14} /> : <Sparkles size={14} />} {isVaulted ? 'Vaulted Archive' : 'Mystery Vault'}</div><div className="mt-3 text-white font-display text-2xl">Collected {collectedTotal}/{originalTotal}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#ffd700] to-[#9b5cff] transition-all" style={{ width: `${originalTotal ? (collectedTotal / originalTotal) * 100 : 0}%` }} /></div></div>

    {!isVaulted && phase !== 'revealed' && <div className="relative overflow-hidden rounded-2xl border border-[#ffd700]/20 bg-[#090a12] px-4 pb-6 pt-10 text-center" style={{ minHeight: 420 }}>
      <AnimatePresence>{isAnimating && <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><VaultParticles color={color} burst={phase === 'opening' || phase === 'revealing'} /></motion.div>}</AnimatePresence>

      {/* Full flash burst at the moment the vault breaches — the "big moment" beat */}
      <AnimatePresence>
        {phase === 'opening' && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, times: [0, 0.35, 1] }}
            style={{ background: `radial-gradient(circle at 50% 45%, #fff 0%, ${color} 45%, transparent 75%)` }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10">
        {(phase === 'revealing') && (
          <div className="relative flex h-[290px] items-center justify-center sm:h-[330px]">
            <LightRays color="#ffd700" intense={false} />
            <motion.div
              className="relative flex h-40 w-28 items-center justify-center rounded-xl border-2"
              style={{ borderColor: '#ffd700cc', background: 'linear-gradient(160deg, #201c33, #0a0812)', boxShadow: '0 0 45px -8px #ffd700cc' }}
              initial={{ scale: 0.3, opacity: 0, rotateY: 0 }}
              animate={{ scale: [0.3, 1.08, 1], opacity: 1, rotateY: [0, -8, 8, 0], y: [30, -6, 0] }}
              transition={{ duration: isBigPull ? 1.1 : 0.75, ease: 'easeOut' }}
            >
              <span className="font-display text-2xl text-[#ffd700]">P</span>
            </motion.div>
          </div>
        )}

        {(phase === 'idle' || phase === 'charging' || phase === 'tearing') && (
          <motion.div animate={phase === 'charging' ? { scale: [1, 1.04, 1], boxShadow: [`0 0 20px ${color}22`, `0 0 75px ${color}99`, `0 0 20px ${color}22`] } : {}} transition={{ duration: 0.7, repeat: phase === 'charging' ? Infinity : 0 }}>
            <VaultPack
              phase={phase}
              color={color}
              dragX={dragX}
              disabled={phase !== 'idle'}
              onDragStart={() => setDragging(true)}
              onDrag={setDragX}
              onDragEnd={handleDragEnd}
            />
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.p key={phaseLabel || (dragging ? 'drag' : 'idle')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-[#ffd700]">
            {phaseLabel || (dragging ? (dragX >= DRAG_THRESHOLD ? 'Release to tear it open!' : 'Keep pulling…') : 'Drag the tab to tear open the vault')}
          </motion.p>
        </AnimatePresence>

        {phase === 'idle' && (
          <button onClick={handleRip} className="mt-5 rounded-xl border border-[#ffd700]/35 bg-[#ffd700]/10 px-7 py-3 font-display text-sm font-bold uppercase tracking-widest text-[#ffd700] transition-all hover:bg-[#ffd700]/20">
            Pull tab · Rip seal
          </button>
        )}
        {phase !== 'idle' && (
          <div className="mt-5 rounded-xl border border-[#ffd700]/20 bg-[#ffd700]/5 px-7 py-3 font-display text-sm font-bold uppercase tracking-widest text-[#ffd700]/60">
            Opening…
          </div>
        )}
      </div>
    </div>}

    {error && <p className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-center text-xs text-red-400">{error}</p>}

    {phase === 'revealed' && revealed && (
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 16 }}
        className="relative overflow-hidden rounded-2xl p-6 text-center"
        style={{ background: `radial-gradient(circle at 50% 15%, ${color}35, transparent 55%), rgba(255,255,255,0.03)`, border: `1px solid ${color}88`, boxShadow: `0 0 70px -20px ${color}` }}
      >
        <LightRays color={color} intense={isBigPull} />
        <VaultParticles color={color} burst={isBigPull} />
        <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ delay: 0.15, duration: 0.6 }} className="relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full" style={{ color, background: `${color}22` }}>
          <Zap size={16} />
        </motion.div>

        <motion.div
          className="relative z-10 mx-auto mt-3 h-56 w-40"
          initial={{ rotateY: -100, opacity: 0, scale: 0.85 }}
          animate={{ rotateY: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 0.05, duration: 0.55, ease: 'easeOut' }}
          style={{ perspective: 800 }}
        >
          <div className="relative h-full w-full overflow-hidden rounded-lg" style={{ boxShadow: `0 0 40px -6px ${color}` }}>
            {revealed.imageUrl
              ? <img src={revealed.imageUrl} alt={revealed.name} className="h-full w-full object-contain drop-shadow-2xl" />
              : <div className="flex h-full w-full items-center justify-center text-8xl">{revealed.emoji || '🃏'}</div>}
            {/* One-shot shine sweep across the freshly revealed card */}
            <motion.div
              className="pointer-events-none absolute inset-[-60%]"
              initial={{ x: '-60%', y: '-60%', opacity: 0 }}
              animate={{ x: '60%', y: '60%', opacity: [0, 0.9, 0] }}
              transition={{ delay: 0.55, duration: 0.75, ease: 'easeInOut' }}
              style={{
                background: 'linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.75) 49%, rgba(255,255,255,0.75) 51%, transparent 58%)',
                mixBlendMode: 'screen',
              }}
            />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }} className="relative z-10">
          <p className="mt-4 text-[10px] uppercase tracking-[0.28em]" style={{ color }}>Vault pull secured</p>
          <h3 className="mt-2 font-display text-3xl text-white">{revealed.name}</h3>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest" style={{ color }}>{revealed.rarity} · ${revealed.value.toFixed(2)}</p>
        </motion.div>
      </motion.div>
    )}

    {isVaulted && <div className="space-y-3"><h3 className="text-[11px] uppercase tracking-[0.25em] text-white/40">Complete Vault Contents</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{cards.map(card => <div key={card.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3"><div className="flex h-28 items-center justify-center rounded-lg bg-black/20">{card.cardImageUrl ? <img src={card.cardImageUrl} alt={card.cardName} className="h-full w-auto object-contain" /> : <span className="text-3xl">🃏</span>}</div><p className="mt-2 truncate text-xs text-white">{card.cardName}</p><p className="text-[10px] text-white/40">{card.rarity} · {card.originalQuantity ?? card.quantity} copies</p></div>)}</div></div>}
  </div>;
};
