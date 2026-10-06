import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LockKeyhole, Sparkles, GripHorizontal, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import type { PackCatalog, PackCard } from '../hooks/usePacks';
import { openPack } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useBalance } from '../hooks/useBalance';
import { useQueryClient } from '@tanstack/react-query';
import { Card3DFlip } from './pack/Card3DFlip';
import cardBackImg from '../assets/card-back.webp';

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
const CARD_BACK_URL = cardBackImg; // bundled via Vite — no LFS/path issues
const CARD_COUNT_MAX = 8; // cap carousel at this many cards
const DRAG_THRESHOLD = 80; // slide fires at this px offset
const SLIDE_TRACK_MAX = 120; // total slide track travel in px

function rarityTier(rarity: string): RarityTier {
  if (BIG_PULL.has(rarity)) return 'cinematic';
  if (rarity === 'ultra') return 'ultra';
  if (rarity === 'rare') return 'rare';
  if (rarity === 'uncommon') return 'uncommon';
  return 'common';
}

// ── Shared Framer Motion primitives (particles / rays / rings) ────────────────

function VaultParticles({ color, burst = false }: { color: string; burst?: boolean }) {
  const count = burst ? 56 : 28;
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 5) * 0.08;
    const dist = burst ? 50 + (i % 8) * 14 : 25 + (i % 6) * 10;
    const isStreak = i % 6 === 0;
    const isDiamond = i % 4 === 0 && !isStreak;
    return {
      x: Math.round(Math.cos(angle) * dist), y: Math.round(Math.sin(angle) * dist),
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
  const sz = 320;
  return (
    <motion.div className="pointer-events-none absolute overflow-hidden"
      style={{ width: sz, height: sz, left: '50%', top: '50%', marginLeft: -sz / 2, marginTop: -sz / 2 }}
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

function RarityVFX({ tier, color }: { tier: RarityTier; color: string }) {
  if (tier === 'common') return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      <VaultParticles color={color} burst={tier === 'ultra' || tier === 'cinematic'} />
      {(tier === 'rare' || tier === 'ultra' || tier === 'cinematic') && <LightRays color={color} intense={tier === 'cinematic'} />}
      {tier === 'ultra' && <><ShockRing color={color} size={290} /><ShockRing color={color} size={290} delay={0.12} thickness={1} /></>}
      {tier === 'cinematic' && (
        <><ShockRing color={color} size={360} /><ShockRing color={color} size={360} delay={0.1} /><ShockRing color={color} size={360} delay={0.22} thickness={1} /></>
      )}
    </div>
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

// ── CardBack ──────────────────────────────────────────────────────────────────

function CardBack({ glow = false, glowColor = '#ffd700', imageUrl }: { glow?: boolean; glowColor?: string; imageUrl?: string }) {
  if (imageUrl) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-xl"
        style={{
          border: `1px solid ${glow ? glowColor + '90' : 'rgba(255,215,0,0.2)'}`,
          boxShadow: glow ? `0 0 24px ${glowColor}50` : '0 4px 16px rgba(0,0,0,0.55)',
        }}>
        <img src={imageUrl} alt="Card back" className="h-full w-full object-cover" draggable={false} />
        {glow && <div className="pointer-events-none absolute inset-0 rounded-xl" style={{ boxShadow: `inset 0 0 20px ${glowColor}45` }} />}
      </div>
    );
  }
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl"
      style={{
        background: 'linear-gradient(145deg, #1a1b2e, #0d0e1a)',
        border: `1px solid ${glow ? glowColor + '90' : 'rgba(255,215,0,0.2)'}`,
        boxShadow: glow ? `0 0 24px ${glowColor}50, inset 0 0 18px ${glowColor}10` : '0 4px 16px rgba(0,0,0,0.55)',
      }}>
      <div className="absolute inset-0 opacity-[0.055]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,215,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.5) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div className="absolute inset-3 rounded-lg border border-[#ffd700]/18" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ffd700]/40"
          style={{ background: 'rgba(255,215,0,0.07)' }}>
          <span className="font-display text-lg font-black text-[#ffd700]" style={{ textShadow: '0 0 10px rgba(255,215,0,0.65)' }}>P</span>
        </div>
        <p className="text-[6px] font-bold uppercase tracking-[0.28em] text-[#ffd700]/50">PocketPull</p>
      </div>
      {(['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'] as const).map((pos, i) => (
        <div key={i} className={`absolute ${pos} h-2 w-2 rotate-45 rounded-sm bg-[#ffd700]/16`} />
      ))}
    </div>
  );
}

// ── CardCarousel — CSS-transitions fan (no GSAP, no timing races) ────────────

function CardCarousel({ onSelect, apiReady, cardCount }: { onSelect: () => void; apiReady: boolean; cardCount: number }) {
  const [activeIdx, setActiveIdx] = useState(() => Math.floor(cardCount / 2));

  return (
    <div className="relative flex flex-col items-center gap-5 py-2">
      <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#ffd700]">
        {apiReady ? `Choose Your Card · ${cardCount} remaining` : 'Shuffling your hand…'}
      </motion.p>

      <div className="relative flex items-center justify-center overflow-visible"
        style={{ height: 200, width: '100%', perspective: '900px' }}>
        {Array.from({ length: cardCount }, (_, i) => {
          const offset = i - activeIdx;
          const abs = Math.abs(offset);
          const tx = offset * 76;
          const scale = i === activeIdx ? 1.05 : 1 - abs * 0.07;
          const ry = offset * -14;
          const opacity = abs > 3 ? 0.18 : 1 - abs * 0.15;
          const zIndex = cardCount - abs;
          return (
            <div key={i} className="absolute cursor-pointer"
              style={{
                width: 92, height: 130,
                left: '50%', top: '50%',
                marginLeft: -46, marginTop: -65,
                transform: `translateX(${tx}px) rotateY(${ry}deg) scale(${scale})`,
                opacity,
                zIndex,
                transition: 'transform 0.38s cubic-bezier(0.34,1.4,0.64,1), opacity 0.38s ease',
              }}
              onClick={() => setActiveIdx(i)}>
              <CardBack glow={i === activeIdx} glowColor="#ffd700" imageUrl={CARD_BACK_URL} />
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-5">
        <button onClick={() => setActiveIdx(p => Math.max(0, p - 1))} disabled={activeIdx === 0}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/55 transition-all hover:border-[#ffd700]/55 hover:text-[#ffd700] disabled:opacity-25">
          <ChevronLeft size={16} />
        </button>
        <div className="flex gap-2">
          {Array.from({ length: cardCount }, (_, i) => (
            <button key={i} onClick={() => setActiveIdx(i)}
              className="rounded-full transition-all"
              style={{ height: 8, width: i === activeIdx ? 20 : 8, background: i === activeIdx ? '#ffd700' : 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>
        <button onClick={() => setActiveIdx(p => Math.min(cardCount - 1, p + 1))} disabled={activeIdx === cardCount - 1}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/55 transition-all hover:border-[#ffd700]/55 hover:text-[#ffd700] disabled:opacity-25">
          <ChevronRight size={16} />
        </button>
      </div>

      <motion.button onClick={() => apiReady && onSelect()} disabled={!apiReady}
        whileHover={apiReady ? { scale: 1.05 } : undefined}
        whileTap={apiReady ? { scale: 0.95 } : undefined}
        className="rounded-xl px-8 py-3 font-display text-sm font-bold uppercase tracking-widest transition-all"
        style={apiReady
          ? { background: 'linear-gradient(90deg, #ffd700, #ff9500)', color: '#000', boxShadow: '0 0 24px rgba(255,165,0,0.45)' }
          : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
        {apiReady ? 'Reveal This Card' : 'Fetching…'}
      </motion.button>
    </div>
  );
}

// ── VaultPack — inline slide-to-tear, uses pack.imageUrl ─────────────────────

function VaultPack({ pack, color, onDrag, onDragEnd }: {
  pack: PackCatalog; color: string;
  onDrag: (dx: number) => void; onDragEnd: (dx: number) => void;
}) {
  const [dragX, setDragX] = useState(0);
  const dragProgress = Math.min(1, Math.max(0, dragX / SLIDE_TRACK_MAX));

  const handleDrag = (_e: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
    const dx = Math.max(0, info.offset.x);
    setDragX(dx);
    onDrag(dx);
  };
  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
    const dx = Math.max(0, info.offset.x);
    onDragEnd(dx);
    setDragX(0);
  };

  return (
    <div className="relative mx-auto h-[290px] w-[210px] sm:h-[330px] sm:w-[240px]">
      {/* Pack image — no wrapper border, just the art */}
      {pack.imageUrl
        ? <img src={pack.imageUrl} alt={pack.name} className="absolute inset-0 h-full w-full object-cover rounded-[22px]" draggable={false} />
        : (
          <div className="absolute inset-0 rounded-[22px]"
            style={{ background: 'linear-gradient(145deg, #202036, #080910 65%)' }}>
            <div className="absolute left-1/2 top-12 -translate-x-1/2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#ffd700]">PocketPull</p>
              <p className="mt-2 font-display text-3xl uppercase tracking-widest text-white">VAULT</p>
              <div className="mx-auto mt-4 h-px w-20 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent" />
            </div>
            <div className="absolute bottom-20 left-0 right-0 text-center">
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-[#ffd700]/50 text-[#ffd700]">
                <LockKeyhole size={14} />
              </div>
            </div>
          </div>
        )}

      {/* Slide-to-tear overlay at top — no border, blends into image */}
      <div className="absolute top-0 left-0 right-0 z-10 rounded-t-[22px] px-3 py-3"
        style={{ background: 'rgba(0,0,0,0.68)' }}>
        {/* Track rail */}
        <div className="relative h-9 w-full overflow-hidden rounded-full bg-white/10">
          {/* Fill */}
          <div className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-[#ffd700]/25 transition-none"
            style={{ width: `${dragProgress * 100}%` }} />
          {/* Label */}
          {dragProgress < 0.15 && (
            <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.32em] text-white/40">
              slide → tear
            </span>
          )}
          {/* Draggable handle */}
          <motion.div
            drag="x"
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={{ left: 0, right: SLIDE_TRACK_MAX }}
            className="absolute left-0.5 top-0.5 flex h-8 w-10 cursor-grab items-center justify-center rounded-full bg-[#ffd700] text-black shadow-[0_0_14px_rgba(255,215,0,0.65)] active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            aria-label="Slide to tear the vault seal open"
          >
            <GripHorizontal size={14} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ── Burst container — GSAP stagger ───────────────────────────────────────────

const BURST_SLOTS = Array.from({ length: 6 }, (_, i) => {
  const angle = (i / 6) * Math.PI * 2 - Math.PI / 2 + (i % 2 === 0 ? 0.3 : -0.3);
  return {
    x: Math.round(Math.cos(angle) * (92 + (i % 3) * 24)),
    y: Math.round(Math.sin(angle) * (72 + (i % 3) * 18)),
    rotate: -22 + i * 14,
  };
});

function BurstCards({ burstRef }: { burstRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={burstRef} className="pointer-events-none relative flex items-center justify-center overflow-visible" style={{ height: 310 }}>
      <div data-flash className="absolute inset-0 rounded-2xl opacity-0"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.1) 55%, transparent 72%)' }} />
      <ShockRing color="#ffd700" size={240} />
      <ShockRing color="#ffd700" size={240} delay={0.1} thickness={1} />
      <VaultParticles color="#ffd700" burst />
      {BURST_SLOTS.map((s, i) => (
        <div key={i} data-burst
          data-bx={s.x} data-by={s.y} data-br={s.rotate}
          className="absolute opacity-0"
          style={{ width: 64, height: 90, left: '50%', marginLeft: -32, top: '50%', marginTop: -45 }}>
          <CardBack imageUrl={CARD_BACK_URL} />
        </div>
      ))}
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
  const ripFiredRef = useRef(false);
  const availableCards = cards.filter(c => (c.quantity ?? 1) > 0);
  const cardCount = Math.min(CARD_COUNT_MAX, Math.max(1, availableCards.length));
  // Snapshot the count at rip time — the API decrements one card's quantity
  // before the carousel renders, so the reactive cardCount would show N-1.
  const snapCardCountRef = useRef(cardCount);

  // GSAP refs
  const packWrapRef = useRef<HTMLDivElement>(null);
  const burstRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPhase('idle'); setWonCard(null); setApiReady(false); setError(null);
    ripFiredRef.current = false;
  }, [pack.id]);

  // ── GSAP: pack shake + exit on ripping ──────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ripping' || !packWrapRef.current) return;
    const el = packWrapRef.current;
    gsap.killTweensOf(el);

    const tl = gsap.timeline();
    // Punchy organic shake
    tl.to(el, { x: -9, duration: 0.055, ease: 'power2.out' })
      .to(el, { x: 13, duration: 0.07, ease: 'power2.inOut' })
      .to(el, { x: -16, rotate: -3.5, duration: 0.07, ease: 'power2.inOut' })
      .to(el, { x: 18, rotate: 4.5, scale: 1.05, duration: 0.065, ease: 'power2.inOut' })
      .to(el, { x: -12, rotate: -3, scale: 1.07, duration: 0.065, ease: 'power2.inOut' })
      .to(el, { x: 9, rotate: 2, scale: 1.1, duration: 0.06, ease: 'power2.inOut' })
      .to(el, { x: 0, rotate: 0, scale: 1.12, duration: 0.09, ease: 'back.out(2)' })
      // Brief hold, then blast off
      .to(el, { y: -70, scale: 1.35, opacity: 0, duration: 0.22, delay: 0.1, ease: 'back.in(1.8)' });

    return () => { tl.kill(); };
  }, [phase]);

  // ── GSAP: burst card fly-out with stagger ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'bursting' || !burstRef.current) return;
    const container = burstRef.current;
    const cardEls = container.querySelectorAll<HTMLElement>('[data-burst]');
    const flashEl = container.querySelector<HTMLElement>('[data-flash]');

    gsap.set(cardEls, { x: 0, y: 0, rotation: 0, scale: 0.15, opacity: 0 });

    // Flash first
    if (flashEl) {
      gsap.to(flashEl, { opacity: 1, duration: 0.1, ease: 'power2.in' });
      gsap.to(flashEl, { opacity: 0, duration: 0.25, delay: 0.1, ease: 'power2.out' });
    }

    // Cards burst out with physics stagger
    gsap.to(cardEls, {
      x: (_i: number, el: Element) => Number((el as HTMLElement).getAttribute('data-bx')),
      y: (_i: number, el: Element) => Number((el as HTMLElement).getAttribute('data-by')),
      rotation: (_i: number, el: Element) => Number((el as HTMLElement).getAttribute('data-br')),
      scale: 0.92,
      opacity: 1,
      duration: 0.62,
      stagger: { each: 0.042, from: 'center' },
      ease: 'power3.out',
      delay: 0.06,
    });

    return () => { gsap.killTweensOf(cardEls); };
  }, [phase]);

  // ── Async pack open flow ─────────────────────────────────────────────────────
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
    snapCardCountRef.current = cardCount; // snapshot before API/query updates reduce it
    setError(null);
    setPhase('ripping');

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

    await wait(800);   // GSAP shake + exit finishes (~0.72s)
    setPhase('bursting');
    await wait(920);   // burst + fly-out
    setPhase('carousel');
  }, [isAuthenticated, user?.id, pack, balance, matchedBalance, updateBalance, onComplete, qc]);

  const handleCardSelect = useCallback(() => {
    if (!wonCard || !apiReady || phase !== 'carousel') return;
    setPhase('flipping');
  }, [wonCard, apiReady, phase]);

  const handleFlipDone = useCallback(() => {
    setPhase('reveal');
    setTimeout(() => setPhase('result'), 1150);
  }, []);

  const handleDrag = useCallback((offsetX: number) => {
    if (offsetX >= DRAG_THRESHOLD && !ripFiredRef.current) startRip();
  }, [startRip]);

  const handleDragEnd = useCallback((offsetX: number) => {
    if (offsetX >= DRAG_THRESHOLD && !ripFiredRef.current) startRip();
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
        <div className="mt-3 text-white font-display text-2xl">
          Collected {collectedTotal}<span style={{ fontFamily: 'Inter, system-ui, sans-serif', opacity: 0.55, margin: '0 4px' }}>/</span>{originalTotal}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-[#ffd700] to-[#9b5cff] transition-all"
            style={{ width: `${originalTotal ? (collectedTotal / originalTotal) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Animation panel */}
      {!isVaulted && phase !== 'result' && (
        <div className="relative overflow-hidden rounded-2xl border border-[#ffd700]/20 bg-[#090a12] px-4 pb-8 pt-10 text-center" style={{ minHeight: 440 }}>
          <div className="relative z-10">

            {/* Pack idle — GSAP shake wraps the pack */}
            {(phase === 'idle' || phase === 'ripping') && (
              <div ref={packWrapRef} style={{ willChange: 'transform' }}>
                <VaultPack pack={pack} color={color} onDrag={handleDrag} onDragEnd={handleDragEnd} />
              </div>
            )}

            {/* Burst */}
            {phase === 'bursting' && <BurstCards burstRef={burstRef} />}

            {/* Carousel — GSAP handled inside component */}
            {phase === 'carousel' && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }}>
                <CardCarousel onSelect={handleCardSelect} apiReady={apiReady} cardCount={snapCardCountRef.current} />
              </motion.div>
            )}

            {/* 3D Flip via R3F */}
            {phase === 'flipping' && wonCard && (
              <motion.div initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
                <Card3DFlip card={wonCard} colorHex={color} tier={tier} cardBackUrl={CARD_BACK_URL} onDone={handleFlipDone} />
              </motion.div>
            )}

            {/* Reveal — static face + Framer Motion VFX */}
            {phase === 'reveal' && wonCard && (
              <motion.div className="relative mx-auto" style={{ width: 164, height: 240 }}
                initial={{ opacity: 1 }}>
                <RarityVFX tier={tier} color={color} />
                <motion.div className="relative z-10 h-full w-full"
                  animate={{ scale: [1, 1.07, 1] }} transition={{ duration: 0.5 }}>
                  <CardFace card={wonCard} color={color} shineDelay={0.1} shineOpacity={0.9}
                    holographic={isBigPull} glowSize={55} />
                </motion.div>
              </motion.div>
            )}

            {/* Status label */}
            <AnimatePresence mode="wait">
              {(phase === 'idle' || phase === 'ripping' || phase === 'bursting') && (
                <motion.p key={statusLabel || 'idle'}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-[#ffd700]">
                  {statusLabel || 'Slide the tab to tear open the vault'}
                </motion.p>
              )}
            </AnimatePresence>

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
            transition={{ duration: 0.3 }}>
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
