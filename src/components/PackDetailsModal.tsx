import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LockKeyhole, Sparkles, ShieldCheck } from 'lucide-react';
import { PackCatalog, usePackCards, useUserCooldowns } from '../hooks/usePacks';
import { PackSpinner } from './PackSpinner';
import type { Pack } from '../data/mockData';
import { useAuth, useUserStats } from '../hooks/useAuth';
import { CardImageLightbox } from './CardImageLightbox';
import { MysteryPackReveal } from './MysteryPackReveal';

// ── Rarity config ──────────────────────────────────────────────────────────────
const RARITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  common:   { label: 'Common',      color: '#8892a4', bg: 'rgba(136,146,164,0.10)' },
  uncommon: { label: 'Uncommon',    color: '#10b981', bg: 'rgba(16,185,129,0.10)'  },
  rare:     { label: 'Rare',        color: '#00c8ff', bg: 'rgba(0,200,255,0.10)'   },
  ultra:    { label: 'Ultra Rare',  color: '#9b5cff', bg: 'rgba(155,92,255,0.10)'  },
  secret:   { label: 'Secret Rare', color: '#ffd700', bg: 'rgba(255,215,0,0.10)'   },
  god:      { label: 'GOD PULL',    color: '#ff00ff', bg: 'rgba(255,0,255,0.10)'   },
};

interface Props {
  pack: PackCatalog | null;
  onClose: () => void;
  onOpenPack: (pack: Pack) => void;  // kept for interface compatibility
  mockPack: Pack;
}

interface LightboxCard {
  src: string;
  alt: string;
  rarityColor: string;
}

