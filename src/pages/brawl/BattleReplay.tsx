import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useAnimate } from 'framer-motion';
import { Play, Pause, FastForward, X, Skull, Trophy, Coins, Clock } from 'lucide-react';
import type { ArenaAttackEvent, ArenaFrame, ArenaObstacle, BrawlMatchResult, Effectiveness } from '../../lib/brawlApi';
import { typeColor } from './typeColors';

const EFFECTIVENESS_LABEL: Record<string, string> = { immune: 'No effect', 'not-very-effective': 'Not very effective', neutral: '', 'super-effective': 'Super effective!' };
const EFFECTIVENESS_COLOR: Record<string, string> = { immune: '#8892a4', 'not-very-effective': '#a8a878', neutral: '#ffffff', 'super-effective': '#f8d030' };
const BASE_TICK_MS = 300;
const MELEE_VISUAL_THRESHOLD = 12;

const TYPE_PARTICLES: Record<string, string> = {
  normal: '💫', fire: '🔥', water: '💧', electric: '⚡', grass: '🍃', ice: '❄️',
  fighting: '👊', poison: '🧪', ground: '💨', flying: '🌪️', psychic: '🔮', bug: '🐛',
  rock: '🪨', ghost: '👻', dragon: '🐉', dark: '🌑', steel: '⚙️', fairy: '✨',
};

interface ArenaTheme {
  key: string; background: string; vignette: string; obstacleFill: [string, string]; obstacleBorder: string;
  particle: string; particleCount: number; direction: 'up' | 'down';
}
const ARENA_THEMES: ArenaTheme[] = [
  { key: 'water', background: 'radial-gradient(130% 110% at 50% 0%, rgba(0,180,255,0.22) 0%, rgba(6,22,40,0.92) 55%, rgba(3,10,20,0.97) 100%)', vignette: '#22c4ff', obstacleFill: ['#0e4a66', '#0a3450'], obstacleBorder: 'rgba(80,200,255,0.35)', particle: '💧', particleCount: 9, direction: 'up' },
  { key: 'fire', background: 'radial-gradient(130% 110% at 50% 100%, rgba(255,110,30,0.26) 0%, rgba(40,12,7,0.92) 55%, rgba(16,5,4,0.97) 100%)', vignette: '#ff7b3d', obstacleFill: ['#4a2214', '#2c130b'], obstacleBorder: 'rgba(255,140,60,0.4)', particle: '🔥', particleCount: 7, direction: 'up' },
  { key: 'grass', background: 'radial-gradient(130% 110% at 50% 0%, rgba(90,220,110,0.2) 0%, rgba(8,30,15,0.92) 55%, rgba(4,14,8,0.97) 100%)', vignette: '#5adc6e', obstacleFill: ['#254d2c', '#173420'], obstacleBorder: 'rgba(120,230,140,0.35)', particle: '🍃', particleCount: 8, direction: 'down' },
  { key: 'electric', background: 'radial-gradient(130% 110% at 50% 0%, rgba(250,220,50,0.18) 0%, rgba(32,13,46,0.92) 55%, rgba(14,6,22,0.97) 100%)', vignette: '#facc15', obstacleFill: ['#3a3054', '#241c38'], obstacleBorder: 'rgba(250,220,80,0.35)', particle: '⚡', particleCount: 6, direction: 'up' },
  { key: 'ice', background: 'radial-gradient(130% 110% at 50% 0%, rgba(160,230,255,0.22) 0%, rgba(10,30,44,0.92) 55%, rgba(4,14,22,0.97) 100%)', vignette: '#a6e6ff', obstacleFill: ['#274a5c', '#183140'], obstacleBorder: 'rgba(180,235,255,0.4)', particle: '❄️', particleCount: 9, direction: 'down' },
  { key: 'rock', background: 'radial-gradient(130% 110% at 50% 100%, rgba(190,150,100,0.18) 0%, rgba(32,25,18,0.92) 55%, rgba(14,11,8,0.97) 100%)', vignette: '#c8a06a', obstacleFill: ['#4a3c2a', '#2e2418'], obstacleBorder: 'rgba(200,165,110,0.35)', particle: '💨', particleCount: 5, direction: 'up' },
  { key: 'ghost', background: 'radial-gradient(130% 110% at 50% 0%, rgba(150,90,220,0.24) 0%, rgba(20,11,32,0.94) 55%, rgba(8,4,16,0.98) 100%)', vignette: '#a56aff', obstacleFill: ['#3a2a52', '#221934'], obstacleBorder: 'rgba(180,140,255,0.4)', particle: '👻', particleCount: 5, direction: 'up' },
  { key: 'beach', background: 'radial-gradient(130% 110% at 50% 100%, rgba(255,214,140,0.24) 0%, rgba(42,33,17,0.88) 55%, rgba(18,14,8,0.96) 100%)', vignette: '#ffd68c', obstacleFill: ['#5c4a2a', '#3a2f1a'], obstacleBorder: 'rgba(255,220,160,0.4)', particle: '✨', particleCount: 6, direction: 'down' },
];

