import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LockKeyhole, Sparkles, GripHorizontal, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
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

type RevealPhase = 'idle' | 'ripping' | 'bursting' | 'carousel' | 'flipping' | 'reveal' | 'result';
type WonCard = { name: string; rarity: string; value: number; imageUrl: string | null; emoji?: string };
type RarityTier = 'common' | 'uncommon' | 'rare' | 'ultra' | 'cinematic';

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const RARITY_COLORS: Record<string, string> = {
  common: '#8892a4', uncommon: '#39d98a', rare: '#00c8ff', ultra: '#9b5cff',
  secret: '#ffd700', god: '#ff4fd8', rainbow: '#ff0060',
};
const BIG_PULL = new Set(['secret', 'god', 'rainbow']);
const DRAG_THRESHOLD = 72;
const CARD_COUNT = 5;

function rarityTier(rarity: string): RarityTier {
  if (BIG_PULL.has(rarity)) return 'cinematic';
  if (rarity === 'ultra') return 'ultra';
  if (rarity === 'rare') return 'rare';
  if (rarity === 'uncommon') return 'uncommon';
  return 'common';
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function VaultParticles({ color, burst = false }: { color: string; burst?: boolean }) {
  const count = burst ? 56 : 28;
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 5) * 0.08;
    const dist = burst ? 50 + (i % 8) * 14 : 25 + (i % 6) * 10;
    const isStreak = i % 6 === 0;
    const isDiamond = i % 4 === 0 && !isStreak;
    return {
      x: Math.round(Math.cos(angle) * dist),
      y: Math.round(Math.sin(angle) * dist),
      delay: (i % 10) * 0.022,
      w: isStreak ? 2 + (i % 3) * 2 : 2 + (i % 4),
      h: isStreak ? 1 : 2 + (i % 4),
      rotate: isDiamond ? 45 : isStreak ? Math.round((angle * 180) / Math.PI) : 0,
      glow: burst ? 3 + (i % 3) : 2,
    };
  }), [burst, count]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {particles.map((p, i) => (
        <motion.span key={i} className="absolute left-1/2 top-1/2"
          initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0.8, 0], x: p.x, y: p.y, scale: [0, 1.3, 0.2] }}
          transition={{ duration: burst ? 1.65 : 1.2, delay: p.delay, ease: 'easeOut' }}
          style={{ width: p.w, height: p.h, background: color, boxShadow: `0 0 ${p.glow * 3}px ${color}, 0 0 ${p.glow * 6}px ${color}50`, transform: `rotate(${p.rotate}deg)` }}
        />
      ))}
    </div>
  );
}

function LightRays({ color, intense = false }: { color: string; intense?: boolean }) {
  const fade = 'radial-gradient(circle, black 0%, black 45%, transparent 78%)';
  const size = 320;
  return (
    <motion.div className="pointer-events-none absolute overflow-hidden"
      style={{ width: size, height: size, left: '50%', top: '50%', marginLeft: -size / 2, marginTop: -size / 2 }}
      initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
      animate={{ opacity: intense ? [0, 0.9, 0.65] : [0, 0.5], scale: 1, rotate: 90 }}
      transition={{ duration: intense ? 1.6 : 1.2, ease: 'easeOut' }}>
      <div className="h-full w-full" style={{
        background: `conic-gradient(from 0deg, transparent 0deg, ${color}55 8deg, transparent 16deg, transparent 40deg, ${color}55 48deg, transparent 56deg, transparent 80deg, ${color}55 88deg, transparent 96deg, transparent 120deg, ${color}55 128deg, transparent 136deg, transparent 160deg, ${color}55 168deg, transparent 176deg, transparent 200deg, ${color}55 208deg, transparent 216deg, transparent 240deg, ${color}55 248deg, transparent 256deg, transparent 280deg, ${color}55 288deg, transparent 296deg, transparent 320deg, ${color}55 328deg, transparent 336deg, transparent 360deg)`,
        borderRadius: '50%', WebkitMaskImage: fade, maskImage: fade,
      }} />
    </motion.div>
  );
}