export const PackDetailsModal: React.FC<Props> = ({ pack, onClose }) => {
  const { user } = useAuth();
  const { data: cards = [], isLoading: cardsLoading } = usePackCards(pack?.id ?? null);
  const { data: cooldowns = {} } = useUserCooldowns(user?.id);
  const { stats, updateBalance } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const glow = pack?.glowColor ?? '#00c8ff';
  const [lightbox, setLightbox] = useState<LightboxCard | null>(null);
  const isMystery = pack?.packType === 'mystery';
  const originalTotal = isMystery ? cards.reduce((sum, card) => sum + Number(card.originalQuantity ?? card.quantity ?? 0), 0) : 0;
  const remainingTotal = isMystery ? cards.reduce((sum, card) => sum + Number(card.quantity ?? 0), 0) : 0;
  const collectedTotal = Math.max(0, originalTotal - remainingTotal);
  const tierFor = (card: typeof cards[number]) => card.rarity === 'god' || card.rarity === 'secret' ? 'Chase Cards' : card.rarity === 'ultra' || card.rarity === 'rare' ? 'Premium Cards' : 'Base Cards';
  const tierTotals = ['Chase Cards', 'Premium Cards', 'Base Cards'].map(label => ({ label, total: cards.filter(card => tierFor(card) === label).reduce((sum, card) => sum + Number(card.originalQuantity ?? card.quantity ?? 0), 0) }));
  const isVaulted = isMystery && originalTotal > 0 && remainingTotal === 0;

  const lastOpenedAt = pack ? cooldowns[pack.id] : undefined;
  const isFree = pack && Number(pack.price) === 0;

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!pack) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [pack]);

  // Sync parent balance display after pack open
  const handleComplete = (newBalance: number) => {
    updateBalance(newBalance);
  };

  return (
    <AnimatePresence>
      {pack && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[100]"
            style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(14px)' }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-2 sm:p-4 md:p-6 pointer-events-none"
          >
            <div 
              className="relative w-full max-w-[1100px] rounded-3xl flex flex-col shadow-2xl pointer-events-auto overflow-y-auto max-h-[95vh] sm:max-h-[90vh] overscroll-contain scrollbar-none"
              style={{
                background: 'linear-gradient(160deg, #0d0f1c 0%, #090b14 100%)',
                border: `1.5px solid ${glow}44`,
                boxShadow: `0 0 80px -10px ${glow}44, 0 40px 100px rgba(0,0,0,0.9)`,
                WebkitOverflowScrolling: 'touch',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-[40] w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95 bg-white/10 border border-white/10 backdrop-blur-md"
              >
                <X size={18} className="text-white" />
              </button>

              {/* ── BODY: left panel + right content ── */}
              <div className="flex flex-col lg:flex-row min-h-0 overflow-visible">

                {/* LEFT — pack art, name, price, description */}
                <div
                  className="flex flex-col items-center lg:w-[300px] shrink-0 px-6 sm:px-8 pt-12 pb-10 lg:border-r relative"
                  style={{ borderColor: `${glow}22` }}
                >
                  {/* Glow orb */}
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      width: '260px', height: '200px',
                      top: 0, left: 0,
                      background: `radial-gradient(ellipse, ${glow}22 0%, transparent 70%)`,
                      filter: 'blur(28px)',
                    }}
                  />

                  {/* Pack image */}
                  <div className="relative flex items-center justify-center" style={{ height: '170px' }}>
                    <img
                      src={pack.imageUrl}
                      alt={pack.name}
                      style={{
                        height: '166px',
                        width: 'auto',
                        maxWidth: '190px',
                        objectFit: 'contain',
                        filter: `drop-shadow(0 0 24px ${glow}bb) drop-shadow(0 4px 16px ${glow}66)`,
                      }}
                    />
                  </div>

                  {/* Name */}
                  <h2
                    className="mt-4 font-display text-xl uppercase tracking-wider text-center leading-tight"
                    style={{ 
                      color: pack.nameColor || '#ffffff',
                      textShadow: `0 0 18px ${glow}66` 
                    }}
                  >
                    {pack.name}
                  </h2>

                  {/* Price */}
                  <div
                    className="mt-3 px-5 py-1.5 rounded-full font-display text-base"
                    style={{
                      background: `${glow}18`,
                      border: `1.5px solid ${glow}55`,
                      color: pack.priceColor || glow,
                      textShadow: `0 0 10px ${pack.priceColor || glow}99`,
                    }}
                  >
                    {isFree ? 'Free' : `$${Number(pack.price).toFixed(2)}`}
                  </div>

                  {/* Stock Info */}
                  {pack.quantityLimit > 0 && (
                    <div className="mt-3 flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${pack.currentQuantity / pack.quantityLimit < 0.2 ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.max(0, Math.min(100, (pack.currentQuantity / pack.quantityLimit) * 100))}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-white/40">
                          {Math.round((pack.currentQuantity / pack.quantityLimit) * 100)}%
                        </span>
                      </div>
                      <p className="text-[10px] uppercase tracking-wider text-white/30">
                        {pack.currentQuantity.toLocaleString()} / {pack.quantityLimit.toLocaleString()} IN STOCK
                      </p>
                    </div>
                  )}

                  {/* Expiration Info */}
                  {pack.expiresAt && (
                    <div className="mt-3 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-[9px] uppercase tracking-widest text-red-400 font-bold text-center">
                        EXPIRES: {new Date(pack.expiresAt).toLocaleDateString()} {new Date(pack.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}

                  {/* Cooldown Info */}
                  {pack.cooldownHours > 0 && (
                    <div className="mt-2 text-center">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-bold mb-1">
                        {pack.cooldownHours}H COOLDOWN PER USER
                      </p>
                      {lastOpenedAt && (
                        <ModalCooldownTimer
                          lastOpenedAt={lastOpenedAt}
                          cooldownHours={pack.cooldownHours}
                        />
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {pack.description && (
                    <p className="mt-3 text-[11px] text-center leading-relaxed"
                      style={{ color: pack.descriptionColor || 'rgba(255,255,255,0.4)' }}
                    >
                      {pack.description}
                    </p>
                  )}

                  {/* Divider */}
                  <div
                    className="mt-6 w-full h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${glow}33, transparent)` }}
                  />

                  {/* Rarity legend */}
                  <div className="mt-5 w-full flex flex-col gap-2">
                    {(isMystery
                      ? [
                          { key: 'common', label: 'Base', color: '#ffd700' },
                          { key: 'rare', label: 'Premium', color: '#d6d9df' },
                          { key: 'secret', label: 'Chase', color: '#39d98a' },
                        ]
                      : Object.entries(RARITY_CFG).map(([key, cfg]) => ({ key, label: cfg.label, color: cfg.color }))
                    ).map(({ key, label, color }) => (
                      <div key={key} className="flex items-center justify-between text-[11px]">
                        <span className="font-bold uppercase tracking-wider" style={{ color }}>
                          {label}
                        </span>
                        <span className="text-white/25">
                          {cards.filter(c => c.rarity === key).length} card{cards.filter(c => c.rarity === key).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Balance display */}
                  {stats && (
                    <div
                      className="mt-5 w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px]"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <span className="text-white/40 uppercase tracking-wider">Balance</span>
                      <span
                        className="font-display font-bold"
                        style={{ color: stats.balance >= pack.price ? '#10b981' : '#f87171' }}
                      >
                        ${stats.balance.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* RIGHT — spinner + card grid */}
                <div className="flex-1 flex flex-col min-h-0 lg:overflow-y-auto lg:max-h-none" style={{ scrollbarWidth: 'thin', scrollbarColor: `${glow}33 transparent` }}>

                  {/* ── Opening experience ── */}
                  <div className="p-4 sm:p-8 lg:p-10 shrink-0">
                    {cardsLoading ? (
                      <div className="rounded-2xl animate-pulse" style={{ height: 280, background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.06)' }} />
                    ) : isMystery ? (
                      <MysteryPackReveal
                        pack={pack}
                        cards={cards}
                        originalTotal={originalTotal}
                        collectedTotal={collectedTotal}
                        tierTotals={tierTotals}
                        isVaulted={isVaulted}
                        onComplete={handleComplete}
                      />
                    ) : (
                      <PackSpinner pack={pack} cards={cards} onComplete={handleComplete} />
                    )}
                  </div>

                  {/* Divider */}
                  <div
                    className="mx-8 lg:mx-10 h-px shrink-0"
                    style={{ background: `linear-gradient(90deg, transparent, ${glow}22, transparent)` }}
                  />

                  {/* ── All Possible Pulls card grid ── */}
                  <div className="p-4 sm:p-8 lg:p-12 pb-16 lg:pb-12">
                    <h3 className="font-display text-[11px] uppercase tracking-[0.3em] text-white/30 mb-10 px-1">
                      {isMystery ? 'All Possible Cards' : `All Possible Pulls · ${cards.length} cards`}
                    </h3>
                    {isMystery && !isVaulted && (
                      <div className="mb-8 rounded-xl p-4 bg-white/[0.03] border border-white/8">
                        <div className="flex items-center gap-2 text-[#ffd700] text-[10px] uppercase tracking-[0.2em] font-bold"><ShieldCheck size={14} /> Vault Rules & Odds</div>
                        <p className="mt-2 text-xs leading-relaxed text-white/45">Each rip reveals one card from the remaining inventory. Odds are based on the configured card pool, and quantities shown above are the original tier totals.</p>
                      </div>
                    )}
                    {isMystery && isVaulted && (
                      <h3 className="font-display text-[11px] uppercase tracking-[0.3em] text-white/30 mb-10 px-1">Complete Vault Contents · {cards.length} cards</h3>
                    )}

                    {cardsLoading ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                        {Array.from({ length: 22 }).map((_, i) => (
                          <div
                            key={i}
                            className="rounded-xl animate-pulse"
                            style={{ background: 'rgba(255,255,255,0.04)', minHeight: '200px' }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                        {cards.map((card) => {
                          const cfg = isMystery
                            ? card.rarity === 'secret' || card.rarity === 'god'
                              ? { label: 'Chase', color: '#ffd700', bg: 'rgba(255,215,0,0.14)' }
                              : card.rarity === 'rare' || card.rarity === 'ultra'
                                ? { label: 'Premium', color: '#d6d9df', bg: 'rgba(214,217,223,0.14)' }
                                : { label: 'Base', color: '#39d98a', bg: 'rgba(57,217,138,0.14)' }
                            : RARITY_CFG[card.rarity] ?? RARITY_CFG.common;
                          const isGod = !isMystery && card.rarity === 'god';
                          const pct = Number(card.pullChance);
                          const pctStr = pct < 0.1 ? pct.toFixed(3) : pct < 1 ? pct.toFixed(2) : pct.toFixed(1);

                          return (
                            <div
                              key={card.id}
                              className="flex flex-col rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 hover:translate-y-[-4px] group"
                              style={{ background: cfg.bg, border: `1px solid ${cfg.color}33` }}
                            >
                              <div
                                className="w-full flex items-center justify-center relative overflow-hidden"
                                style={{ height: '200px', background: 'rgba(0,0,0,0.4)' }}
                              >
                                {card.cardImageUrl ? (
                                  <img
                                    src={card.cardImageUrl}
                                    alt={card.cardName}
                                    loading="lazy"
                                    className="h-full w-auto object-contain py-3 cursor-zoom-in transition-all duration-700 group-hover:scale-110 group-hover:rotate-1"
                                    onClick={() => setLightbox({ src: card.cardImageUrl!, alt: card.cardName, rarityColor: cfg.color })}
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                ) : (
                                  <span className="text-6xl opacity-30">🃏</span>
                                )}
                              </div>
                              <div className="px-4 py-4 flex flex-col gap-2 bg-black/30">
                                <p className="text-[14px] font-display text-white leading-tight truncate group-hover:text-clip">{card.cardName}</p>
                                <div className="flex items-center justify-between">
                                  <p
                                    className="text-[11px] font-bold uppercase tracking-wider"
                                    style={
                                      isGod
                                        ? { background: 'linear-gradient(90deg,#ff0060,#9b5cff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                                        : { color: cfg.color }
                                    }
                                  >
                                    {cfg.label}
                                  </p>
                                  <span className="text-[9px] text-white/30">${Number(card.estimatedValue).toFixed(2)}</span>
                                </div>
                                <div className="mt-1 flex items-center gap-1.5">
                                  <div className="flex-1 h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.min(100, pct * (pct > 1 ? 3 : pct > 0.1 ? 30 : 300))}%`,
                                        background: cfg.color,
                                        opacity: 0.7,
                                      }}
                                    />
                                  </div>
                                  <span className="text-[9px] font-display shrink-0" style={{ color: cfg.color }}>
                                    {pctStr}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Card image lightbox */}
      {lightbox && (
        <CardImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          rarityColor={lightbox.rarityColor}
          onClose={() => setLightbox(null)}
        />
      )}
    </AnimatePresence>
  );
};

const ModalCooldownTimer: React.FC<{ lastOpenedAt: string; cooldownHours: number }> = ({ lastOpenedAt, cooldownHours }) => {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    const updateTimer = () => {
      const last = new Date(lastOpenedAt).getTime();
      const now = new Date().getTime();
      const cooldownMs = cooldownHours * 60 * 60 * 1000;
      const diff = last + cooldownMs - now;

      if (diff <= 0) {
        setTimeLeft('Available now');
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`Available in: ${h}h ${m}m ${s}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lastOpenedAt, cooldownHours]);

  if (!timeLeft) return null;

  return (
    <span className={`text-[10px] font-bold ${timeLeft === 'Available now' ? 'text-green-400' : 'text-red-400'}`}>
      {timeLeft}
    </span>
  );
};