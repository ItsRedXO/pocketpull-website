import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { useLiveCounters } from '../hooks/useLiveCounters';
import { useAuth, useUserStats } from '../hooks/useAuth';
import { useHeroCardPositions } from '../hooks/useSiteConfig';

// ── Animated counter via RAF ──────────────────────────────────────────────────
function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  duration = 2.2,
  preserveAnimation = false,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  preserveAnimation?: boolean;
}) {
  const [count, setCount] = useState(0);
  const [prevValue, setPrevValue] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    const initialValue = preserveAnimation ? prevValue : 0;
    const diff = value - initialValue;

    const raf = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(initialValue + (eased * diff)));
      if (progress < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    setPrevValue(value);
  }, [value, duration, preserveAnimation]);

  return <span>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ── Pokémon card showcase data ────────────────────────────────────────────────
interface ShowcaseCard {
  name: string;
  set: string;
  rarity: string;
  art: string;
  glowColor: string;
  glowColor2: string;
  rotate: number;
  floatDuration: number;
  floatDelay: number;
  floatAmount: number;
  entranceDelay: number;
  zIndex: number;
  imageUrl: string;
}

const SHOWCASE_CARDS: ShowcaseCard[] = [
  {
    name: 'Umbreon VMAX',
    set: 'Alt Art · Moonbreon',
    rarity: 'SECRET RARE',
    art: '🌙',
    glowColor: '#7c3aed',
    glowColor2: '#3b82f6',
    rotate: -7,
    floatDuration: 6.4,
    floatDelay: 0,
    floatAmount: 16,
    entranceDelay: 0.5,
    zIndex: 25,
    imageUrl: 'https://images.pokemontcg.io/swsh7/215_hires.png',
  },
  {
    name: "Giovanni's Mewtwo",
    set: 'Gym Heroes · Holo',
    rarity: 'GOD PULL',
    art: '💜',
    glowColor: '#a21caf',
    glowColor2: '#6b21a8',
    rotate: -3,
    floatDuration: 8.0,
    floatDelay: 2.0,
    floatAmount: 12,
    entranceDelay: 0.7,
    zIndex: 35,
    imageUrl: 'https://images.pokemontcg.io/gym2/14_hires.png',
  },
  {
    name: 'Charizard',
    set: 'Base Set · 1st Edition',
    rarity: 'HOLO RARE',
    art: '🔥',
    glowColor: '#f97316',
    glowColor2: '#dc2626',
    rotate: 5,
    floatDuration: 7.2,
    floatDelay: 3.6,
    floatAmount: 14,
    entranceDelay: 0.9,
    zIndex: 20,
    imageUrl: 'https://images.pokemontcg.io/base1/4_hires.png',
  },
];

// ── Floating Pokémon Card ─────────────────────────────────────────────────────
function FloatingCard({
  card,
  position,
  editMode = false,
  onPointerDown,
}: {
  card: ShowcaseCard;
  position: { left: number; top: number };
  editMode?: boolean;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const isGod = card.rarity === 'GOD PULL';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 44 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 1.0, delay: editMode ? 0 : card.entranceDelay, ease: [0.16, 1, 0.3, 1] }}
      className="absolute"
      onPointerDown={onPointerDown}
      style={{ left: `${position.left}%`, top: `${position.top}%`, zIndex: card.zIndex }}
    >
      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: '-20px',
          borderRadius: '24px',
          background: `radial-gradient(ellipse at 30% 50%, ${card.glowColor}55 0%, ${card.glowColor2}25 40%, transparent 70%)`,
          filter: 'blur(16px)',
          zIndex: -1,
        }}
      />

      {editMode && (
        <div
          className="absolute inset-0 rounded-[14px] z-50 pointer-events-none"
          style={{
            border: '2px dashed rgba(255,255,255,0.5)',
            boxShadow: '0 0 12px rgba(255,255,255,0.15)',
          }}
        />
      )}

      <motion.div
        animate={editMode ? { y: 0 } : { y: [0, -card.floatAmount, 0] }}
        transition={editMode ? {} : { duration: card.floatDuration, repeat: Infinity, ease: 'easeInOut', delay: card.floatDelay }}
        className="relative select-none"
        style={{
          width: '156px',
          height: '218px',
          borderRadius: '14px',
          cursor: editMode ? 'grab' : 'pointer',
          transform: `rotate(${card.rotate}deg)`,
          overflow: 'hidden',
          border: isGod
            ? '1.5px solid transparent'
            : `1.5px solid ${card.glowColor}66`,
          backgroundImage: isGod
            ? `linear-gradient(#0c0814, #0c0814), linear-gradient(135deg, ${card.glowColor}, ${card.glowColor2}, #ff0060, ${card.glowColor})`
            : undefined,
          backgroundOrigin: isGod ? 'border-box' : undefined,
          backgroundClip: isGod ? 'padding-box, border-box' : undefined,
          background: isGod ? undefined : 'linear-gradient(160deg, #0d0f1c 0%, #090b14 100%)',
          boxShadow: isGod
            ? `0 0 30px -6px ${card.glowColor}99, 0 0 60px -20px ${card.glowColor2}66, 0 28px 56px rgba(0,0,0,0.9)`
            : `0 0 24px -6px ${card.glowColor}77, 0 0 48px -16px ${card.glowColor2}55, 0 28px 56px rgba(0,0,0,0.85)`,
        }}
        {...(!editMode && { whileHover: { scale: 1.06, y: -6, zIndex: 50 } })}
      >
        <img
          src={card.imageUrl}
          alt={card.name}
          loading="lazy"
          className="w-full h-full object-cover"
          style={{ display: 'block', borderRadius: '12px', pointerEvents: 'none', userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties}
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = 'none';
            const fallback = el.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        <div
          className="absolute inset-0 items-center justify-center"
          style={{
            display: 'none',
            fontSize: '56px',
            filter: `drop-shadow(0 0 20px ${card.glowColor}99)`,
            background: `linear-gradient(160deg, ${card.glowColor}18 0%, ${card.glowColor2}10 100%)`,
            borderRadius: '12px',
          }}
        >
          {card.art}
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: '12px',
            background: `linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 40%, transparent 60%, ${card.glowColor}0d 100%)`,
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: `linear-gradient(90deg, transparent, ${card.glowColor}, transparent)`, borderRadius: '0 0 12px 12px' }}
        />
      </motion.div>
    </motion.div>
  );
}

