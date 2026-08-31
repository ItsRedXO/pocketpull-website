/**
 * PackSpinner — visual spinner component inside PackDetailsModal.
 *
 * SAFE APPROACH:
 *  1. Click → instant "Opening…" feedback (no animation, no audio)
 *  2. Wait for backend result (card saved to inventory server-side)
 *  3. Build reel strip ONCE with the real winning card locked at WINNER_IDX
 *  4. Start reel animation + tick audio simultaneously
 *  5. Never swap the winning card during the reel
 *  6. Final displayed card never changes after landing
 *
 * KEY GUARANTEE: Uses the backend /open-pack API exclusively.
 * The card is saved to inventory BEFORE the result is shown.
 * Closing the modal after opening will NOT lose the card.
 * Only "Sell" removes the card from inventory.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, CheckCircle } from 'lucide-react';
import type { PackCard, PackCatalog } from '../hooks/usePacks';
import { useAuth } from '../hooks/useAuth';
import { useBalance } from '../hooks/useBalance';
import { useQueryClient } from '@tanstack/react-query';
import { openPack, sellCard } from '../lib/api';
import { useSoundSetting } from '../hooks/useSoundSetting';
import { useTickSound } from '../hooks/useTickSound';

// ── Constants ──────────────────────────────────────────────────────────────────
const RARITY_COLOR: Record<string, string> = {
  common: '#8892a4', uncommon: '#10b981', rare: '#00c8ff',
  ultra: '#9b5cff', secret: '#ffd700', god: '#ff00ff',
};
const RARITY_LABEL: Record<string, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare',
  ultra: 'Ultra Rare', secret: 'Secret Rare', god: 'GOD PULL',
};

const TILE_W = 140;   // tile width + gap (px)
const TILE_GAP = 8;   // gap between tiles (px)
const TILE_COUNT = 48;
const WINNER_IDX = 38; // index in strip where winner lands

// ── Helpers ────────────────────────────────────────────────────────────────────
function weightedPick(cards: PackCard[]): PackCard {
  const total = cards.reduce((s, c) => s + Number(c.pullChance), 0);
  let r = Math.random() * total;
  for (const c of cards) { r -= Number(c.pullChance); if (r <= 0) return c; }
  return cards[cards.length - 1];
}

function buildStrip(cards: PackCard[], winner: PackCard): PackCard[] {
  return Array.from({ length: TILE_COUNT }, (_, i) =>
    i === WINNER_IDX ? winner : weightedPick(cards)
  );
}

// ── Tile ───────────────────────────────────────────────────────────────────────
const Tile: React.FC<{ card: PackCard; highlight: boolean }> = ({ card, highlight }) => {
  const col = RARITY_COLOR[card.rarity] ?? '#8892a4';
  return (
    <div className="shrink-0 flex flex-col rounded-xl overflow-hidden"
      style={{
        width: TILE_W - TILE_GAP,
        background: highlight ? `${col}15` : 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${highlight ? col : col + '30'}`,
        boxShadow: highlight ? `0 0 22px -4px ${col}77` : 'none',
        transition: 'all 0.4s ease',
      }}
    >
      <div className="w-full flex items-center justify-center" style={{ height: 100, background: 'rgba(0,0,0,0.3)' }}>
        {card.cardImageUrl
          ? <img src={card.cardImageUrl} alt={card.cardName} className="h-full w-auto object-contain py-1" loading="eager" draggable={false} />
          : <span className="text-3xl">🃏</span>}
      </div>
      <div className="px-2 py-1.5 flex flex-col gap-0.5">
        <p className="text-[10px] font-display text-white leading-tight truncate">{card.cardName}</p>
        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: col }}>{RARITY_LABEL[card.rarity] ?? card.rarity}</p>
        <p className="text-[9px] text-white/40">${Number(card.estimatedValue).toFixed(2)}</p>
      </div>
    </div>
  );
};

// ── Types ──────────────────────────────────────────────────────────────────────
type SpinState = 'idle' | 'opening' | 'spinning' | 'done';

interface WinnerCard {
  cardName: string;
  rarity: string;
  estimatedValue: number;
  cardImageUrl?: string | null;
  inventoryId: string;
}

interface Props {
  pack: PackCatalog;
  cards: PackCard[];
  onComplete: (newBalance: number) => void;
}

// ── Main ───────────────────────────────────────────────────────────────────────
export const PackSpinner: React.FC<Props> = ({ pack, cards, onComplete }) => {
  const { user, isAuthenticated } = useAuth();
  const { balance, matchedBalance, updateBalance } = useBalance(user?.id);
  const { enabled: soundEnabled } = useSoundSetting();
  const { startReel, stop: stopTick } = useTickSound(soundEnabled);
  const containerRef = useRef<HTMLDivElement>(null);
  const balanceRef = useRef(balance);
  const totalBalanceRef = useRef(balance + matchedBalance);
  const qc = useQueryClient();

  // Keep refs in sync with latest balance
  useEffect(() => { balanceRef.current = balance; totalBalanceRef.current = balance + matchedBalance; }, [balance, matchedBalance]);

  const [spinState, setSpinState] = useState<SpinState>('idle');
  const [strip, setStrip] = useState<PackCard[]>([]);
  const [winner, setWinner] = useState<WinnerCard | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const [sold, setSold] = useState(false);
  const [selling, setSelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const glow = pack.glowColor ?? '#f59e0b';
  const winCol = winner ? (RARITY_COLOR[winner.rarity] ?? '#fff') : glow;
  const isDone = spinState === 'done';
  const isOpening = spinState === 'opening';
  const isSpinning = spinState === 'spinning';

  const buttonTextColor = pack.buttonTextColor || '#ffffff';
  const openAnotherButtonTextColor = pack.openAnotherButtonTextColor || pack.buttonTextColor || '#ffffff';

  // ── Compute reel target X position ─────────────────────────────────────────
  const computeTargetX = () => {
    const vpW = containerRef.current?.clientWidth ?? 600;
    return vpW / 2 - 8 - WINNER_IDX * TILE_W - (TILE_W - TILE_GAP) / 2;
  };

  // ── Stop tick on unmount (modal close, navigation, etc.) ──────────────────
  useEffect(() => {
    return () => stopTick();
  }, [stopTick]);

  // ── Open: step 1 — validate, show "Opening…", fire backend ────────────────
  const handleOpen = async () => {
    if (spinState !== 'idle' || cards.length === 0) return;
    setError(null);
    setActionMsg(null);
    setSold(false);

    if (!isAuthenticated || !user?.id) {
      setError('Create an account or sign in to open packs.');
      window.dispatchEvent(new CustomEvent('pocketpull-open-auth', { detail: 'signup' }));
      return;
    }

    if (totalBalanceRef.current < pack.price) {
      setError('Insufficient balance — deposit funds to open packs.');
      return;
    }

    // ── Step 1a: show "Opening…" immediately — no animation, no audio ────
    setSpinState('opening');

    // ── Step 1b: call backend (card is saved to inventory server-side) ────
    try {
      const result = await openPack(pack.id);

      const winnerPackCard: PackCard = {
        id: result.inventoryId,
        packId: pack.id,
        cardName: result.card.name,
        rarity: result.card.rarity as PackCard['rarity'],
        pullChance: 0,
        estimatedValue: result.card.value,
        cardImageUrl: result.card.imageUrl || undefined,
        sortOrder: 0,
      };

      setWinner({
        cardName: result.card.name,
        rarity: result.card.rarity,
        estimatedValue: result.card.value,
        cardImageUrl: result.card.imageUrl,
        inventoryId: result.inventoryId,
      });

      await updateBalance(result.newBalance);
      onComplete(result.newBalance);

      qc.invalidateQueries({ queryKey: ['inventory'] });

      // ── Step 2: build strip WITH the real winner at WINNER_IDX ─────────
      const realStrip = buildStrip(cards, winnerPackCard);
      setStrip(realStrip);

      // ── Step 3: start reel animation + audio simultaneously ────────────
      const targetX = computeTargetX();
      const totalDistance = Math.abs(targetX);
      startReel(3200, totalDistance, TILE_W);

      // Force browser layout flush before starting CSS transition
      setTranslateX(0);
      setSpinState('spinning');

      requestAnimationFrame(() => requestAnimationFrame(() => {
        setTranslateX(targetX);
      }));

    } catch (err: any) {
      console.error('[PackSpinner] openPack error:', err);
      stopTick();
      setError(err.message || 'Failed to open pack. Please try again.');
      setSpinState('idle');
      setStrip([]);
    }
  };

  // ── Sell: backend is the single source of truth for balance ────────────
  const handleSell = async () => {
    if (!winner || selling || sold) return;
    setSelling(true);
    setError(null);

    const sellValue = Number(winner.estimatedValue);
    setActionMsg(`Selling ${winner.cardName} for ${sellValue.toFixed(2)}...`);
    setSold(true);

    try {
      const result = await sellCard(winner.inventoryId);
      await updateBalance(result.newBalance);
      onComplete(result.newBalance);
      setActionMsg(`Sold ${winner.cardName} for ${sellValue.toFixed(2)}!`);
    } catch (err: any) {
      console.error('[PackSpinner] sell error:', err);
      setError('Failed to sell card. It remains in your inventory.');
      setSold(false);
      setActionMsg(null);
    } finally {
      setSelling(false);
    }
  };

  // ── Reset for another spin ──────────────────────────────────────────────────
  const handleReset = () => {
    stopTick();
    setSpinState('idle');
    setStrip([]);
    setWinner(null);
    setTranslateX(0);
    setSold(false);
    setSelling(false);
    setError(null);
    setActionMsg(null);
  };

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'linear-gradient(160deg, #0e1020 0%, #09090f 100%)',
        border: `1.5px solid ${isDone ? winCol + '55' : glow + '28'}`,
        boxShadow: isDone ? `0 0 36px -8px ${winCol}44` : 'none',
        transition: 'border-color 0.6s ease, box-shadow 0.6s ease',
      }}
    >
      {/* ── Spinner track ── */}
      <div className="px-4 pt-4 pb-2 relative">
        {/* Edge fade masks */}
        <div className="absolute inset-y-4 left-4 w-16 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, #09090f, transparent)' }} />
        <div className="absolute inset-y-4 right-4 w-16 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left, #09090f, transparent)' }} />
        {/* Center hairline marker */}
        <div className="absolute inset-y-4 left-1/2 -translate-x-px w-[2px] z-20 pointer-events-none rounded-full"
          style={{
            background: `linear-gradient(to bottom, transparent, ${isDone ? winCol : glow}cc, transparent)`,
            boxShadow: `0 0 8px ${isDone ? winCol : glow}`,
            transition: 'all 0.5s ease',
          }} />

        <div ref={containerRef} className="overflow-hidden rounded-lg" style={{ height: 150 }}>
          <div
            className="flex gap-2 will-change-transform"
            style={{
              paddingLeft: 8,
              transform: `translateX(${translateX}px)`,
              transition: isSpinning
                ? 'transform 3.2s cubic-bezier(0.05, 0.8, 0.3, 1.0)'
                : 'none',
            }}
            onTransitionEnd={() => {
              if (spinState !== 'spinning') return;
              // Reel animation finished — stop audio and show result
              stopTick();
              setSpinState('done');
            }}
          >
            {strip.length > 0
              ? strip.map((c, i) => <Tile key={i} card={c} highlight={isDone && i === WINNER_IDX} />)
              : Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="shrink-0 rounded-xl flex items-center justify-center"
                  style={{ width: TILE_W - TILE_GAP, height: 142, background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.07)' }}>
                  <span className="text-2xl opacity-20">?</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* ── Action area ── */}
      <div className="px-4 pb-4 pt-1">
        <AnimatePresence mode="wait">

          {/* IDLE: open button */}
          {spinState === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
              {error && (
                <p className="text-center text-[11px]" style={{ color: '#f87171' }}>{error}</p>
              )}
              <button onClick={handleOpen} disabled={cards.length === 0}
                className="w-full py-3.5 rounded-xl font-display text-[14px] uppercase tracking-widest transition-all active:scale-95 hover:brightness-110 disabled:opacity-50"
                style={{ background: glow, color: buttonTextColor, boxShadow: `0 0 22px -4px ${glow}88` }}
              >
                {Number(pack.price) === 0 ? 'OPEN FREE PACK' : `OPEN PACK - $${Number(pack.price).toFixed(2)}`}
              </button>
            </motion.div>
          )}

          {/* OPENING: backend call in flight — no animation, no audio */}
          {isOpening && (
            <motion.div key="opening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="w-full py-3.5 rounded-xl text-center text-[13px] font-display uppercase tracking-widest animate-pulse"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}
            >
              Opening…
            </motion.div>
          )}

          {/* SPINNING: reel animation running — winner is locked, audio is playing */}
          {isSpinning && (
            <motion.div key="spinning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="w-full py-3.5 rounded-xl text-center text-[13px] font-display uppercase tracking-widest animate-pulse"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}
            >
              Spinning…
            </motion.div>
          )}

          {/* DONE: result — card already in inventory, show Sell or Open Another */}
          {isDone && !sold && winner && !actionMsg && (
            <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ delay: 0.12 }} className="flex flex-col gap-2"
            >
              {/* Card result preview */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: `${winCol}10`, border: `1px solid ${winCol}33` }}
              >
                {winner.cardImageUrl && (
                  <img src={winner.cardImageUrl} alt={winner.cardName} className="w-9 h-12 object-contain rounded-lg shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-display text-white truncate">{winner.cardName}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: winCol }}>
                    {RARITY_LABEL[winner.rarity] ?? winner.rarity}
                  </p>
                  <p className="text-[9px] text-white/40 mt-0.5">✅ Saved to your collection</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[15px] font-display font-bold" style={{ color: winCol }}>
                    ${Number(winner.estimatedValue).toFixed(2)}
                  </p>
                  <p className="text-[9px] text-white/30">value</p>
                </div>
              </div>

              {error && (
                <p className="text-center text-[11px] px-2 py-1.5 rounded-lg" style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  {error}
                </p>
              )}

              {/* Sell button + Open Another */}
              <div className="flex gap-2">
                <button onClick={handleReset}
                  className="flex-1 py-3 rounded-xl font-display text-[12px] uppercase tracking-widest transition-all active:scale-95 hover:brightness-110 flex items-center justify-center gap-1.5"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.14)', color: '#fff' }}
                >
                  Open Another
                </button>
                <button onClick={handleSell} disabled={selling}
                  className="flex-1 py-3 rounded-xl font-display text-[12px] uppercase tracking-widest transition-all active:scale-95 hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-1.5"
                  style={{ background: `${winCol}18`, border: `1.5px solid ${winCol}55`, color: winCol, boxShadow: `0 0 12px -4px ${winCol}66` }}
                >
                  <DollarSign size={12} /> {selling ? 'Selling...' : `Sell — $${Number(winner.estimatedValue).toFixed(2)}`}
                </button>
              </div>
            </motion.div>
          )}

          {/* SOLD: confirmation */}
          {(sold || actionMsg) && winner && (
            <motion.div key="sold" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2">
              {actionMsg && (
                <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-bold"
                  style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}
                >
                  <CheckCircle size={14} className="shrink-0" />
                  {actionMsg}
                </div>
              )}
              {error && (
                <p className="text-center text-[11px] px-2 py-1.5 rounded-lg" style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  {error}
                </p>
              )}
              <button onClick={handleReset}
                className="w-full py-3.5 rounded-xl font-display text-[13px] uppercase tracking-widest transition-all active:scale-95 hover:brightness-110"
                style={{ background: glow, color: openAnotherButtonTextColor, boxShadow: `0 0 18px -4px ${glow}88` }}
              >
                🎴 Open Another Pack
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};
