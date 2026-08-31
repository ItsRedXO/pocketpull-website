import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Pack } from '../data/mockData';
import { usePacks, PackCatalog, useUserCooldowns } from '../hooks/usePacks';
import { PackDetailsModal } from './PackDetailsModal';
import { useAuth } from '../hooks/useAuth';

interface Props {
  onPackOpen: (pack: Pack) => void;
}

// Build a compatibility shim: PackCatalog → Pack (for opening animation)
function catalogToMockPack(p: PackCatalog): Pack {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    tier: p.price <= 1 ? 'low' : p.price <= 10 ? 'mid' : 'high',
    emoji: '🎴',
    rarity: 'uncommon',
    borderColor: p.borderColor,
    glowColor: p.glowColor,
    description: p.description,
    odds: { common: 50, uncommon: 30, rare: 12, ultra: 6, secret: 2 },
    totalOpened: '0',
    featured: true,
    featuredCards: [],
    quantityLimit: p.quantityLimit,
    currentQuantity: p.currentQuantity,
    cooldownHours: p.cooldownHours,
    expiresAt: p.expiresAt,
  };
}

export const FeaturedPacksSection: React.FC<Props> = ({ onPackOpen }) => {
  const { user } = useAuth();
  const { data: packs = [], isLoading, isError, refetch } = usePacks();
  const { data: cooldowns = {} } = useUserCooldowns(user?.id);
  const [detailPack, setDetailPack] = useState<PackCatalog | null>(null);

  const activePacks = packs.filter(p => Number(p.isActive) === 1 && p.packType === 'standard');
  const vaultPacks = packs.filter(p => p.packType === 'mystery');

  return (
    <section
      className="pb-20 pt-0 px-4 md:px-6"
      style={{ backgroundColor: '#0a0b0f' }}
    >
      <div className="max-w-7xl mx-auto">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10"
        >
          <h2 className="font-display text-2xl md:text-3xl uppercase tracking-wider text-white">
            PocketPull Packs
          </h2>
          <div
            className="mt-1.5 h-[2px] w-24 rounded-full"
            style={{ background: 'linear-gradient(90deg, #00c8ff, #9b5cff)' }}
          />
        </motion.div>

        {/* Pack grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-72 rounded-2xl animate-pulse"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center mb-12">
            <p className="text-sm text-gray-400">Packs are temporarily unavailable.</p>
            <button onClick={() => refetch()} className="mt-4 px-4 py-2 rounded-lg bg-[#00c8ff]/15 border border-[#00c8ff]/30 text-[#00c8ff] text-xs font-bold">Try again</button>
          </div>
        ) : activePacks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
            {activePacks.map((pack, idx) => (
              <PackCard
                key={pack.id}
                pack={pack}
                index={idx}
                onDetails={() => setDetailPack(pack)}
                lastOpenedAt={cooldowns[pack.id]}
              />
            ))}
          </div>
        ) : null}

        {/* The Vault — reserved for Mystery Packs */}
        <section className="mt-6 pt-10 border-t border-white/8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10"
          >
            <h2 className="font-display text-2xl md:text-3xl uppercase tracking-wider text-white">
              The Vault
            </h2>
            <div
              className="mt-1.5 h-[2px] w-24 rounded-full"
              style={{ background: 'linear-gradient(90deg, #ffd700, #9b5cff)' }}
            />
          </motion.div>

          {vaultPacks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
              {vaultPacks.map((pack, idx) => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  index={idx}
                  onDetails={() => setDetailPack(pack)}
                  lastOpenedAt={cooldowns[pack.id]}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-32 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
              <p className="font-display text-lg uppercase tracking-[0.18em] text-white/60">
                Mystery Pack&apos;s Coming Soon!
              </p>
            </div>
          )}
        </section>

      </div>

      {/* Pack Details Modal */}
      <AnimatePresence>
        {detailPack && (
          <PackDetailsModal
            key={detailPack.id}
            pack={detailPack}
            onClose={() => setDetailPack(null)}
            onOpenPack={(pack) => { onPackOpen(pack); setDetailPack(null); }}
            mockPack={catalogToMockPack(detailPack)}
          />
        )}
      </AnimatePresence>
    </section>
  );
};

// ── Individual Pack Card ──────────────────────────────────────────────────────

interface PackCardProps {
  pack: PackCatalog;
  index: number;
  onDetails: () => void;
  lastOpenedAt?: string;
}

const PackCard: React.FC<PackCardProps> = ({ pack, index, onDetails, lastOpenedAt }) => {
  const [hovered, setHovered] = useState(false);
  const glow = pack.glowColor || '#00c8ff';

  const isFree = Number(pack.price) === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col rounded-2xl cursor-pointer select-none overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #0d0f1c 0%, #090b14 100%)',
        border: `1.5px solid ${hovered ? glow + '88' : glow + '28'}`,
        boxShadow: hovered
          ? `0 0 32px -6px ${glow}66, 0 12px 40px rgba(0,0,0,0.6)`
          : `0 0 12px -6px ${glow}33, 0 4px 16px rgba(0,0,0,0.4)`,
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
      }}
      onClick={onDetails}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${glow}18 0%, transparent 65%)`,
          opacity: hovered ? 1 : 0.4,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Quantity badge if limited */}
      {pack.quantityLimit > 0 && (
        <div className="absolute top-3 left-3 z-20 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex flex-col items-start gap-0">
          <span className="text-[8px] uppercase tracking-wider text-white/40 leading-none">Stock</span>
          <span className={`text-[11px] font-display font-bold leading-none mt-0.5 ${pack.currentQuantity <= 10 ? 'text-red-400' : 'text-green-400'}`}>
            {pack.currentQuantity.toLocaleString()}
          </span>
        </div>
      )}

      {/* Pack image */}
      <div className="relative flex items-center justify-center pt-6 pb-3 px-4" style={{ minHeight: '180px' }}>
        <motion.img
          src={pack.imageUrl}
          alt={pack.name}
          className="relative z-10 max-h-[160px] w-auto object-contain"
          animate={hovered ? { scale: 1.06, y: -4 } : { scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{
            filter: hovered
              ? `drop-shadow(0 0 20px ${glow}cc) drop-shadow(0 4px 12px ${glow}66)`
              : `drop-shadow(0 0 10px ${glow}55) drop-shadow(0 2px 8px rgba(0,0,0,0.5))`,
            transition: 'filter 0.35s ease',
          }}
        />
      </div>

      {/* Info */}
      <div className="relative z-10 px-4 pb-5 flex flex-col gap-2">
        {/* Name */}
        <h3 className="font-display text-[15px] uppercase tracking-wide leading-tight"
          style={{ color: pack.nameColor || '#ffffff' }}
        >
          {pack.name}
        </h3>

        {/* Price & Cooldown */}
        <div className="flex flex-col gap-1.5">
          <span
            className="self-start px-2.5 py-0.5 rounded-full font-display text-[13px] font-bold"
            style={{
              background: `${glow}18`,
              border: `1.5px solid ${glow}44`,
              color: pack.priceColor || glow,
              textShadow: `0 0 8px ${pack.priceColor || glow}99`,
            }}
          >
            {isFree ? 'Free' : `${Number(pack.price).toFixed(2)}`}
          </span>

          {lastOpenedAt && pack.cooldownHours > 0 && (
            <CooldownTimer 
              lastOpenedAt={lastOpenedAt} 
              cooldownHours={pack.cooldownHours} 
              glow={glow}
            />
          )}
        </div>

        {/* Description */}
        {pack.description && (
          <p className="text-[11px] leading-snug"
            style={{ color: pack.descriptionColor || 'rgba(255,255,255,0.4)' }}
          >
            {pack.description}
          </p>
        )}

        {/* Click hint */}
        <p className="text-[10px] uppercase tracking-[0.18em] mt-1" style={{ color: `${glow}66` }}>
          Click to view odds →
        </p>
      </div>
    </motion.div>
  );
};

const CooldownTimer: React.FC<{ lastOpenedAt: string; cooldownHours: number; glow: string }> = ({ lastOpenedAt, cooldownHours, glow }) => {
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
    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: timeLeft === 'Available now' ? '#10b981' : '#f87171' }}>
      {timeLeft}
    </p>
  );
};