function ArenaAmbience({ theme }: { theme: ArenaTheme }) {
  const particles = useMemo(() => Array.from({ length: theme.particleCount }, () => ({
    x: Math.random() * 100, delay: Math.random() * 5, duration: 7 + Math.random() * 6, size: 10 + Math.random() * 9, drift: (Math.random() - 0.5) * 30,
  })), [theme.key]);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <motion.div key={i} className="absolute select-none" style={{ left: `${p.x}%`, fontSize: p.size, ...(theme.direction === 'up' ? { bottom: -24 } : { top: -24 }) }}
          animate={{ y: theme.direction === 'up' ? [0, -420] : [0, 420], x: [0, p.drift], opacity: [0, 0.7, 0.7, 0] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}>
          {theme.particle}
        </motion.div>
      ))}
    </div>
  );
}

function MoveBurst({ attack }: { attack: ArenaAttackEvent }) {
  const emoji = TYPE_PARTICLES[attack.moveType] || '💫';
  const big = attack.effectiveness === 'super-effective';
  const weak = attack.effectiveness === 'not-very-effective';
  const immune = attack.effectiveness === 'immune';
  const count = immune ? 0 : big ? 7 : weak ? 3 : 5;
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = (big ? 5 : weak ? 2.2 : 3.5) + Math.random() * 2;
    return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, delay: Math.random() * 0.06, rotate: (Math.random() - 0.5) * 120 };
  }), [count, big, weak]);

  if (immune) {
    return (
      <motion.div className="absolute pointer-events-none select-none" style={{ left: `${attack.toX}%`, top: `${attack.toY}%`, marginLeft: -8, marginTop: -8, fontSize: 15 }}
        initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: [0, 1, 0], scale: 1 }} transition={{ duration: 0.5 }}>
        🛡️
      </motion.div>
    );
  }

  return (
    <>
      {particles.map((p, i) => (
        <motion.div key={i} className="absolute pointer-events-none select-none"
          style={{ left: `${attack.toX}%`, top: `${attack.toY}%`, marginLeft: big ? -8 : -6, marginTop: big ? -8 : -6, fontSize: big ? 15 : weak ? 9 : 12 }}
          initial={{ opacity: 0.95, left: `${attack.toX}%`, top: `${attack.toY}%`, scale: 0.6, rotate: 0 }}
          animate={{ opacity: 0, left: `${attack.toX + p.dx}%`, top: `${attack.toY + p.dy}%`, scale: 1, rotate: p.rotate }}
          transition={{ duration: big ? 0.55 : 0.4, delay: p.delay, ease: 'easeOut' }}>
          {emoji}
        </motion.div>
      ))}
      <motion.div className="absolute pointer-events-none font-black tabular-nums"
        style={{ left: `${attack.toX}%`, top: `${attack.toY}%`, marginLeft: -10, color: EFFECTIVENESS_COLOR[attack.effectiveness], fontSize: big ? 13 : 10, textShadow: '0 1px 3px rgba(0,0,0,.85)' }}
        initial={{ opacity: 0, y: 0 }} animate={{ opacity: [0, 1, 0], y: -16 }} transition={{ duration: 0.7 }}>
        -{attack.damage}
      </motion.div>
      {/* #4 — SUPER EFFECTIVE! text */}
      {big && (
        <motion.div className="absolute pointer-events-none font-black uppercase select-none"
          style={{ left: `${attack.toX}%`, top: `${attack.toY}%`, marginLeft: -42, marginTop: -22, fontSize: 11, color: '#f8d030', textShadow: '0 0 8px #f8d03088, 0 1px 2px rgba(0,0,0,0.9)', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}
          initial={{ opacity: 0, y: 0, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], y: -14, scale: [0.6, 1.15, 1] }}
          transition={{ duration: 0.85 }}>
          Super effective!
        </motion.div>
      )}
    </>
  );
}

function RangedBeam({ attack }: { attack: ArenaAttackEvent }) {
  const color = typeColor(attack.moveType);
  return (
    <>
      <motion.line x1={attack.fromX} y1={attack.fromY} x2={attack.toX} y2={attack.toY}
        initial={{ opacity: 0.55 }} animate={{ opacity: 0 }} transition={{ duration: 0.32, ease: 'easeOut' }}
        stroke={color} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ filter: 'blur(2.5px)' }} />
      <motion.line x1={attack.fromX} y1={attack.fromY} x2={attack.toX} y2={attack.toY}
        initial={{ opacity: 0.95 }} animate={{ opacity: 0 }} transition={{ duration: 0.32, ease: 'easeOut' }}
        stroke="#ffffff" strokeWidth={0.9} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </>
  );
}