function ShockRing({ color, size = 300, delay = 0, thickness = 2 }: { color: string; size?: number; delay?: number; thickness?: number }) {
  return (
    <motion.div className="pointer-events-none absolute rounded-full"
      style={{ border: `${thickness}px solid ${color}`, left: '50%', top: '50%', marginLeft: -4, marginTop: -4 }}
      initial={{ width: 8, height: 8, opacity: 0.9 }}
      animate={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, opacity: 0 }}
      transition={{ duration: 0.75, delay, ease: 'easeOut' }}
    />
  );
}

function CardFace({ card, color, shineDelay = 0.4, shineOpacity = 0.9, holographic = false, glowSize = 40 }: {
  card: WonCard; color: string; shineDelay?: number; shineOpacity?: number; holographic?: boolean; glowSize?: number;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl"
      style={{ boxShadow: `0 0 ${glowSize}px -6px ${color}` }}>
      {card.imageUrl
        ? <img src={card.imageUrl} alt={card.name} className="h-full w-full object-contain drop-shadow-2xl" />
        : <div className="flex h-full w-full items-center justify-center text-8xl">{card.emoji || '🃏'}</div>}
      {shineOpacity > 0 && (
        <motion.div className="pointer-events-none absolute inset-[-60%]"
          initial={{ x: '-60%', y: '-60%', opacity: 0 }}
          animate={{ x: '60%', y: '60%', opacity: [0, shineOpacity, 0] }}
          transition={{ delay: shineDelay, duration: 0.75, ease: 'easeInOut' }}
          style={{ background: 'linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.75) 49%, rgba(255,255,255,0.75) 51%, transparent 58%)', mixBlendMode: 'screen' }}
        />
      )}
      {holographic && (
        <motion.div className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 0.7 }}>
          <motion.div className="absolute"
            style={{ inset: '-60%', background: 'conic-gradient(from 0deg, rgba(255,0,100,0.35), rgba(0,200,255,0.35), rgba(255,215,0,0.25), rgba(255,0,255,0.3), rgba(0,255,150,0.3), rgba(255,0,100,0.35))', mixBlendMode: 'screen' }}
            animate={{ rotate: [0, 360] }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      )}
    </div>
  );
}

// ── CardBack — face-down card ─────────────────────────────────────────────────

function CardBack({ glow = false, glowColor = '#ffd700' }: { glow?: boolean; glowColor?: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl"
      style={{
        background: 'linear-gradient(145deg, #1a1b2e, #0d0e1a)',
        border: `1px solid ${glow ? glowColor + '99' : 'rgba(255,215,0,0.22)'}`,
        boxShadow: glow ? `0 0 22px ${glowColor}55, inset 0 0 18px ${glowColor}10` : '0 4px 16px rgba(0,0,0,0.5)',
      }}>
      <div className="absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,215,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.5) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div className="absolute inset-3 rounded-lg border border-[#ffd700]/18" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ffd700]/45"
          style={{ background: 'rgba(255,215,0,0.07)' }}>
          <span className="font-display text-lg font-black text-[#ffd700]" style={{ textShadow: '0 0 10px #ffd700aa' }}>P</span>
        </div>
        <p className="text-[6px] font-bold uppercase tracking-[0.3em] text-[#ffd700]/55">PocketPull</p>
      </div>
      {([['top-2 left-2'], ['top-2 right-2'], ['bottom-2 left-2'], ['bottom-2 right-2']] as const).map(([pos], idx) => (
        <div key={idx} className={`absolute ${pos} h-2 w-2 rotate-45 rounded-sm bg-[#ffd700]/18`} />
      ))}
    </div>
  );
}

// ── CardBurst — pack explosion with 6 flying cards ────────────────────────────

function CardBurst({ color }: { color: string }) {
  const slots = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2 + (i % 2 === 0 ? 0.28 : -0.28);
    return {
      x: Math.round(Math.cos(angle) * (88 + (i % 3) * 22)),
      y: Math.round(Math.sin(angle) * (68 + (i % 3) * 16)),
      rotate: -20 + i * 14,
      delay: i * 0.05,
    };
  }), []);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
      <motion.div className="absolute inset-0 z-10 rounded-2xl"
        initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.38, ease: 'easeOut' }}
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.12) 50%, transparent 70%)' }}
      />
      <ShockRing color={color} size={240} />
      <ShockRing color={color} size={240} delay={0.1} thickness={1} />
      <VaultParticles color={color} burst />
      {slots.map((s, i) => (
        <motion.div key={i} className="absolute" style={{ width: 62, height: 87 }}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.2 }}
          animate={{ x: s.x, y: s.y, opacity: [0, 1, 1, 0.85], rotate: s.rotate, scale: [0.2, 1.08, 0.92] }}
          transition={{ duration: 0.65, delay: s.delay, ease: 'easeOut' }}>
          <CardBack />
        </motion.div>
      ))}
    </div>
  );
}

