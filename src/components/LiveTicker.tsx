import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAllCards, useRecentPulls } from '../hooks/usePacks';

// ─── Types ────────────────────────────────────────────────────────────────────
type Rarity = 'common' | 'uncommon' | 'rare' | 'ultra' | 'secret' | 'god';

interface PullEntry {
  id: string | number;
  card: string;
  rarity: Rarity;
  image: string;
  pulledAt: number;
}

// ─── Rarity palette ───────────────────────────────────────────────────────────
const RARITY_CFG: Record<Rarity, {
  label: string; shortLabel: string;
  border: string; glow: string; text: string;
}> = {
  common:   { label: 'Common',      shortLabel: 'Common',  border: 'rgba(136,146,164,0.4)',  glow: 'rgba(136,146,164,0.12)', text: '#8892a4' },
  uncommon: { label: 'Uncommon',    shortLabel: 'Uncommon',border: 'rgba(16,185,129,0.45)',  glow: 'rgba(16,185,129,0.15)',  text: '#10b981' },
  rare:     { label: 'Rare',        shortLabel: 'Rare',    border: 'rgba(0,200,255,0.5)',    glow: 'rgba(0,200,255,0.2)',    text: '#00c8ff' },
  ultra:    { label: 'Ultra Rare',  shortLabel: 'Ultra',   border: 'rgba(155,92,255,0.55)',  glow: 'rgba(155,92,255,0.22)', text: '#9b5cff' },
  secret:   { label: 'Secret Rare', shortLabel: 'Secret',  border: 'rgba(255,215,0,0.6)',    glow: 'rgba(255,215,0,0.25)',   text: '#ffd700' },
  god:      { label: 'GOD PULL',    shortLabel: '★ GOD',   border: 'rgba(255,0,150,0.65)',   glow: 'rgba(155,92,255,0.4)',   text: '#ff55cc' },
};