function RangedProjectile({ attack, tickSeconds }: { attack: ArenaAttackEvent; tickSeconds: number }) {
  const color = typeColor(attack.moveType);
  const duration = Math.min(0.26, Math.max(0.12, tickSeconds * 0.7));
  return (
    <motion.div className="absolute rounded-full pointer-events-none"
      style={{ width: 7, height: 7, marginLeft: -3.5, marginTop: -3.5, background: color, boxShadow: `0 0 10px 3px ${color}` }}
      initial={{ left: `${attack.fromX}%`, top: `${attack.fromY}%`, opacity: 0.9, scale: 0.6 }}
      animate={{ left: `${attack.toX}%`, top: `${attack.toY}%`, opacity: [0.9, 1, 0], scale: [0.6, 1, 0.7] }}
      transition={{ duration, ease: 'easeIn' }} />
  );
}

function MeleeAttackVisual({ attack }: { attack: ArenaAttackEvent }) {
  const color = typeColor(attack.moveType);
  return (
    <motion.div className="absolute pointer-events-none" style={{ left: `${attack.toX}%`, top: `${attack.toY}%`, marginLeft: -14, marginTop: -14, width: 28, height: 28 }}
      initial={{ opacity: 0, scale: 0.3, rotate: -25 }} animate={{ opacity: [0, 1, 0], scale: [0.3, 1.25, 1], rotate: 20 }} transition={{ duration: 0.28 }}>
      <svg viewBox="0 0 28 28" className="w-full h-full">
        <line x1="4" y1="21" x2="24" y2="7" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <line x1="6" y1="14" x2="22" y2="4" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
      </svg>
    </motion.div>
  );
}

function ImpactRing({ attack }: { attack: ArenaAttackEvent }) {
  const color = typeColor(attack.moveType);
  const big = attack.effectiveness === 'super-effective';
  const size = big ? 42 : 26;
  return (
    <motion.div className="absolute rounded-full pointer-events-none" style={{ left: `${attack.toX}%`, top: `${attack.toY}%`, border: `2px solid ${color}` }}
      initial={{ width: 4, height: 4, marginLeft: -2, marginTop: -2, opacity: 0.9 }}
      animate={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }} />
  );
}

function HitFlash({ effectiveness }: { effectiveness: Effectiveness }) {
  const color = EFFECTIVENESS_COLOR[effectiveness];
  return (
    <motion.div className="absolute inset-0 rounded-full pointer-events-none"
      style={{ boxShadow: `0 0 0 2px ${color}` }}
      initial={{ opacity: 0.9, scale: 1 }} animate={{ opacity: 0, scale: 1.7 }} transition={{ duration: 0.4 }} />
  );
}

// #1 — VFX routing by move's vfx key
function getVfxCategory(vfx: string | undefined): string {
  if (!vfx) return 'default';
  if (['earthquake', 'mud-slap', 'rock-slide', 'rock-throw'].includes(vfx)) return 'ground';
  if (['thunderbolt', 'spark', 'thunder'].includes(vfx)) return 'lightning';
  if (['blizzard', 'ice-shard', 'powder-snow', 'ice-beam'].includes(vfx)) return 'ice';
  if (['hyper-voice', 'psychic', 'confusion', 'moonblast', 'solar-beam', 'shadow-ball'].includes(vfx)) return 'rings';
  if (['aerial-ace', 'gust', 'fairy-wind'].includes(vfx)) return 'wind';
  return 'default';
}