// ── CardCarousel — 5 face-down cards in 3D fan ────────────────────────────────

function CardCarousel({ onSelect, apiReady }: { onSelect: () => void; apiReady: boolean }) {
  const [activeIdx, setActiveIdx] = useState(2);

  return (
    <div className="relative flex flex-col items-center gap-5 py-2">
      <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#ffd700]">
        {apiReady ? 'Choose Your Card' : 'Shuffling your hand…'}
      </motion.p>

      <div className="relative flex items-center justify-center" style={{ height: 188, width: '100%', perspective: 900 }}>
        {Array.from({ length: CARD_COUNT }, (_, i) => {
          const offset = i - activeIdx;
          const abs = Math.abs(offset);
          const isCenter = offset === 0;
          return (
            <motion.div key={i}
              className="absolute cursor-pointer"
              style={{ width: 86, height: 120, zIndex: CARD_COUNT - abs }}
              animate={{
                x: offset * 66,
                rotateY: offset * -13,
                scale: isCenter ? 1 : 1 - abs * 0.075,
                opacity: abs > 2 ? 0.35 : 1 - abs * 0.1,
              }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              onClick={() => !isCenter && setActiveIdx(i)}>
              <CardBack glow={isCenter} glowColor="#ffd700" />
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center gap-5">
        <button onClick={() => setActiveIdx(p => Math.max(0, p - 1))} disabled={activeIdx === 0}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/55 transition-all hover:border-[#ffd700]/50 hover:text-[#ffd700] disabled:opacity-20">
          <ChevronLeft size={16} />
        </button>
        <div className="flex gap-2">
          {Array.from({ length: CARD_COUNT }, (_, i) => (
            <button key={i} onClick={() => setActiveIdx(i)}
              className="rounded-full transition-all"
              style={{ height: 8, width: i === activeIdx ? 20 : 8, background: i === activeIdx ? '#ffd700' : 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>
        <button onClick={() => setActiveIdx(p => Math.min(CARD_COUNT - 1, p + 1))} disabled={activeIdx === CARD_COUNT - 1}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/55 transition-all hover:border-[#ffd700]/50 hover:text-[#ffd700] disabled:opacity-20">
          <ChevronRight size={16} />
        </button>
      </div>

      <motion.button onClick={() => apiReady && onSelect()} disabled={!apiReady}
        whileHover={apiReady ? { scale: 1.04 } : undefined}
        whileTap={apiReady ? { scale: 0.96 } : undefined}
        className="rounded-xl px-8 py-3 font-display text-sm font-bold uppercase tracking-widest transition-all"
        style={apiReady
          ? { background: 'linear-gradient(90deg, #ffd700, #ff9500)', color: '#000', boxShadow: '0 0 22px rgba(255,165,0,0.45)' }
          : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
        {apiReady ? 'Reveal This Card' : 'Fetching…'}
      </motion.button>
    </div>
  );
}

// ── CardFlip — 3D back→flash→face reveal ──────────────────────────────────────

type FlipStep = 'back' | 'flash' | 'face';

function CardFlip({ card, color, onDone }: { card: WonCard; color: string; onDone: () => void }) {
  const [step, setStep] = useState<FlipStep>('back');
  const doneRef = useRef(false);
  useEffect(() => {
    const t1 = setTimeout(() => setStep('flash'), 480);
    const t2 = setTimeout(() => setStep('face'), 720);
    const t3 = setTimeout(() => { if (!doneRef.current) { doneRef.current = true; onDone(); } }, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ height: 230, width: 164, perspective: 1000 }}>
      <AnimatePresence>
        {step === 'flash' && (
          <motion.div className="absolute inset-[-60px] z-20 rounded-3xl"
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} exit={{ opacity: 0 }}
            transition={{ duration: 0.32 }}
            style={{ background: `radial-gradient(circle, #fff 0%, ${color}70 55%, transparent 72%)` }}
          />
        )}
      </AnimatePresence>

      {/* Back face — rotates out */}
      <motion.div className="absolute" style={{ width: 152, height: 212, backfaceVisibility: 'hidden' }}
        animate={{ rotateY: step === 'back' ? 0 : -90 }}
        transition={{ duration: 0.24, ease: 'easeIn' }}>
        <CardBack glow glowColor={color} />
      </motion.div>

      {/* Front face — rotates in */}
      <motion.div className="absolute" style={{ width: 152, height: 212, backfaceVisibility: 'hidden' }}
        animate={{ rotateY: step === 'face' ? 0 : 90 }}
        transition={{ duration: 0.38, ease: 'easeOut' }}>
        <CardFace card={card} color={color} shineDelay={0.25} shineOpacity={0.85}
          holographic={BIG_PULL.has(card.rarity)} glowSize={50} />
      </motion.div>
    </div>
  );
}

// ── RarityVFX — overlay after flip ────────────────────────────────────────────

function RarityVFX({ tier, color }: { tier: RarityTier; color: string }) {
  if (tier === 'common') return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      <VaultParticles color={color} burst={tier === 'ultra' || tier === 'cinematic'} />
      {(tier === 'rare' || tier === 'ultra' || tier === 'cinematic') && <LightRays color={color} intense={tier === 'cinematic'} />}
      {tier === 'ultra' && (
        <><ShockRing color={color} size={290} /><ShockRing color={color} size={290} delay={0.12} thickness={1} /></>
      )}
      {tier === 'cinematic' && (
        <>
          <ShockRing color={color} size={360} />
          <ShockRing color={color} size={360} delay={0.1} />
          <ShockRing color={color} size={360} delay={0.22} thickness={1} />
        </>
      )}
    </div>
  );
}

// ── VaultPack (drag-to-tear mechanic) ─────────────────────────────────────────

function VaultPack({
  phase, color, dragX, onDragStart, onDrag, onDragEnd, disabled,
}: {
  phase: RevealPhase; color: string; dragX: number;
  onDragStart: () => void; onDrag: (dx: number) => void; onDragEnd: (dx: number) => void; disabled: boolean;
}) {
  const ripping = phase === 'ripping';
  const dissolving = phase !== 'idle' && phase !== 'ripping';
  const dragProgress = Math.min(1, Math.max(0, dragX / DRAG_THRESHOLD));

  return (
    <div className="relative mx-auto h-[290px] w-[210px] sm:h-[330px] sm:w-[240px]" style={{ perspective: 900 }}>
      <motion.div
        className="absolute inset-0 rounded-[22px] border-2"
        animate={
          dissolving
            ? { scale: [1.1, 1.22, 0.05], opacity: [1, 1, 0], y: [0, -12, 8] }
            : ripping
              ? { scale: [1, 1.06, 0.97, 1.08, 0.96, 1.02], rotate: [0, -3, 4, -3, 2, -1, 0], y: [0, -10, 5, -7, 3, 0] }
              : { y: 0, rotate: 0, scale: 1 }
        }
        transition={
          dissolving ? { duration: 0.65, ease: 'easeIn' }
          : ripping ? { duration: 0.85 }
          : { duration: 1.5 }
        }
        style={{
          background: 'linear-gradient(145deg, #202036, #080910 65%)',
          borderColor: `${color}99`,
          boxShadow: `0 20px 55px -18px ${color}, inset 0 0 ${35 + dragProgress * 30}px ${color}${ripping ? '55' : '18'}`,
        }}
      >
        <div className="absolute inset-3 rounded-[17px] border border-white/10" />
        <div className="absolute left-1/2 top-10 -translate-x-1/2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#ffd700]">PocketPull</p>
          <p className="mt-2 font-display text-3xl uppercase tracking-widest text-white">VAULT</p>
          <div className="mx-auto mt-4 h-px w-20 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent" />
        </div>
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-[9px] uppercase tracking-[0.28em] text-white/35">Sealed collectible archive</p>
          <div className="mx-auto mt-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#ffd700]/50 text-[#ffd700]">
            <LockKeyhole size={14} />
          </div>
        </div>

        <motion.div
          className="absolute left-0 right-0 top-[68px] h-7 border-y bg-[#ffd700]/10"
          style={{ borderColor: `rgba(255,215,0,${0.28 + dragProgress * 0.55})`, boxShadow: dragProgress > 0.15 ? `0 0 ${dragProgress * 22}px rgba(255,215,0,0.65)` : 'none' }}
          animate={ripping ? { x: [-2, 2, -3, 3, 0], opacity: [1, 1, 0.4, 0] } : { opacity: 1 }}
          transition={{ duration: 0.7 }}>
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold uppercase tracking-[0.3em] text-[#ffd700]">tear seal</span>
        </motion.div>
      </motion.div>

      {ripping && (
        <motion.div className="absolute top-[65px] h-10 w-[125%] border-y-2 border-dashed border-[#ffd700]"
          style={{ left: '50%', marginLeft: '-62.5%' }}
          initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: [0, 1, 0] }} transition={{ duration: 0.8 }}
        />
      )}

      {/* Draggable pull tab — only visible in idle */}
      {phase === 'idle' && (
        <motion.div
          className="absolute -right-5 top-[60px] flex h-12 w-12 cursor-grab items-center justify-center rounded-full border-2 border-[#ffd700] bg-[#191827] text-[#ffd700] shadow-[0_0_20px_rgba(255,215,0,0.35)] active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          animate={{ scale: 1 + dragProgress * 0.15 }}
          drag={disabled ? false : 'x'}
          dragMomentum={false}
          dragConstraints={{ left: 0, right: DRAG_THRESHOLD + 20 }}
          onDragStart={() => onDragStart()}
          onDrag={(_e, info) => onDrag(Math.max(0, info.offset.x))}
          onDragEnd={(_e, info) => onDragEnd(Math.max(0, info.offset.x))}
          aria-label="Drag to tear the vault seal open"
        >
          <GripHorizontal size={20} />
        </motion.div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const MysteryPackReveal: React.FC<Props> = ({ pack, cards, originalTotal, collectedTotal, isVaulted, onComplete }) => {
  const { user, isAuthenticated } = useAuth();
  const { balance, matchedBalance, updateBalance } = useBalance(user?.id);
  const qc = useQueryClient();
  const [phase, setPhase] = useState<RevealPhase>('idle');
  const [wonCard, setWonCard] = useState<WonCard | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const ripFiredRef = useRef(false);

  useEffect(() => {
    setPhase('idle'); setWonCard(null); setApiReady(false); setError(null); setDragX(0);
    ripFiredRef.current = false;
  }, [pack.id]);

  const startRip = useCallback(async () => {
    if (ripFiredRef.current) return;
    if (!isAuthenticated || !user?.id) {
      setError('Create an account or sign in to open this vault.');
      window.dispatchEvent(new CustomEvent('pocketpull-open-auth', { detail: 'signup' }));
      return;
    }
    if (Number(pack.price) > 0 && balance + matchedBalance < Number(pack.price)) {
      setError('Insufficient balance — deposit funds to open this vault.');
      return;
    }
    ripFiredRef.current = true;
    setError(null);
    setDragX(0);
    setPhase('ripping');

    // API fires immediately in parallel with the animation sequence
    openPack(pack.id).then(result => {
      const won: WonCard = {
        name: result.card.name, rarity: result.card.rarity,
        value: result.card.value, imageUrl: result.card.imageUrl, emoji: result.card.emoji,
      };
      updateBalance(result.newBalance);
      onComplete(result.newBalance);
      setWonCard(won);
      setApiReady(true);
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['pack-cards', pack.id] });
      qc.invalidateQueries({ queryKey: ['packs-catalog'] });
    }).catch((err: any) => {
      setError(err?.message || 'The vault could not be opened. Please try again.');
      setPhase('idle');
      ripFiredRef.current = false;
    });

    await wait(620);    // pack rip shake
    setPhase('bursting');
    await wait(880);    // burst + fly-out
    setPhase('carousel');
    // User picks a card to advance
  }, [isAuthenticated, user?.id, pack, balance, matchedBalance, updateBalance, onComplete, qc]);

  const handleCardSelect = useCallback(() => {
    if (!wonCard || !apiReady || phase !== 'carousel') return;
    setPhase('flipping');
  }, [wonCard, apiReady, phase]);

  const handleFlipDone = useCallback(() => {
    setPhase('reveal');
    setTimeout(() => setPhase('result'), 1100);
  }, []);

  const handleDrag = useCallback((offsetX: number) => {
    setDragX(offsetX);
    if (offsetX >= DRAG_THRESHOLD && !ripFiredRef.current) {
      startRip();
    }
  }, [startRip]);

  const handleDragEnd = useCallback((offsetX: number) => {
    if (offsetX >= DRAG_THRESHOLD && !ripFiredRef.current) {
      startRip();
    }
    setDragX(0);
  }, [startRip]);

  const color = wonCard ? RARITY_COLORS[wonCard.rarity] || '#ffd700' : '#ffd700';
  const tier = wonCard ? rarityTier(wonCard.rarity) : 'common';
  const isBigPull = !!wonCard && BIG_PULL.has(wonCard.rarity);

  const statusLabel =
    phase === 'ripping' ? 'Tearing it open…'
    : phase === 'bursting' ? 'Cards flying out…'
    : '';

  return (
    <div className="space-y-5">
      {/* Progress header */}
      <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(155,92,255,0.12))', border: '1px solid rgba(255,215,0,0.25)' }}>
        <div className="flex items-center justify-center gap-2 text-[#ffd700] text-[10px] uppercase tracking-[0.25em] font-bold">
          {isVaulted ? <LockKeyhole size={14} /> : <Sparkles size={14} />}
          {isVaulted ? 'Vaulted Archive' : 'Mystery Vault'}
        </div>
        <div className="mt-3 text-white font-display text-2xl">Collected {collectedTotal}/{originalTotal}</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-[#ffd700] to-[#9b5cff] transition-all"
            style={{ width: `${originalTotal ? (collectedTotal / originalTotal) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Animation panel — visible until result */}
      {!isVaulted && phase !== 'result' && (
        <div className="relative overflow-hidden rounded-2xl border border-[#ffd700]/20 bg-[#090a12] px-4 pb-8 pt-10 text-center" style={{ minHeight: 440 }}>
          <div className="relative z-10">

            {/* Pack idle / ripping */}
            {(phase === 'idle' || phase === 'ripping') && (
              <motion.div
                animate={phase === 'ripping'
                  ? { scale: [1, 1.04, 1], boxShadow: [`0 0 20px ${color}22`, `0 0 75px ${color}99`, `0 0 20px ${color}22`] }
                  : {}}
                transition={{ duration: 0.7, repeat: phase === 'ripping' ? Infinity : 0 }}>
                <VaultPack phase={phase} color={color} dragX={dragX}
                  disabled={phase !== 'idle'} onDragStart={() => {}}
                  onDrag={handleDrag} onDragEnd={handleDragEnd} />
              </motion.div>
            )}

            {/* Burst */}
            {phase === 'bursting' && (
              <div className="relative mx-auto flex items-center justify-center" style={{ height: 310 }}>
                <CardBurst color="#ffd700" />
              </div>
            )}

            {/* Carousel */}
            {phase === 'carousel' && (
              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
                <CardCarousel onSelect={handleCardSelect} apiReady={apiReady} />
              </motion.div>
            )}

            {/* Flip */}
            {phase === 'flipping' && wonCard && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.18 }}>
                <CardFlip card={wonCard} color={color} onDone={handleFlipDone} />
              </motion.div>
            )}

            {/* Reveal — static face + VFX */}
            {phase === 'reveal' && wonCard && (
              <motion.div className="relative mx-auto" style={{ width: 164, height: 240 }}
                initial={{ opacity: 1 }}>
                <RarityVFX tier={tier} color={color} />
                <motion.div className="relative z-10 h-full w-full"
                  animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 0.55 }}>
                  <CardFace card={wonCard} color={color} shineDelay={0.1} shineOpacity={0.9}
                    holographic={isBigPull} glowSize={55} />
                </motion.div>
              </motion.div>
            )}

            {/* Status text */}
            <AnimatePresence mode="wait">
              {(phase === 'idle' || phase === 'ripping' || phase === 'bursting') && (
                <motion.p key={statusLabel || 'idle'}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-[#ffd700]">
                  {statusLabel || (dragX >= DRAG_THRESHOLD ? 'Release to tear it open!' : dragX > 8 ? 'Keep pulling…' : 'Drag the tab to tear open the vault')}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Button (idle only) */}
            {phase === 'idle' && (
              <button onClick={startRip}
                className="mt-5 rounded-xl border border-[#ffd700]/35 bg-[#ffd700]/10 px-7 py-3 font-display text-sm font-bold uppercase tracking-widest text-[#ffd700] transition-all hover:bg-[#ffd700]/20">
                Pull tab · Rip seal
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-center text-xs text-red-400">{error}</p>
      )}

      {/* Result panel */}
      {phase === 'result' && wonCard && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{
            opacity: 1, scale: 1, y: 0,
            boxShadow: isBigPull
              ? [`0 0 70px -20px #ff0064`, `0 0 70px -20px #00c8ff`, `0 0 70px -20px #ffd700`, `0 0 70px -20px #ff00ff`, `0 0 70px -20px #ff0064`]
              : `0 0 70px -20px ${color}`,
          }}
          transition={isBigPull
            ? { opacity: { duration: 0.35 }, scale: { duration: 0.35 }, y: { duration: 0.35 }, boxShadow: { duration: 3, repeat: Infinity, ease: 'linear', delay: 0.4 } }
            : { duration: 0.35 }}
          className="relative overflow-hidden rounded-2xl p-6 text-center"
          style={{ background: `radial-gradient(circle at 50% 15%, ${color}35, transparent 55%), rgba(255,255,255,0.03)`, border: `1px solid ${color}88` }}
        >
          {tier !== 'common' && <LightRays color={color} intense={isBigPull} />}
          {(tier === 'ultra' || tier === 'cinematic') && <VaultParticles color={color} burst={isBigPull} />}

          <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ delay: 0.1, duration: 0.5 }}
            className="relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full" style={{ color, background: `${color}22` }}>
            <Zap size={16} />
          </motion.div>

          <motion.div className="relative z-10 mx-auto mt-3 h-56 w-40"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }} style={{ perspective: 800 }}>
            <CardFace card={wonCard} color={color}
              shineDelay={0.15} shineOpacity={tier === 'common' ? 0.4 : 0.85}
              holographic={isBigPull} glowSize={isBigPull ? 60 : 40} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }} className="relative z-10">
            <p className="mt-4 text-[10px] uppercase tracking-[0.28em]" style={{ color }}>Vault pull secured</p>
            <h3 className="mt-2 font-display text-3xl text-white">{wonCard.name}</h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest" style={{ color }}>
              {wonCard.rarity} · ${wonCard.value.toFixed(2)}
            </p>
          </motion.div>
        </motion.div>
      )}

      {/* Vaulted contents grid */}
      {isVaulted && (
        <div className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.25em] text-white/40">Complete Vault Contents</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cards.map(card => (
              <div key={card.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex h-28 items-center justify-center rounded-lg bg-black/20">
                  {card.cardImageUrl
                    ? <img src={card.cardImageUrl} alt={card.cardName} className="h-full w-auto object-contain" />
                    : <span className="text-3xl">🃏</span>}
                </div>
                <p className="mt-2 truncate text-xs text-white">{card.cardName}</p>
                <p className="text-[10px] text-white/40">{card.rarity} · {card.originalQuantity ?? card.quantity} copies</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