// ─── Time-ago ────────────────────────────────────────────────────────────────
function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5)  return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─── Feed generator ──────────────────────────────────────────────────────
function makeFeedFromCards(cards: any[], count = 30): PullEntry[] {
  if (!cards.length) return [];
  const out: PullEntry[] = [];
  let t = Date.now();
  // Sort by a stable but randomized order for the initial feed
  const pool = [...cards].sort((a, b) => (a.id > b.id ? 1 : -1));
  for (let i = 0; i < count; i++) {
    const card = pool[i % pool.length];
    // Spread them out in time
    t -= Math.floor(Math.random() * 45000 + 10000);
    out.push({
      id: `init-${card.id}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      card: card.cardName,
      rarity: (card.rarity as Rarity) || 'common',
      image: card.cardImageUrl || '',
      pulledAt: t
    });
  }
  return out;
}

function realPullToEntry(p: any): PullEntry {
  return {
    id: `real-${p.id}`,
    card: p.cardName,
    rarity: (p.rarity as Rarity) || 'common',
    image: p.cardImageUrl || '',
    pulledAt: new Date(p.createdAt).getTime() || Date.now(),
  };
}

// Blends real player pulls in among the simulated feed instead of the strip
// being 100% made-up -- spread evenly across the strip rather than clustered
// at one end, so real activity is visible no matter where the loop currently
// scrolls to.
function blendInitialFeed(cards: any[], realPulls: any[], count = 30): PullEntry[] {
  const simulated = makeFeedFromCards(cards, count);
  if (!realPulls.length) return simulated;
  const real = realPulls.slice(0, count).map(realPullToEntry);
  const merged = simulated.slice();
  const step = Math.max(1, Math.floor(count / real.length));
  real.forEach((entry, i) => {
    merged[Math.min(count - 1, i * step)] = entry;
  });
  return merged;
}

// ─── Tile dimensions (single source of truth) ────────────────────────────────
const TILE_W       = 100;   // px
const IMG_H        = 108;   // px
const TILE_GAP     = 12;    // px
const SECTION_H    = 192;   // px
const FEED_SIZE    = 30;    // Stable number of items

// ─── Single tile ─────────────────────────────────────────────────────────────
const PullTile: React.FC<{ entry: PullEntry; isNew?: boolean }> = React.memo(({ entry, isNew = false }) => {
  const cfg  = RARITY_CFG[entry.rarity];
  const isGod = entry.rarity === 'god';

  return (
    <motion.div
      initial={isNew ? { opacity: 0, scale: 0.72, y: -20 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      whileHover={{ scale: 1.07, y: -4, zIndex: 30 }}
      className="relative shrink-0 flex flex-col items-center cursor-pointer select-none rounded-2xl"
      style={{
        width:   `${TILE_W}px`,
        marginRight: `${TILE_GAP}px`, // SEAMLESS: use margin instead of flex gap
        padding: '8px 8px 6px',
        background: isGod
          ? 'linear-gradient(160deg, #150a22 0%, #0c0814 100%)'
          : 'linear-gradient(160deg, #0d0f1c 0%, #090b14 100%)',
        border:     `1.5px solid ${cfg.border}`,
        boxShadow: isGod
          ? `0 0 22px -4px rgba(155,92,255,0.55), 0 0 40px -12px rgba(255,0,150,0.35), inset 0 1px 0 rgba(255,255,255,0.07)`
          : `0 0 16px -5px ${cfg.glow}, 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* Rarity badge */}
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider whitespace-nowrap z-10"
        style={{
          background: isGod
            ? 'linear-gradient(90deg, #ff0060, #9b5cff)'
            : `${cfg.text}1a`,
          color:  isGod ? '#fff' : cfg.text,
          border: `1px solid ${cfg.border}`,
          boxShadow: isGod ? `0 0 10px -2px rgba(155,92,255,0.6)` : 'none',
        }}
      >
        {cfg.shortLabel}
      </div>

      {/* Card image box */}
      <div
        className="relative w-full rounded-xl overflow-hidden"
        style={{
          height: `${IMG_H}px`,
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${cfg.border}`,
        }}
      >
        <img
          src={entry.image}
          alt={entry.card}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          style={{ display: 'block' }}
          onError={e => {
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = 'none';
            const parent = el.parentElement!;
            parent.style.display = 'flex';
            parent.style.alignItems = 'center';
            parent.style.justifyContent = 'center';
            parent.innerHTML = `<span style="font-size:32px">🃏</span>`;
          }}
        />
        {/* God holo sheen — a light band glides across the art, like a foil card catching light */}
        {isGod && (
          <div
            className="absolute holo-sweep pointer-events-none"
            style={{
              inset: '-50%',
              background: 'linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.55) 48%, rgba(255,0,150,0.35) 50%, rgba(0,200,255,0.35) 52%, transparent 58%)',
              mixBlendMode: 'screen',
            }}
          />
        )}
      </div>

      {/* Card name */}
      <p
        className="w-full text-center font-bold leading-tight truncate mt-2"
        style={{
          fontSize: '10px',
          color: isGod ? '#ddbfff' : '#e2e8f0',
        }}
      >
        {entry.card}
      </p>

      {/* Timestamp */}
      <p
        className="text-center mt-0.5"
        style={{ fontSize: '9px', color: '#4b5563' }}
      >
        {timeAgo(entry.pulledAt)}
      </p>
    </motion.div>
  );
});

// ─── Main export ──────────────────────────────────────────────────────────────
export const LiveTicker: React.FC = React.memo(() => {
  const { data: allCards = [], isLoading, isError, refetch } = useAllCards();
  const { data: realPulls = [] } = useRecentPulls(FEED_SIZE);
  const [feed, setFeed] = useState<PullEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const trackRef  = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<any[]>([]);
  const realPullsRef = useRef<any[]>([]);
  const shownRealIdsRef = useRef<Set<string>>(new Set());
  // Round-robins which slot gets overwritten so injecting a new pull only
  // ever touches one tile's content instead of reordering the whole strip.
  const replaceIndexRef = useRef(0);

  // Update cards ref
  useEffect(() => {
    if (allCards.length > 0) {
      cardsRef.current = allCards;
    }
  }, [allCards]);

  useEffect(() => {
    if (realPulls.length > 0) {
      realPullsRef.current = realPulls;
    }
  }, [realPulls]);

  // Initialize feed when cards are loaded, blending in real pulls if any are
  // already available by then.
  useEffect(() => {
    if (allCards.length > 0 && feed.length === 0) {
      setFeed(blendInitialFeed(allCards, realPulls, FEED_SIZE));
      for (const p of realPulls) shownRealIdsRef.current.add(p.id);
    }
  }, [allCards, realPulls, feed.length]);

  // Timestamps update via timeAgo() on each render — no polling needed

  // Inject a new live pull periodically. Replaces one slot's content in
  // place (same array length/order) rather than unshifting -- unshifting
  // reordered every entry on each tick, which forced all ~90 tiles to
  // remount and produced a visible skip/stutter in the scroll every 8-20s.
  useEffect(() => {
    const schedule = () => {
      const delay = 8000 + Math.random() * 12000;
      return setTimeout(() => {
        const unseenReal = realPullsRef.current.find(p => !shownRealIdsRef.current.has(p.id));
        let nextEntry: PullEntry | null = null;
        if (unseenReal && Math.random() < 0.6) {
          shownRealIdsRef.current.add(unseenReal.id);
          nextEntry = { ...realPullToEntry(unseenReal), pulledAt: Date.now() };
        } else if (cardsRef.current.length > 0) {
          const card = cardsRef.current[Math.floor(Math.random() * cardsRef.current.length)];
          nextEntry = {
            id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            card: card.cardName,
            rarity: (card.rarity as Rarity) || 'common',
            image: card.cardImageUrl || '',
            pulledAt: Date.now(),
          };
        }
        if (nextEntry) {
          setFeed(prev => {
            if (prev.length === 0) return prev;
            const idx = replaceIndexRef.current % prev.length;
            replaceIndexRef.current += 1;
            const next = prev.slice();
            next[idx] = nextEntry as PullEntry;
            return next;
          });
        }
        timerRef.current = schedule();
      }, delay);
    };
    const timerRef = { current: schedule() };
    return () => clearTimeout(timerRef.current);
  }, []);

  // Stable animation duration
  const DURATION = FEED_SIZE * 3.5; 

  if (isLoading && feed.length === 0) {
    return (
      <div 
        style={{ marginTop: '56px', height: `${SECTION_H}px` }} 
        className="flex items-center justify-center bg-[#07080e]"
      >
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#00c8ff] animate-spin" />
      </div>
    );
  }

  if (feed.length === 0 && isError) {
    return (
      <div style={{ marginTop: '56px', height: `${SECTION_H}px` }} className="flex items-center justify-center gap-3 bg-[#07080e] text-xs text-gray-500">
        <span>Recent pulls are temporarily unavailable.</span>
        <button onClick={() => refetch()} className="text-[#00c8ff] font-bold">Try again</button>
      </div>
    );
  }

  if (feed.length === 0) return null;

  // We use 3 copies to ensure no visible gap on wide screens or during transitions
  const copies = [...feed, ...feed, ...feed];

  return (
    <div
      className="relative z-10"
      style={{
        marginTop: '56px',
        height: `${SECTION_H}px`,
        background: 'linear-gradient(180deg, #07080e 0%, #0a0b15 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-100% / 3)); }
        }
        .ticker-animate {
          animation: ticker-scroll ${DURATION}s linear infinite;
          display: flex;
          width: max-content;
        }
        @keyframes holo-sweep {
          0%, 100% { transform: translate(-30%, -30%) rotate(20deg); }
          50% { transform: translate(30%, 30%) rotate(20deg); }
        }
        .holo-sweep {
          animation: holo-sweep 4.5s ease-in-out infinite;
        }
      `}</style>

      {/* Left fade */}
      <div
        className="absolute left-0 top-0 bottom-0 z-10 pointer-events-none"
        style={{
          width: '180px',
          background: 'linear-gradient(to right, #07080e 40%, #07080e 20%, transparent)',
        }}
      />
      {/* Right fade */}
      <div
        className="absolute right-0 top-0 bottom-0 z-10 pointer-events-none"
        style={{
          width: '120px',
          background: 'linear-gradient(to left, #07080e 40%, transparent)',
        }}
      />

      {/* Scrolling track */}
      <div
        className="absolute inset-0 flex items-center"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          ref={trackRef}
          className="ticker-animate will-change-transform"
          style={{ 
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        >
          {copies.map((entry, i) => (
            // Keyed by fixed slot position (copy segment + index within it),
            // not by entry identity -- so replacing one slot's content only
            // re-renders that slot instead of remounting the whole strip.
            <PullTile
              key={`c${Math.floor(i / FEED_SIZE)}-s${i % FEED_SIZE}`}
              entry={entry}
              isNew={i < FEED_SIZE && entry.pulledAt > Date.now() - 15000}
            />
          ))}
        </div>
      </div>

      {/* LIVE label — sits above the clip mask, pinned left */}
      <div
        className="absolute left-0 top-0 bottom-0 z-20 flex flex-col items-center justify-center gap-1"
        style={{ width: '88px', paddingLeft: '16px' }}
      >
        {/* Pulsing LIVE dot */}
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-65" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span
            className="font-display uppercase tracking-[0.14em] text-red-400"
            style={{ fontSize: '10px' }}
          >
            Live
          </span>
        </div>

        {/* Divider */}
        <div
          className="w-8 rounded-full"
          style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }}
        />

        {/* Recent Pulls label */}
        <span
          className="font-bold uppercase tracking-widest text-center leading-tight"
          style={{ fontSize: '8px', color: '#4b5563' }}
        >
          Recent
          <br />
          Pulls
        </span>
      </div>
    </div>
  );
});