function VfxOverlay({ attack }: { attack: ArenaAttackEvent }) {
  const cat = getVfxCategory(attack.vfx);
  const color = typeColor(attack.moveType);

  if (cat === 'ground') {
    return (
      <>
        {[-4, 0, 4].map((offset, i) => (
          <motion.div key={i} className="absolute pointer-events-none rounded-full"
            style={{ left: `${attack.toX}%`, top: `${attack.toY + offset}%`, height: 2, background: `linear-gradient(90deg, transparent, ${color}cc, transparent)` }}
            initial={{ width: 0, marginLeft: 0, opacity: 0.9 }}
            animate={{ width: '28%', marginLeft: '-14%', opacity: 0 }}
            transition={{ duration: 0.42, delay: i * 0.06, ease: 'easeOut' }} />
        ))}
      </>
    );
  }

  if (cat === 'lightning') {
    return (
      <motion.div className="absolute pointer-events-none select-none"
        style={{ left: `${attack.toX}%`, top: `${attack.toY - 10}%`, marginLeft: -12, fontSize: 24, color: '#facc15', textShadow: '0 0 10px #facc15, 0 0 20px #facc15aa' }}
        initial={{ opacity: 0, scaleY: 0.3, y: -16 }}
        animate={{ opacity: [0, 1, 1, 0], scaleY: [0.3, 1.3, 1, 0.8], y: [0, 6, 0] }}
        transition={{ duration: 0.32 }}>
        ⚡
      </motion.div>
    );
  }

  if (cat === 'ice') {
    return (
      <>
        {[0, 60, 120, 180, 240, 300].map((deg, i) => (
          <motion.div key={i} className="absolute pointer-events-none select-none"
            style={{ left: `${attack.toX}%`, top: `${attack.toY}%`, marginLeft: -6, marginTop: -6, fontSize: 12 }}
            initial={{ opacity: 0.9, x: 0, y: 0 }}
            animate={{ opacity: 0, x: Math.cos((deg * Math.PI) / 180) * 18, y: Math.sin((deg * Math.PI) / 180) * 18 }}
            transition={{ duration: 0.38, delay: i * 0.025 }}>
            ❄️
          </motion.div>
        ))}
      </>
    );
  }

  if (cat === 'rings') {
    return (
      <>
        {[0, 1, 2].map((i) => (
          <motion.div key={i} className="absolute rounded-full pointer-events-none"
            style={{ left: `${attack.toX}%`, top: `${attack.toY}%`, border: `1.5px solid ${color}` }}
            initial={{ width: 4, height: 4, marginLeft: -2, marginTop: -2, opacity: 0.85 }}
            animate={{ width: 58, height: 58, marginLeft: -29, marginTop: -29, opacity: 0 }}
            transition={{ duration: 0.55, delay: i * 0.11, ease: 'easeOut' }} />
        ))}
      </>
    );
  }

  if (cat === 'wind') {
    return (
      <>
        {[0, 1, 2].map((i) => (
          <motion.div key={i} className="absolute pointer-events-none"
            style={{ left: `${attack.toX}%`, top: `${attack.toY - 3 + i * 3}%`, height: 2, background: `${color}90`, borderRadius: 4 }}
            initial={{ width: 0, marginLeft: 0, opacity: 0.8 }}
            animate={{ width: '16%', marginLeft: '-8%', opacity: 0 }}
            transition={{ duration: 0.28, delay: i * 0.04, ease: 'easeOut' }} />
        ))}
      </>
    );
  }

  return null;
}

