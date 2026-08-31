import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, History, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { blink } from '../lib/blink';

const RARITY_COLOR: Record<string, string> = {
  common: '#8892a4', uncommon: '#10b981', rare: '#00c8ff',
  ultra: '#9b5cff', secret: '#ffd700', god: '#ff00ff',
};

const PER_PAGE = 50;

interface PullRow {
  id: string; userId: string; packName: string; cost: number; createdAt: string;
  cardName?: string; rarity?: string; cardImageUrl?: string | null;
  username?: string;
}

/** Lightweight zoom modal for a pull's card image. */
function PullCardZoom({ card, onClose }: { card: PullRow | null; onClose: () => void }) {
  if (!card) return null;
  const rarityColor = RARITY_COLOR[card.rarity || 'common'] || '#8892a4';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/85 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
          className="relative max-w-sm w-full bg-[#0d0f1c] rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button onClick={onClose} className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X size={14} />
          </button>

          {/* Card image */}
          <div className="relative bg-black/40 p-6 flex items-center justify-center">
            {card.cardImageUrl ? (
              <img
                src={card.cardImageUrl}
                alt={card.cardName || 'Card'}
                className="max-h-[320px] w-auto object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.15)] rounded-lg"
              />
            ) : (
              <div className="w-40 h-56 rounded-xl bg-white/5 flex items-center justify-center">
                <span className="text-5xl">🃏</span>
              </div>
            )}
            <div
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{ background: `radial-gradient(circle at center, ${rarityColor} 0%, transparent 70%)` }}
            />
          </div>

          {/* Info footer */}
          <div className="p-4 border-t border-white/5 space-y-2">
            <div>
              <h3 className="text-base font-display text-white uppercase truncate">{card.cardName || '—'}</h3>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: rarityColor }}>
                {card.rarity || '—'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div><span className="text-white/30">Pack</span><p className="text-white/70 truncate">{card.packName}</p></div>
              <div><span className="text-white/30">Cost</span><p className="text-[#10b981] font-bold">${card.cost.toFixed(2)}</p></div>
              <div><span className="text-white/30">User</span><p className="text-white/70 truncate">{card.username}</p></div>
              <div><span className="text-white/30">Date</span><p className="text-white/70">{card.createdAt ? new Date(card.createdAt).toLocaleString() : '—'}</p></div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function PullsTab() {
  const [page, setPage] = useState(0);
  const [selectedCard, setSelectedCard] = useState<PullRow | null>(null);

  // ── Card image lookup: fetch all packCards once, key by name::rarity ──────
  const { data: cardImageMap = {} } = useQuery<Record<string, string>>({
    queryKey: ['admin-packcard-images'],
    queryFn: async () => {
      try {
        const rows = await blink.db.packCards.list({ limit: 2000 }) as any[];
        const map: Record<string, string> = {};
        for (const r of rows) {
          const key = `${(r.cardName || '').toLowerCase()}::${(r.rarity || '').toLowerCase()}`;
          if (!map[key] && r.cardImageUrl) map[key] = r.cardImageUrl;
        }
        return map;
      } catch { return {}; }
    },
    staleTime: 60_000,
  });

  // ── Total pull count ─────────────────────────────────────────────────────
  const { data: totalPulls = 0 } = useQuery<number>({
    queryKey: ['admin-pulls-count'],
    queryFn: async () => {
      const n = await blink.db.packsOpened.count();
      return typeof n === 'number' ? n : 0;
    },
    staleTime: 5_000,
    refetchInterval: 5000,
  });

  const totalPages = Math.max(1, Math.ceil(totalPulls / PER_PAGE));

  // Clamp page if data shrinks (e.g. pulls deleted by another action)
  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  // ── Paginated pulls ──────────────────────────────────────────────────────
  const { data: pulls = [], isLoading, refetch, isRefetching } = useQuery<PullRow[]>({
    queryKey: ['admin-pulls', page],
    queryFn: async () => {
      const [rows, users] = await Promise.all([
        blink.db.packsOpened.list({
          orderBy: { createdAt: 'desc' },
          limit: PER_PAGE,
          offset: page * PER_PAGE,
        }),
        blink.db.users.list({ limit: 1000 }),
      ]);

      const userMap: Record<string, string> = {};
      (users as any[]).forEach(u => {
        userMap[u.id] = u.username || u.displayName || u.email || '';
      });

      return (rows as any[]).map((r: any) => {
        const nameKey = `${(r.cardName || '').toLowerCase()}::${(r.rarity || '').toLowerCase()}`;
        return {
          id: r.id, userId: r.userId, packName: r.packName,
          cost: Number(r.cost) || 0, createdAt: r.createdAt || '',
          cardName: r.cardName || '—', rarity: r.rarity || '—',
          cardImageUrl: cardImageMap[nameKey] || null,
          username: userMap[r.userId] || r.userId,
        };
      });
    },
    staleTime: 0,
    refetchInterval: 5000,
  });

  // Recompute cardImageUrl after map loads
  const enrichedPulls: PullRow[] = React.useMemo(() => {
    if (!cardImageMap || Object.keys(cardImageMap).length === 0) return pulls;
    return pulls.map(p => {
      if (p.cardImageUrl) return p;
      const key = `${(p.cardName || '').toLowerCase()}::${(p.rarity || '').toLowerCase()}`;
      return { ...p, cardImageUrl: cardImageMap[key] || null };
    });
  }, [pulls, cardImageMap]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display text-xl uppercase tracking-wider text-white">Recent Pack Openings</h2>
          <p className="text-[11px] text-white/30 mt-0.5">
            {totalPulls.toLocaleString()} total · Page {page + 1} of {totalPages}
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isLoading || isRefetching}
          className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all disabled:opacity-30">
          <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {isLoading && pulls.length === 0 ? (
        <div className="flex flex-col gap-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}</div>
      ) : enrichedPulls.length === 0 ? (
        <div className="text-center py-16">
          <History size={36} className="text-white/15 mx-auto mb-3" />
          <p className="text-white/20 text-sm">No packs opened yet.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[48px_1.2fr_1.5fr_1.2fr_0.7fr_1fr] gap-3 px-3 pb-2 text-[9px] uppercase tracking-widest text-white/25 font-display">
              <span></span><span>Pack</span><span>Card Pull</span><span>Username</span><span>Cost</span><span>Date</span>
            </div>
            {enrichedPulls.map(p => (
              <div key={p.id} className="grid grid-cols-[48px_1.2fr_1.5fr_1.2fr_0.7fr_1fr] gap-3 px-3 py-2 rounded-xl items-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Card image thumbnail */}
                <div
                  className="w-12 h-14 rounded-md bg-black/30 border border-white/5 overflow-hidden flex items-center justify-center cursor-pointer hover:border-white/20 transition-colors shrink-0"
                  title="Click to zoom"
                  onClick={() => setSelectedCard(p)}
                >
                  {p.cardImageUrl ? (
                    <img src={p.cardImageUrl} alt={p.cardName || 'Card'} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">🃏</span>
                  )}
                </div>
                <span className="text-[12px] text-white font-display truncate">{p.packName}</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] text-white truncate">{p.cardName}</span>
                  {p.rarity !== '—' && (
                    <span className="text-[8px] font-bold uppercase" style={{ color: RARITY_COLOR[p.rarity || 'common'] }}>
                      {p.rarity}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-white/60 truncate" title={p.username}>{p.username}</span>
                <span className="text-[12px] font-bold" style={{ color: '#10b981' }}>${p.cost.toFixed(2)}</span>
                <span className="text-[10px] text-white/25">{p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</span>
              </div>
            ))}
          </div>

          {/* Pagination controls */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
            <p className="text-[9px] text-white/20">
              Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, totalPulls)} of {totalPulls.toLocaleString()}
            </p>
            <div className="flex gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                // Show pages around current page
                const start = Math.max(0, Math.min(page - 3, totalPages - 7));
                const pageNum = start + i;
                if (pageNum >= totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className="w-7 h-7 rounded-lg text-[10px] font-bold transition-all"
                    style={{
                      background: pageNum === page ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                      border: pageNum === page ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
                      color: pageNum === page ? '#fff' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Zoom modal */}
      <PullCardZoom card={selectedCard} onClose={() => setSelectedCard(null)} />
    </>
  );
}