// ── Hero Section ──────────────────────────────────────────────────────────────
export const HeroSection: React.FC = () => {
  const { packsOpened, cardsWonToday, biggestPull, livePlayers } = useLiveCounters();
  const { user } = useAuth();
  const { stats } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const isAdmin = stats?.role === 'admin';

  const { positions: savedPositions, savePositions, isSaving } = useHeroCardPositions();

  const [isEditMode, setIsEditMode] = useState(false);
  const [editPositions, setEditPositions] = useState<Array<{ left: number; top: number }>>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sectionRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ cardIdx: number; offsetX: number; offsetY: number } | null>(null);

  const activePositions = isEditMode
    ? editPositions
    : savedPositions.map(p => ({ left: p.left, top: p.top }));

  const enterEditMode = () => {
    setSaveError(null);
    setEditPositions(savedPositions.map(p => ({ left: p.left, top: p.top })));
    setIsEditMode(true);
  };

  const cancelEditMode = () => {
    dragRef.current = null;
    setIsEditMode(false);
  };

  const handleSave = async () => {
    try {
      setSaveError(null);
      await savePositions(
        SHOWCASE_CARDS.map((card, i) => ({
          name: card.name,
          left: editPositions[i]?.left ?? savedPositions[i]?.left ?? 0,
          top: editPositions[i]?.top ?? savedPositions[i]?.top ?? 0,
        }))
      );
      setIsEditMode(false);
    } catch {
      setSaveError('Save failed — check your connection.');
    }
  };

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, cardIdx: number) => {
    if (!sectionRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const section = sectionRef.current.getBoundingClientRect();
    const pos = editPositions[cardIdx] ?? savedPositions[cardIdx];
    const cardLeftPx = (pos.left / 100) * section.width;
    const cardTopPx = (pos.top / 100) * section.height;
    dragRef.current = {
      cardIdx,
      offsetX: e.clientX - section.left - cardLeftPx,
      offsetY: e.clientY - section.top - cardTopPx,
    };
  }, [editPositions, savedPositions]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current || !sectionRef.current) return;
    e.preventDefault();
    const section = sectionRef.current.getBoundingClientRect();
    const { cardIdx, offsetX, offsetY } = dragRef.current;
    const newLeft = Math.max(0, Math.min(88, ((e.clientX - section.left - offsetX) / section.width) * 100));
    const newTop = Math.max(0, Math.min(80, ((e.clientY - section.top - offsetY) / section.height) * 100));
    setEditPositions(prev => {
      const next = [...prev];
      next[cardIdx] = { left: newLeft, top: newTop };
      return next;
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const liveStats = [
    { label: 'Packs Opened', value: packsOpened, prefix: '', suffix: '+' },
    { label: 'Cards Won Today', value: cardsWonToday, prefix: '', suffix: '' },
    { label: 'Biggest Pull', value: biggestPull, prefix: '$', suffix: '' },
  ];

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{ minHeight: '680px', touchAction: isEditMode ? 'none' : undefined }}
      onPointerMove={isEditMode ? handlePointerMove : undefined}
      onPointerUp={isEditMode ? handlePointerUp : undefined}
      onPointerLeave={isEditMode ? handlePointerUp : undefined}
    >
      {/* Left-to-right gradient: keeps text readable, fades to transparent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(100deg, rgba(8,12,20,0.97) 0%, rgba(8,12,20,0.92) 28%, rgba(8,12,20,0.65) 48%, rgba(8,12,20,0.18) 68%, transparent 100%)',
        }}
      />
      {/* Bottom fade into page */}
      <div
        className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
        style={{ background: 'linear-gradient(to top, #080c14 0%, transparent 100%)' }}
      />

      {/* ── Text content ──────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pt-14 pb-10">
        <motion.div
          initial={{ opacity: 0, x: -48 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.82, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-6"
          style={{ maxWidth: '420px' }}
        >
          {/* Eyebrow pill */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.06]"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-blink-dot" />
            <span className="text-[11px] font-display text-white/85 uppercase tracking-widest">
              LIVE — {livePlayers.toLocaleString()} Players Online
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="font-display leading-[0.92] tracking-tight text-white"
            style={{ fontSize: 'clamp(2.4rem, 5.5vw, 4rem)' }}
          >
            Open Rare Pokémon Packs.<br />
            <span
              className="bg-clip-text text-transparent bg-gradient-to-r from-[#00d4ff] to-[#7c5fff]"
              style={{ filter: 'drop-shadow(0 0 20px rgba(0,212,255,0.7)) drop-shadow(0 0 40px rgba(124,95,255,0.4))' }}
            >
              Chase the God Pull.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.65 }}
            className="text-gray-300/90 text-base md:text-[1.05rem] max-w-lg leading-relaxed"
          >
            Discover ultra-rare cards, compete in pack battles, and upgrade your way to legendary status. Every pack could change everything.
          </motion.p>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="grid grid-cols-3 gap-4 pt-5 border-t border-white/[0.1]"
          >
            {liveStats.map(({ label, value, prefix, suffix }) => (
              <div key={label} className="space-y-1">
                <p
                  className="font-display text-[1.6rem] md:text-[1.9rem] text-[#00d4ff] leading-none"
                  style={{ textShadow: '0 0 16px rgba(0,212,255,0.6)' }}
                >
                  <AnimatedCounter value={value} prefix={prefix} suffix={suffix} preserveAnimation />
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-[0.18em]">{label}</p>
              </div>
            ))}
          </motion.div>

          {/* Admin edit button */}
          {isAdmin && !isEditMode && (
            <button
              onClick={enterEditMode}
              className="inline-flex items-center gap-2 self-start mt-1 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/60 hover:text-white/90 border border-white/10 hover:border-white/25 bg-white/[0.04] hover:bg-white/[0.08] transition-all duration-150"
            >
              <Pencil size={12} />
              Edit Cards
            </button>
          )}
        </motion.div>
      </div>

      {/* ── Floating cards – absolute over full section ────────────────────── */}
      <div className={`absolute inset-0 z-20 hidden lg:block${isEditMode ? '' : ' pointer-events-none'}`}>
        {SHOWCASE_CARDS.map((card, idx) => (
          <FloatingCard
            key={card.name}
            card={card}
            position={activePositions[idx] ?? { left: 0, top: 0 }}
            editMode={isEditMode}
            onPointerDown={isEditMode ? (e) => handlePointerDown(e, idx) : undefined}
          />
        ))}
      </div>

      {/* ── Edit mode: save / cancel bar ─────────────────────────────────── */}
      {isEditMode && (
        <div
          className="absolute bottom-8 left-1/2 z-50 flex items-center gap-3"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/15"
            style={{ background: 'rgba(8,12,20,0.92)', backdropFilter: 'blur(12px)' }}
          >
            <span className="text-[12px] text-white/50 font-medium">Drag cards to reposition</span>
            <div className="w-px h-4 bg-white/15" />
            <button
              onClick={cancelEditMode}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white/70 hover:text-white border border-white/10 hover:border-white/25 bg-white/[0.05] hover:bg-white/[0.1] transition-all duration-150 disabled:opacity-40"
            >
              <X size={13} />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white border border-[#7c3aed]/60 bg-[#7c3aed]/30 hover:bg-[#7c3aed]/50 transition-all duration-150 disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {saveError && (
            <span className="text-[11px] text-red-400">{saveError}</span>
          )}
        </div>
      )}
    </section>
  );
};