// #2 — Burst of stars at faint position
function FaintBurst({ x, y }: { x: number; y: number }) {
  const particles = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 8;
    const dist = 4 + Math.random() * 3;
    return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, emoji: (['⭐', '💫', '✨'] as const)[i % 3] };
  }), []);
  return (
    <>
      {particles.map((p, i) => (
        <motion.div key={i} className="absolute pointer-events-none select-none"
          style={{ left: `${x}%`, top: `${y}%`, fontSize: 12, marginLeft: -6, marginTop: -6 }}
          initial={{ opacity: 0.9, x: 0, y: 0 }}
          animate={{ opacity: 0, x: `${p.dx}%`, y: `${p.dy}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}>
          {p.emoji}
        </motion.div>
      ))}
      <motion.div className="absolute rounded-full pointer-events-none"
        style={{ left: `${x}%`, top: `${y}%`, border: '2px solid #f87171' }}
        initial={{ width: 4, height: 4, marginLeft: -2, marginTop: -2, opacity: 0.9 }}
        animate={{ width: 48, height: 48, marginLeft: -24, marginTop: -24, opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }} />
    </>
  );
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
const SPEED_OPTIONS = [1, 2, 5, 10, 16] as const;

// #3 idle bob + lunge, #2 animated grayscale, #5 HP pulse, #9 facing flip
function PokemonIcon({
  mon, tickSeconds, hitEffect, tick, isAttacking,
}: {
  mon: ArenaFrame['pokemon'][number];
  tickSeconds: number;
  hitEffect?: Effectiveness;
  tick: number;
  isAttacking: boolean;
}) {
  const accent = mon.side === 'user' ? '#00c8ff' : '#f87171';
  const hpPct = Math.max(0, Math.min(100, (mon.hp / mon.maxHp) * 100));
  const hpColor = hpPct > 50 ? '#4ade80' : hpPct > 20 ? '#facc15' : '#f87171';
  const lungeDir = mon.side === 'user' ? 1 : -1;
  // #9 — mirror opponent to face left (toward user); scale 1.5 shows more sprite within the circle
  const facingScaleX = mon.side === 'user' ? 1.5 : -1.5;

  return (
    <motion.div
      className="absolute"
      style={{ transform: 'translate(-50%, -50%)', zIndex: Math.round(mon.y * 10) }}
      animate={{ left: `${mon.x}%`, top: `${mon.y}%`, opacity: mon.fainted ? 0.2 : 1 }}
      transition={{ duration: tickSeconds, ease: 'linear' }}
    >
      {/* #3 — idle bob wrapper */}
      <motion.div
        className="flex flex-col items-center"
        animate={!mon.fainted ? { y: [0, -2.5, 0] } : { y: 0 }}
        transition={!mon.fainted ? { repeat: Infinity, duration: 1.4, ease: 'easeInOut' } : {}}
      >
        {/* faint tilt + lunge + #2 animated grayscale */}
        <motion.div
          className="relative w-12 h-12 flex items-center justify-center"
          initial={{ filter: 'grayscale(0) brightness(1)', x: 0 }}
          animate={
            mon.fainted
              ? { scale: 0.7, rotate: mon.side === 'user' ? -30 : 30, y: 6, filter: 'grayscale(1) brightness(0.5)', x: 0 }
              : isAttacking
              ? { scale: 1, rotate: 0, y: 0, filter: 'grayscale(0) brightness(1)', x: lungeDir * 6 }
              : { scale: 1, rotate: 0, y: 0, filter: 'grayscale(0) brightness(1)', x: 0 }
          }
          transition={{ duration: isAttacking ? 0.1 : 0.4, ease: 'easeOut', filter: { duration: 0.4 } }}
        >
          {(mon.spriteUrl || mon.artworkUrl) ? (
            <img
              src={mon.spriteUrl || mon.artworkUrl!}
              alt={mon.name}
              className="w-12 h-12 object-contain"
              style={mon.spriteUrl
                ? { imageRendering: 'pixelated', transform: `scaleX(${mon.side === 'user' ? 1 : -1})` }
                : { objectPosition: 'top', transform: `scaleX(${facingScaleX}) scaleY(1.5)` }
              }
            />
          ) : null}
          <AnimatePresence>
            {!mon.fainted && hitEffect && hitEffect !== 'neutral' && <HitFlash key={tick} effectiveness={hitEffect} />}
          </AnimatePresence>
        </motion.div>

        {/* HP bar — #5 low-health pulse below 20% */}
        <div className="w-12 h-[4px] rounded-full bg-white/15 mt-1 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            animate={{
              width: `${hpPct}%`,
              background: hpColor,
              opacity: hpPct <= 20 && !mon.fainted ? [1, 0.4, 1] : 1,
            }}
            transition={{
              width: { duration: 0.3 },
              background: { duration: 0.3 },
              opacity: hpPct <= 20 && !mon.fainted
                ? { repeat: Infinity, duration: 0.65, ease: 'easeInOut' }
                : { duration: 0 },
            }}
          />
        </div>
        <div className="text-[8px] font-bold uppercase tracking-wide mt-0.5 whitespace-nowrap" style={{ color: mon.fainted ? '#555' : accent }}>{mon.name}</div>
      </motion.div>
    </motion.div>
  );
}

function Arena({ frame, obstacles, tickSeconds, theme }: { frame: ArenaFrame; obstacles: ArenaObstacle[]; tickSeconds: number; theme: ArenaTheme }) {
  const rangedAttacks = frame.attacks.filter(a => Math.hypot(a.toX - a.fromX, a.toY - a.fromY) >= MELEE_VISUAL_THRESHOLD);
  const meleeAttacks = frame.attacks.filter(a => Math.hypot(a.toX - a.fromX, a.toY - a.fromY) < MELEE_VISUAL_THRESHOLD);
  const [arenaScope, animateArena] = useAnimate();
  const hasSuperHit = frame.attacks.some(a => a.effectiveness === 'super-effective');
  const prevTickRef = React.useRef(-1);

  // Which Pokemon are attacking this tick (for lunge)
  const attackerIds = useMemo(() => new Set(frame.attacks.map(a => a.attackerId)), [frame.attacks]);

  // Positions of newly fainted Pokemon for burst
  const faintedPositions = useMemo(
    () => frame.faints.map(ft => frame.pokemon.find(p => p.name === ft.name)).filter(Boolean) as ArenaFrame['pokemon'],
    [frame.faints, frame.pokemon],
  );

  React.useEffect(() => {
    if (hasSuperHit && frame.tick !== prevTickRef.current) {
      prevTickRef.current = frame.tick;
      animateArena(arenaScope.current, { x: [0, -2.5, 2.5, -1.5, 1.5, 0], y: [0, -1.5, 1, -1, 0] }, { duration: 0.26, ease: 'easeOut' });
    }
  }, [frame.tick, hasSuperHit]);

  return (
    <div ref={arenaScope} className="relative isolate w-full h-[340px] sm:h-[400px] rounded-xl overflow-hidden border" style={{ background: theme.background, borderColor: `${theme.vignette}30`, boxShadow: `inset 0 0 60px ${theme.vignette}18` }}>
      <ArenaAmbience theme={theme} />
      <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: `${theme.vignette}25` }} />
      {obstacles.map((o, i) => (
        <div key={i} className="absolute rounded-sm" style={{
          left: `${o.x1}%`, top: `${o.y1}%`, width: `${o.x2 - o.x1}%`, height: `${o.y2 - o.y1}%`,
          background: `repeating-linear-gradient(135deg, ${theme.obstacleFill[0]}, ${theme.obstacleFill[0]} 4px, ${theme.obstacleFill[1]} 4px, ${theme.obstacleFill[1]} 8px)`,
          border: `1px solid ${theme.obstacleBorder}`, boxShadow: 'inset 0 0 8px rgba(0,0,0,0.5)',
        }} />
      ))}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <AnimatePresence>
          {rangedAttacks.map(a => <RangedBeam key={`beam-${frame.tick}-${a.attackerId}-${a.defenderId}`} attack={a} />)}
        </AnimatePresence>
      </svg>
      <AnimatePresence>
        {rangedAttacks.map(a => <RangedProjectile key={`proj-${frame.tick}-${a.attackerId}-${a.defenderId}`} attack={a} tickSeconds={tickSeconds} />)}
      </AnimatePresence>
      <AnimatePresence>
        {meleeAttacks.map(a => <MeleeAttackVisual key={`melee-${frame.tick}-${a.attackerId}-${a.defenderId}`} attack={a} />)}
      </AnimatePresence>
      <AnimatePresence>
        {frame.attacks.map(a => <ImpactRing key={`ring-${frame.tick}-${a.attackerId}-${a.defenderId}`} attack={a} />)}
      </AnimatePresence>
      <AnimatePresence>
        {frame.attacks.map(a => <MoveBurst key={`vfx-${frame.tick}-${a.attackerId}-${a.defenderId}`} attack={a} />)}
      </AnimatePresence>
      {/* #1 — move-specific VFX overlay */}
      <AnimatePresence>
        {frame.attacks.map(a => <VfxOverlay key={`vfxo-${frame.tick}-${a.attackerId}-${a.defenderId}`} attack={a} />)}
      </AnimatePresence>
      {/* #2 — KO screen flash */}
      <AnimatePresence>
        {frame.faints.length > 0 && (
          <motion.div key={`ko-flash-${frame.tick}`}
            className="absolute inset-0 z-30 pointer-events-none rounded-xl"
            style={{ background: 'rgba(255,80,80,0.26)' }}
            initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }} />
        )}
      </AnimatePresence>
      {/* #2 — faint burst at KO position */}
      <AnimatePresence>
        {faintedPositions.map(p => (
          <FaintBurst key={`faint-burst-${frame.tick}-${p.name}`} x={p.x} y={p.y} />
        ))}
      </AnimatePresence>
      {frame.pokemon.map(mon => (
        <PokemonIcon
          key={mon.id} mon={mon} tickSeconds={tickSeconds} tick={frame.tick}
          hitEffect={frame.attacks.find(a => a.defenderId === mon.id)?.effectiveness}
          isAttacking={attackerIds.has(mon.id)}
        />
      ))}
    </div>
  );
}

export function BattleReplay({ matches, tierLabel, status, reward, onClose }: { matches: BrawlMatchResult[]; tierLabel: string; status: 'won' | 'eliminated'; reward: number; onClose: () => void }) {
  const [matchIndex, setMatchIndex] = useState(0);
  const [gameIndex, setGameIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [speed, setSpeed] = useState<typeof SPEED_OPTIONS[number]>(1);
  const [showVsIntro, setShowVsIntro] = useState(true);
  const theme = useMemo(() => ARENA_THEMES[Math.floor(Math.random() * ARENA_THEMES.length)], [matchIndex]);

  useEffect(() => {
    setShowVsIntro(true);
    setPlaying(false);
    const t = setTimeout(() => { setShowVsIntro(false); setPlaying(true); }, 1800);
    return () => clearTimeout(t);
  }, [matchIndex, gameIndex]);

  const match = matches[matchIndex];
  const game = match.games[gameIndex];
  const frames = game.frames;
  const currentFrame = frames[frameIndex];
  const atGameEnd = frameIndex >= frames.length - 1;
  const isLastGameOfMatch = gameIndex >= match.games.length - 1;
  const tickDelayMs = Math.max(16, BASE_TICK_MS / speed);
  const remainingSeconds = Math.max(0, (game.maxTicks - frameIndex) * BASE_TICK_MS / speed / 1000);

  const gamesSettled = match.games.slice(0, gameIndex + (atGameEnd ? 1 : 0));
  const scoreUser = gamesSettled.filter(g => g.result === 'win').length;
  const scoreOpponent = gamesSettled.length - scoreUser;

  const feed = useMemo(() => frames.slice(0, frameIndex + 1).flatMap(f => f.faints.map(ft => `${ft.name} fainted!`)), [frames, frameIndex]);
  const lastAttack = useMemo(() => {
    for (let i = frameIndex; i >= 0; i--) { const a = frames[i].attacks; if (a.length) return a[a.length - 1]; }
    return null;
  }, [frames, frameIndex]);

  useEffect(() => {
    if (!playing || atGameEnd) return;
    const t = setTimeout(() => setFrameIndex(i => Math.min(frames.length - 1, i + 1)), tickDelayMs);
    return () => clearTimeout(t);
  }, [playing, atGameEnd, frames.length, frameIndex, tickDelayMs]);

  const handleSkip = () => setFrameIndex(frames.length - 1);
  const handleNextRound = () => {
    if (!isLastGameOfMatch) { setGameIndex(i => i + 1); setFrameIndex(0); setPlaying(true); return; }
    if (matchIndex < matches.length - 1) { setMatchIndex(i => i + 1); setGameIndex(0); setFrameIndex(0); setPlaying(true); }
    else setFinished(true);
  };

  // #7 — skip VS intro
  const skipVsIntro = () => { setShowVsIntro(false); setPlaying(true); };

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm p-3 overflow-hidden">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="h-full w-full max-w-4xl mx-auto rounded-2xl border border-white/10 flex flex-col overflow-hidden" style={{ background: '#0d0e14' }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 shrink-0">
          <div className="text-xs font-bold uppercase tracking-widest text-white/60">{tierLabel} — Trainer {matchIndex + 1}/{matches.length}</div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={16} /></button>
        </div>

        {!finished ? (
          <>
          <div className="flex-1 min-h-0 overflow-y-auto relative p-4">
            <div className="flex items-center justify-center gap-3 mb-1.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest text-white/30">Round {gameIndex + 1}/{match.games.length}</span>
              <span className="text-sm font-bold tabular-nums"><span className="text-[#00c8ff]">{scoreUser}</span><span className="text-white/25 mx-0.5">–</span><span className="text-[#f87171]">{scoreOpponent}</span></span>
              <span className="text-[9px] uppercase tracking-widest text-white/30">first to 3 wins</span>
            </div>
            {/* #6 — KO counter bounce on increment */}
            <div className="flex items-center justify-center gap-4 mb-2">
              <span className="text-[10px] uppercase tracking-widest text-white/30">KOs</span>
              <AnimatePresence mode="wait">
                <motion.span key={`ku-${currentFrame.koUser}`} className="text-sm font-bold text-[#00c8ff]"
                  initial={{ scale: 1.7, opacity: 0.7 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
                  {currentFrame.koUser}
                </motion.span>
              </AnimatePresence>
              <span className="text-white/20 text-sm">—</span>
              <AnimatePresence mode="wait">
                <motion.span key={`ko-${currentFrame.koOpponent}`} className="text-sm font-bold text-[#f87171]"
                  initial={{ scale: 1.7, opacity: 0.7 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
                  {currentFrame.koOpponent}
                </motion.span>
              </AnimatePresence>
              <span className="text-white/15 text-sm mx-1">|</span>
              <Clock size={11} className="text-white/30" />
              <span className="text-sm font-bold text-white/60 tabular-nums">{formatClock(remainingSeconds)}</span>
            </div>

            <div className="relative">
              <Arena frame={currentFrame} obstacles={game.obstacles} tickSeconds={tickDelayMs / 1000} theme={theme} />
              {/* #7 — VS intro with skip button */}
              <AnimatePresence>
                {showVsIntro && frames[0] && (
                  <motion.div
                    className="absolute inset-0 z-40 flex items-center justify-center rounded-xl overflow-hidden"
                    style={{ background: 'rgba(10,11,18,0.97)' }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="flex items-center gap-4 px-2 w-full">
                      {/* user team — 2-col grid so 6 pokemon never overflow */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 flex-1 justify-items-center">
                        {frames[0].pokemon.filter(p => p.side === 'user').map(p => (
                          <div key={p.id} className="flex flex-col items-center gap-0.5">
                            {(p.spriteUrl || p.artworkUrl) && <img src={p.spriteUrl || p.artworkUrl!} alt={p.name} className="w-9 h-9 object-contain" style={p.spriteUrl ? { imageRendering: 'pixelated' } : { objectPosition: 'top' }} />}
                            <span className="text-[8px] font-bold text-[#00c8ff] uppercase tracking-tight leading-none">{p.name}</span>
                          </div>
                        ))}
                      </div>
                      <motion.div
                        className="font-display text-4xl text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.6)] shrink-0"
                        initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }} transition={{ delay: 0.2, duration: 0.45 }}
                      >
                        VS
                      </motion.div>
                      {/* opponent team */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 flex-1 justify-items-center">
                        {frames[0].pokemon.filter(p => p.side !== 'user').map(p => (
                          <div key={p.id} className="flex flex-col items-center gap-0.5">
                            {(p.spriteUrl || p.artworkUrl) && <img src={p.spriteUrl || p.artworkUrl!} alt={p.name} className="w-9 h-9 object-contain" style={p.spriteUrl ? { imageRendering: 'pixelated', transform: 'scaleX(-1)' } : { objectPosition: 'top' }} />}
                            <span className="text-[8px] font-bold text-[#f87171] uppercase tracking-tight leading-none">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <motion.button
                      className="absolute bottom-3 right-3 text-[10px] text-white/40 hover:text-white/80 px-2.5 py-1 rounded border border-white/10 hover:border-white/30 transition-colors"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                      onClick={skipVsIntro}
                    >
                      Skip
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* kill feed */}
              <div className="absolute top-3 right-3 flex flex-col gap-1 items-end max-w-[45%]">
                <AnimatePresence>
                  {feed.slice(-4).map((f, i) => (
                    <motion.div key={f + i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-black/60 text-white/70">
                      <Skull size={10} className="text-red-400" /> {f}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* #8 — move info box with slide animation */}
              <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 max-w-[128px] sm:max-w-[260px] rounded-lg border border-white/10 bg-gray-300/10 backdrop-blur-sm px-1.5 py-1 sm:px-3 sm:py-2">
                <AnimatePresence mode="wait">
                  {lastAttack ? (
                    <motion.div key={`${lastAttack.attackerId}-${lastAttack.move}-${frameIndex}`}
                      initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.18 }}>
                      <div className="text-[9px] sm:text-[11px] text-white">used <span className="font-bold">{lastAttack.move}</span></div>
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                        <span className="text-[7px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded-full uppercase font-bold" style={{ background: `${typeColor(lastAttack.moveType)}30`, color: typeColor(lastAttack.moveType) }}>{lastAttack.moveType}</span>
                        <span className="text-[8px] sm:text-[10px] text-white/50">{lastAttack.damage} dmg</span>
                        {EFFECTIVENESS_LABEL[lastAttack.effectiveness] && <span className="text-[8px] sm:text-[10px] font-bold" style={{ color: EFFECTIVENESS_COLOR[lastAttack.effectiveness] }}>{EFFECTIVENESS_LABEL[lastAttack.effectiveness]}</span>}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="empty"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}>
                      <div className="text-[9px] sm:text-[11px] text-white/30">Battle starting…</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
          <div className="shrink-0 px-4 pb-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button onClick={() => setPlaying(p => !p)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
                  {playing ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <div className="flex items-center bg-white/10 rounded-full p-0.5">
                  {SPEED_OPTIONS.map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      className={`px-2 h-7 rounded-full text-[10px] font-bold ${speed === s ? 'bg-[#00c8ff] text-black' : 'text-white/50 hover:text-white'}`}>
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
              {!atGameEnd ? (
                <button onClick={handleSkip} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0"><FastForward size={13} /></button>
              ) : (
                <button onClick={handleNextRound} className="px-4 h-10 min-w-[110px] rounded-full bg-[#00c8ff] text-black text-[12px] font-bold uppercase shrink-0 active:scale-95 transition-transform">
                  {!isLastGameOfMatch ? 'Next Round' : matchIndex < matches.length - 1 ? 'Next Trainer' : 'See Result'}
                </button>
              )}
          </div>
          </>
        ) : (
          <div className="p-8 text-center">
            {status === 'won' ? <Trophy size={40} className="text-[#facc15] mx-auto mb-3" /> : <Skull size={40} className="text-white/30 mx-auto mb-3" />}
            <h3 className="font-display text-2xl uppercase tracking-widest text-white mb-1">{status === 'won' ? 'Victory' : 'Eliminated'}</h3>
            <p className="text-white/40 text-xs mb-4">{tierLabel} — {matches.filter(m => m.result === 'win').length}/{matches.length} matches won</p>
            <div className="flex items-center justify-center gap-2 flex-wrap mb-5">
              {reward > 0 && (
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#facc15]/10 border border-[#facc15]/30 text-[#facc15] font-bold text-sm">
                  <Coins size={14} /> +{reward} pokedollars
                </div>
              )}
            </div>
            <div><button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black font-bold text-sm uppercase tracking-wider">Continue</button></div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
