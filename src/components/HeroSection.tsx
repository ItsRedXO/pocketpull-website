import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pack } from '../data/mockData';
import { useLiveCounters } from '../hooks/useLiveCounters';

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
  art: string; // emoji fallback
  glowColor: string;
  glowColor2: string;
  rotate: number;
  floatDuration: number;
  floatDelay: number;
  floatAmount: number;
  entranceDelay: number;
  zIndex: number;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  // Unsplash image URL for card art
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
    floatAmount: 18,
    entranceDelay: 0.5,
    zIndex: 30,
    position: { left: '0%', top: '2%' },
    imageUrl: 'https://images.pokemontcg.io/swsh7/215_hires.png',
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
    floatDelay: 1.6,
    floatAmount: 14,
    entranceDelay: 0.7,
    zIndex: 20,
    position: { right: '0%', top: '8%' },
    imageUrl: 'https://images.pokemontcg.io/base1/4_hires.png',
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
    floatDelay: 3.2,
    floatAmount: 12,
    entranceDelay: 0.9,
    zIndex: 10,
    position: { left: '18%', bottom: '4%' },
    imageUrl: 'https://images.pokemontcg.io/gym2/14_hires.png',
  },
];

// ── Floating Pokémon Card ─────────────────────────────────────────────────────
function FloatingCard({ card }: { card: ShowcaseCard }) {
  const isGod = card.rarity === 'GOD PULL';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 44 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 1.0, delay: card.entranceDelay, ease: [0.16, 1, 0.3, 1] }}
      className="absolute"
      style={{ ...card.position, zIndex: card.zIndex }}
    >
      {/* Ambient glow behind card */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: '-20px',
          borderRadius: '24px',
          background: `radial-gradient(ellipse at 30% 50%, ${card.glowColor}40 0%, ${card.glowColor2}20 40%, transparent 70%)`,
          filter: 'blur(16px)',
          zIndex: -1,
        }}
      />

      <motion.div
        animate={{ y: [0, -card.floatAmount, 0] }}
        transition={{ duration: card.floatDuration, repeat: Infinity, ease: 'easeInOut', delay: card.floatDelay }}
        className="relative cursor-pointer select-none"
        style={{
          width: '156px',
          height: '218px',
          borderRadius: '14px',
          transform: `rotate(${card.rotate}deg)`,
          overflow: 'hidden',
          position: 'relative',
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
            ? `0 0 30px -6px ${card.glowColor}88, 0 0 60px -20px ${card.glowColor2}55, 0 24px 48px rgba(0,0,0,0.8)`
            : `0 0 24px -6px ${card.glowColor}66, 0 0 48px -16px ${card.glowColor2}44, 0 24px 48px rgba(0,0,0,0.75)`,
        }}
        whileHover={{ scale: 1.06, y: -6, zIndex: 50 }}
      >
        {/* Full card image — fills the entire card face */}
        <img
          src={card.imageUrl}
          alt={card.name}
          loading="lazy"
          className="w-full h-full object-cover"
          style={{ display: 'block', borderRadius: '12px' }}
          onError={(e) => {
            // Fallback to emoji art if image fails
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = 'none';
            const fallback = el.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        {/* Emoji fallback (hidden by default) */}
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

        {/* Subtle shimmer overlay over the card image */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: '12px',
            background: `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 40%, transparent 60%, ${card.glowColor}0d 100%)`,
          }}
        />
        {/* Bottom glow line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: `linear-gradient(90deg, transparent, ${card.glowColor}, transparent)`, borderRadius: '0 0 12px 12px' }}
        />
      </motion.div>
    </motion.div>
  );
}

// ── Hero Section ──────────────────────────────────────────────────────────────
interface HeroSectionProps {
  onPackOpen: (pack: Pack) => void;
  onPageChange: (page: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onPackOpen: _onPackOpen, onPageChange: _onPageChange }) => {
  const { packsOpened, cardsWonToday, biggestPull, livePlayers } = useLiveCounters();

  const liveStats = [
    { label: 'Packs Opened', value: packsOpened, prefix: '', suffix: '+' },
    { label: 'Cards Won Today', value: cardsWonToday, prefix: '', suffix: '' },
    { label: 'Biggest Pull', value: biggestPull, prefix: '$', suffix: '' },
  ];

  return (
    <section
      className="relative overflow-hidden pt-6 pb-0"
      style={{ backgroundColor: '#0a0b0f' }}
    >
      {/* ── Background glows ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute" style={{ left: '-8%', top: '5%', width: '50%', height: '80%', background: 'radial-gradient(ellipse at 30% 50%, rgba(155,92,255,0.09) 0%, transparent 65%)' }} />
        <div className="absolute" style={{ right: '-4%', top: '0', width: '48%', height: '60%', background: 'radial-gradient(ellipse at 70% 30%, rgba(0,200,255,0.07) 0%, transparent 60%)' }} />
        <div className="absolute" style={{ right: '10%', bottom: '10%', width: '30%', height: '40%', background: 'radial-gradient(ellipse at center, rgba(255,215,0,0.04) 0%, transparent 70%)' }} />
        <div
          className="absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-[52%_48%] gap-8 lg:gap-4 items-center">

        {/* ── LEFT: Copy ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -48 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.82, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-6"
        >
          {/* Eyebrow pill */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04]"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-blink-dot" />
            <span className="text-[11px] font-display text-white/80 uppercase tracking-widest">
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
              className="bg-clip-text text-transparent bg-gradient-to-r from-[#00c8ff] to-[#9b5cff]"
              style={{ filter: 'drop-shadow(0 0 20px rgba(0,200,255,0.6)) drop-shadow(0 0 40px rgba(155,92,255,0.35))' }}
            >
              Chase the God Pull.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.65 }}
            className="text-gray-400 text-base md:text-[1.05rem] max-w-lg leading-relaxed"
          >
            Discover ultra-rare cards, compete in pack battles, and upgrade your way to legendary status. Every pack could change everything.
          </motion.p>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="grid grid-cols-3 gap-4 pt-5 border-t border-white/[0.06]"
          >
            {liveStats.map(({ label, value, prefix, suffix }) => (
              <div key={label} className="space-y-1">
                <p className="font-display text-[1.6rem] md:text-[1.9rem] text-[#00c8ff] leading-none" style={{ textShadow: '0 0 16px rgba(0,200,255,0.5)' }}>
                  <AnimatedCounter value={value} prefix={prefix} suffix={suffix} preserveAnimation />
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-[0.18em]">{label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* ── RIGHT: Pokémon Card Showcase ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 48 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.82, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:block"
        >
          {/* Cards area */}
          <div className="relative" style={{ height: '340px' }}>
            {/* Background orb */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: '10%', top: '10%', width: '75%', height: '70%',
                background: 'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, rgba(59,130,246,0.07) 45%, transparent 70%)',
                filter: 'blur(24px)',
              }}
            />
            <div
              className="absolute pointer-events-none"
              style={{
                right: '8%', bottom: '8%', width: '45%', height: '45%',
                background: 'radial-gradient(ellipse, rgba(249,115,22,0.08) 0%, transparent 70%)',
                filter: 'blur(18px)',
              }}
            />

            {SHOWCASE_CARDS.map((card) => (
              <FloatingCard key={card.name} card={card} />
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
};
