import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { X, Package, DollarSign, Swords, ShoppingCart, Sparkles, ArrowRightLeft, CreditCard, Crown, Bot, Activity } from 'lucide-react';
import { blink } from '../lib/blink';
import type { TimelineEntry } from './activityTypes';

// ── Safe helpers ────────────────────────────────────────────────────────────
function n(v: any, d = 0): number { const x = Number(v); return Number.isFinite(x) ? x : d; }
function s(v: any, d = ''): string { if (v == null) return d; return typeof v === 'string' ? v : String(v); }
function a(v: any): any[] { return Array.isArray(v) ? v : []; }

// ── Icons per type ──────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, React.ReactNode> = {
  pack_open: <Package size={12} />, sell: <DollarSign size={12} />,
  battle: <Swords size={12} />, cashout: <ShoppingCart size={12} />,
  deposit: <CreditCard size={12} />, upgrade: <Sparkles size={12} />,
  exchange: <ArrowRightLeft size={12} />,
};
const typeColorMap: Record<string, string> = {
  pack_open: '#9b5cff', sell: '#f59e0b', battle: '#f87171', cashout: '#f59e0b',
  deposit: '#10b981', upgrade: '#ffd700', exchange: '#00c8ff',
};

export function ActivityDetailPopup({ entry, onClose }: { entry: TimelineEntry; onClose: () => void }) {
  if (!entry.logData) return null;
  const { type, action, details = {}, valueIn = 0, valueOut = 0, result = '', createdAt = '' } = entry.logData;
  const tc = typeColorMap[type] || '#8892a4';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(4,5,10,0.88)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl p-5"
        style={{
          background: 'linear-gradient(160deg, #0d0f1a 0%, #0a0c14 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 0 0 1px rgba(0,200,255,0.06), 0 0 40px -8px rgba(0,200,255,0.12), 0 20px 60px rgba(0,0,0,0.7)',
          scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent',
        }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/20 hover:text-white/50 transition-colors z-10">
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: tc + '20', color: tc }}>
            {TYPE_ICONS[type] || <Activity size={12} />}
          </div>
          <div>
            <h4 className="font-display text-sm text-white uppercase tracking-wide">{s(action, entry.title)}</h4>
            <p className="text-[10px] text-white/30">{createdAt ? new Date(createdAt).toLocaleString() : ''}</p>
          </div>
        </div>

        <SafeView>
          {(type === 'pack_open') && <PackDetails details={details} valueIn={valueIn} valueOut={valueOut} />}
          {(type === 'sell') && <SellDetails details={details} valueIn={valueIn} />}
          {(type === 'battle') && <BattleDetails details={details} valueIn={valueIn} valueOut={valueOut} result={result} />}
          {(type === 'cashout') && <CashoutDetails details={details} valueOut={valueOut} result={result} />}
          {(type === 'deposit') && <DepositDetails details={details} valueIn={valueIn} result={result} createdAt={createdAt} />}
          {(type === 'upgrade') && <UpgradeDetails details={details} result={result} valueIn={valueIn} valueOut={valueOut} />}
          {(type === 'exchange') && <ExchangeDetails details={details} />}
          {!TYPE_ICONS[type] && <UnknownDetails entry={entry} />}
        </SafeView>
      </motion.div>
    </motion.div>
  );
}

// ── Error-safe wrapper ──────────────────────────────────────────────────────
class SafeView extends React.Component<{ children: React.ReactNode }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() {
    if (this.state.err) return <p className="text-[10px] text-white/20 py-3 text-center">Could not load details.</p>;
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Pack Opening Details ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function PackDetails({ details, valueIn, valueOut }: { details: any; valueIn: number; valueOut: number }) {
  return (
    <div className="space-y-3">
      <div className="p-2.5 rounded-lg text-center text-[11px] font-bold uppercase tracking-wider bg-[#9b5cff]/10 text-[#9b5cff] border border-[#9b5cff]/20">
        Pack Opened
      </div>
      <Row label="Pack Name" value={details?.packName || '—'} />
      <Row label="Pack Price" value={`$${Number(details?.packCost || valueIn || 0).toFixed(2)}`} valueColor="text-red-400" />
      <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <p className="text-[9px] uppercase tracking-wider text-white/25 mb-2">Card Pulled</p>
        <div className="flex gap-3 items-center">
          {details?.cardWon && (
            <div className="flex-1">
              <p className="text-[11px] text-white font-bold">{details.cardWon}</p>
              {details?.rarity && (
                <p className="text-[9px] uppercase tracking-wider text-[#9b5cff]/70 font-bold">{details.rarity}</p>
              )}
            </div>
          )}
          <span className="text-[12px] font-display font-bold text-green-400">${Number(details?.cardValue || valueOut || 0).toFixed(2)}</span>
        </div>
      </div>
      <Divider />
      <Row label="Cost" value={`-$${Number(valueIn || 0).toFixed(2)}`} valueColor="text-red-400" />
      <Row label="Card Value" value={`+$${Number(valueOut || 0).toFixed(2)}`} valueColor="text-green-400" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Card Sold Details ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function SellDetails({ details, valueIn }: { details: any; valueIn: number }) {
  const cards = Array.isArray(details?.cards) ? details.cards : [];
  const singleCard = details?.cardName ? [{
    name: details.cardName,
    value: details.value,
    rarity: details.rarity,
    cardImageUrl: details.cardImageUrl,
    packName: details.packName,
  }] : [];
  const soldCards = cards.length > 0 ? cards : singleCard;
  const totalValue = Number(details?.totalValue || valueIn || 0);
  const isBulk = soldCards.length > 1 || Number(details?.totalCards || 0) > 1;
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);
  const cardNames = soldCards.map((card: any) => card.name || card.cardName).filter(Boolean);
  const { data: catalogCards = [] } = useQuery<any[]>({
    queryKey: ['admin-sale-card-images', cardNames],
    queryFn: async () => {
      try {
        return await blink.db.table('packCards').list({ limit: 5000 });
      } catch {
        return [];
      }
    },
    enabled: soldCards.some((card: any) => !(card.cardImageUrl || card.imageUrl)),
    staleTime: 5 * 60 * 1000,
  });
  const catalogByName = new Map(catalogCards.map((card: any) => [String(card.cardName || '').toLowerCase(), card]));

  return (
    <div className="space-y-3">
      <div className="p-2.5 rounded-lg text-center text-[11px] font-bold uppercase tracking-wider bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">
        {isBulk ? `Cards Sold (${details?.totalCards || soldCards.length})` : 'Card Sold'}
      </div>
      {soldCards.length > 0 ? (
        <div className="space-y-2">
          {soldCards.map((card: any, index: number) => {
            const name = card.name || card.cardName || 'Unknown Card';
            const value = Number(card.value || card.estimatedValue || 0);
            const catalogCard = catalogByName.get(name.toLowerCase());
            const imageUrl = card.cardImageUrl || card.imageUrl || catalogCard?.cardImageUrl;
            return (
              <div key={`${name}-${index}`} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {imageUrl ? (
                  <button type="button" onClick={() => setPreview({ src: imageUrl, alt: name })} className="w-12 h-16 rounded-md shrink-0 cursor-zoom-in hover:ring-2 hover:ring-[#00c8ff]/60 transition-all overflow-hidden" title={`View ${name}`}>
                    <img src={imageUrl} alt={name} className="w-full h-full object-contain" />
                  </button>
                ) : (
                  <div className="w-12 h-16 rounded-md bg-white/5 flex items-center justify-center text-[8px] text-white/20 shrink-0">NO IMAGE</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-white font-bold truncate">{name}</p>
                  {card.rarity && <p className="text-[9px] uppercase tracking-wider text-[#f59e0b]/70 font-bold">{card.rarity}</p>}
                  {card.packName && <p className="text-[9px] text-white/25 mt-0.5 truncate">From: {card.packName}</p>}
                </div>
                <span className="text-[11px] text-green-400 font-bold shrink-0">+${value.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px] text-amber-300/70 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">Card details were not recorded for this sale.</p>
      )}
      <Divider />
      <Row label={isBulk ? 'Total Sale Value' : 'Sale Price'} value={`+$${totalValue.toFixed(2)}`} valueColor="text-green-400" />
      {preview && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.86)' }} onClick={() => setPreview(null)}>
          <div className="relative max-w-sm w-full rounded-2xl p-3 bg-[#0d0f1a] border border-white/10" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setPreview(null)} className="absolute top-2 right-2 z-10 text-white/50 hover:text-white"><X size={16} /></button>
            <img src={preview.src} alt={preview.alt} className="w-full max-h-[70vh] object-contain rounded-xl" />
            <p className="text-center text-xs text-white/70 mt-2">{preview.alt}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Battle Details ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function BattleDetails({ details, valueIn, valueOut, result }: { details: any; valueIn: number; valueOut: number; result: string }) {
  const mode = details?.mode || 'standard';
  const packNames = details?.packNames || '—';
  const players = details?.players || [];
  const winner = details?.winner || {};
  const totalPot = Number(details?.totalPot || valueIn || 0);
  const isShared = details?.isShared === true;
  const isDraw = details?.isDraw === true;
  const myResult = details?.myResult;

  // Determine result label for the selected user
  let resultLabel: string;
  let resultColor: string;
  if (isShared) {
    resultLabel = '🤝 SHARED REWARDS';
    resultColor = 'text-[#00c8ff] border-[#00c8ff]/20 bg-[#00c8ff]/10';
  } else if (isDraw) {
    resultLabel = '⚖️ DRAW';
    resultColor = 'text-amber-400 border-amber-500/20 bg-amber-500/10';
  } else if (myResult?.isWinner) {
    resultLabel = '🎉 Battle WON';
    resultColor = 'text-green-400 border-green-500/20 bg-green-500/10';
  } else {
    resultLabel = '💔 Battle LOST';
    resultColor = 'text-red-400 border-red-500/20 bg-red-500/10';
  }

  const modeLabel = mode === 'underdog' ? 'Underdog' : mode === 'shared' ? 'Shared' : 'Standard';

  return (
    <div className="space-y-3">
      <div className={`p-2.5 rounded-lg text-center text-[11px] font-bold uppercase tracking-wider border ${resultColor}`}>
        {resultLabel}
      </div>
      <Row label="Mode" value={modeLabel} />
      <Row label="Packs Used" value={packNames} />
      <Row label="Total Pot" value={`${totalPot.toFixed(2)}`} valueColor="text-[#ffd700]" />

      {/* User's personal result value */}
      {myResult && (
        <Row
          label={isShared ? 'My Share' : isDraw ? 'My Value' : myResult.isWinner ? 'Won Value' : 'My Value'}
          value={`${Number(myResult.totalValue || 0).toFixed(2)}`}
          valueColor={isShared || myResult.isWinner ? 'text-green-400' : 'text-red-400'}
        />
      )}

      {/* Players */}
      {players.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-white/25 mb-1.5">Players</p>
          {players.map((p: any, i: number) => (
            <div key={i} className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-[10px] ${p.isWinner ? 'border border-green-500/20' : ''}`}
              style={{ background: p.isWinner ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-2">
                {p.isAi ? <Bot size={10} className="text-[#9b5cff]" /> : null}
                <span className="text-white/70">{p.username}</span>
                {p.isWinner && !isShared && <Crown size={10} className="text-[#ffd700]" />}
                {isShared && <span className="text-[8px] text-[#00c8ff]/60">Shared</span>}
              </div>
              <div className="text-right">
                <span className={`font-bold ${p.isWinner ? 'text-green-400' : 'text-white/40'}`}>
                  ${Number(p.totalValue || 0).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cards pulled */}
      {players.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-white/25 mb-1.5">Cards Pulled</p>
          {players.map((p: any, pi: number) =>
            (p.cards || []).map((c: any, ci: number) => (
              <div key={`${pi}-${ci}`} className="flex justify-between py-1 px-2 rounded text-[9px]" style={{ background: p.isWinner ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)' }}>
                <span className="text-white/60 truncate">{c.name} <span className="text-white/25">({c.rarity})</span></span>
                <span className={`ml-2 shrink-0 ${p.isWinner ? 'text-green-400' : 'text-white/30'}`}>${Number(c.value || 0).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      )}

      <Divider />
      {!isShared && winner.username && <Row label="Winner" value={winner.username} valueColor="text-[#ffd700]" />}
      {!isShared && winner.totalValue != null && <Row label="Winner Value" value={`${Number(winner.totalValue).toFixed(2)}`} valueColor="text-green-400" />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Cashout Details ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function CashoutDetails({ details, valueOut, result }: { details: any; valueOut: number; result: string }) {
  const status = details?.status || result || 'pending';
  const isCanceled = status === 'Canceled' || status === 'canceled';

  return (
    <div className="space-y-3">
      <div className={`p-2.5 rounded-lg text-center text-[11px] font-bold uppercase tracking-wider ${isCanceled ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20' : 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20'}`}>
        {isCanceled ? 'Cash Out Canceled' : 'Cash Out Request'}
      </div>
      {details?.confirmationNumber && (
        <Row label="Confirmation #" value={details.confirmationNumber} valueColor="text-[#ffd700]" />
      )}
      <Row label="Status" value={status} valueColor={isCanceled ? 'text-gray-400' : 'text-[#f59e0b]'} />
      <Row label="Cards Submitted" value={String(details?.totalCards || 0)} />
      <Row label="Total Value" value={`$${Number(details?.totalValue || valueOut || 0).toFixed(2)}`} valueColor="text-green-400" />

      {/* Card list */}
      {details?.cards?.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-white/25 mb-1.5">Cards</p>
          {details.cards.map((c: any, i: number) => (
            <div key={i} className="flex justify-between py-1.5 px-2 rounded-lg text-[10px]" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-white/70 truncate">{c.name} <span className="text-white/30">({c.rarity})</span></span>
              <span className="text-green-400 ml-2 shrink-0 font-bold">${Number(c.value || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Shipping info */}
      {details?.shippingName && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className="text-[9px] uppercase tracking-wider text-white/25 mb-1.5">Shipping Info</p>
          <p className="text-[10px] text-white/60">{details.shippingName}</p>
          <p className="text-[9px] text-white/30">
            {[details.shippingCity, details.shippingState].filter(Boolean).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Existing detail views (unchanged logic, cleaned up) ────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function UpgradeDetails({ details, result, valueIn, valueOut }: { details: any; result: string; valueIn: number; valueOut: number }) {
  return (
    <div className="space-y-3">
      <div className={`p-2.5 rounded-lg text-center text-[11px] font-bold uppercase tracking-wider ${result === 'win' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
        {result === 'win' ? '🎉 Upgrade WIN' : '💔 Upgrade LOSS'}
      </div>
      {details?.winChance != null && <Row label="Success Chance" value={`${details.winChance}%`} valueColor="text-[#00c8ff]" />}
      {details?.cardsUsed?.length > 0 && <CardGroup label="Cards Put In" cards={details.cardsUsed} bg="rgba(255,255,255,0.03)" vc="text-white/40" />}
      {details?.balanceUsed > 0 && <Row label="Balance Used" value={`-$${Number(details.balanceUsed).toFixed(2)}`} valueColor="text-amber-400" />}
      {details?.targetCards?.length > 0 && <CardGroup label="Target Cards" cards={details.targetCards} bg="rgba(155,92,255,0.06)" vc="text-[#9b5cff]" />}
      {details?.prizeReceived?.length > 0 && <CardGroup label="Prize Received" cards={details.prizeReceived} bg="rgba(16,185,129,0.06)" vc="text-green-400" />}
      <Divider />
      <Row label="Total Value In" value={`$${Number(valueIn || 0).toFixed(2)}`} valueColor="text-red-400" />
      <Row label="Total Value Out" value={`$${Number(valueOut || 0).toFixed(2)}`} valueColor="text-green-400" />
    </div>
  );
}

function ExchangeDetails({ details }: { details: any }) {
  return (
    <div className="space-y-3">
      {details?.offeredCards?.length > 0 && (
        <>
          <p className="text-[9px] uppercase tracking-wider text-white/25 mb-1.5">Cards Traded In</p>
          {details.offeredCards.map((c: any, i: number) => (
            <div key={i} className="flex justify-between py-1.5 px-2 rounded-lg text-[10px]" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-white/70 truncate">{c.name} <span className="text-white/30">({c.rarity})</span></span>
              <span className="text-red-400 ml-2 shrink-0">${Number(c.value || 0).toFixed(2)}</span>
            </div>
          ))}
          {details?.offerTotal != null && (
            <div className="flex justify-between text-[9px] px-2">
              <span className="text-white/25">Total Trade-in Value</span>
              <span className="text-red-400 font-bold">${Number(details.offerTotal).toFixed(2)}</span>
            </div>
          )}
        </>
      )}
      {details?.receivedCards?.length > 0 && (
        <>
          <p className="text-[9px] uppercase tracking-wider text-white/25 mb-1.5 mt-3">Cards Received</p>
          {details.receivedCards.map((c: any, i: number) => (
            <div key={i} className="flex justify-between py-1.5 px-2 rounded-lg text-[10px]" style={{ background: 'rgba(16,185,129,0.06)' }}>
              <span className="text-white/70 truncate">{c.name} <span className="text-white/30">({c.rarity})</span></span>
              <span className="text-green-400 ml-2 shrink-0 font-bold">${Number(c.value || 0).toFixed(2)}</span>
            </div>
          ))}
          {details?.receiveTotal != null && (
            <div className="flex justify-between text-[9px] px-2">
              <span className="text-white/25">Total Received Value</span>
              <span className="text-green-400 font-bold">${Number(details.receiveTotal).toFixed(2)}</span>
            </div>
          )}
        </>
      )}
      {details?.refund != null && Number(details.refund) > 0 && (
        <div className="p-2.5 rounded-lg text-center text-[10px] font-bold" style={{ background: 'rgba(0,200,255,0.08)', color: '#00c8ff', border: '1px solid rgba(0,200,255,0.15)' }}>
          Value Refund: +${Number(details.refund).toFixed(2)}
        </div>
      )}
    </div>
  );
}

function DepositDetails({ details, valueIn, result, createdAt }: { details: any; valueIn: number; result: string; createdAt: string }) {
  return (
    <div className="space-y-2.5">
      <Row label="Amount" value={`+$${Number(details?.amount || valueIn || 0).toFixed(2)}`} valueColor="text-green-400" />
      {details?.paymentIntentId && <Row label="Stripe Payment ID" value={details.paymentIntentId} valueColor="text-white/60" />}
      {details?.chargeId && <Row label="Coinbase Charge ID" value={details.chargeId} valueColor="text-white/60" />}
      <Row label="Payment Method" value={details?.paymentMethod || '—'} />
      <Row label="Status" value={details?.status || result || '—'} valueColor="text-green-400" />
      <Row label="Date" value={createdAt ? new Date(createdAt).toLocaleString() : '—'} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Unknown type fallback ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function UnknownDetails({ entry }: { entry: TimelineEntry }) {
  const d = entry.logData;
  return (
    <div className="space-y-2.5">
      <Row label="Type" value={s(d?.type, '—')} />
      <Row label="Result" value={s(d?.result, '—')} />
      <Row label="Value In" value={`${n(d?.valueIn).toFixed(2)}`} valueColor="text-amber-400" />
      <Row label="Value Out" value={`${n(d?.valueOut).toFixed(2)}`} valueColor="text-green-400" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Shared helpers ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function Row({ label, value, valueColor = 'text-white/60' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-white/40">{label}</span>
      <span className={valueColor + ' font-bold truncate max-w-[200px]'}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-white/5" />;
}

function CardGroup({ label, cards, bg, vc }: { label: string; cards: any[]; bg: string; vc: string }) {
  const safe = a(cards);
  if (safe.length === 0) return null;
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-white/25 mb-1.5">{label}</p>
      {safe.map((c: any, i: number) => (
        <div key={i} className="flex justify-between py-1.5 px-2 rounded-lg text-[10px]" style={{ background: bg }}>
          <span className="text-white/70 truncate">{s(c.name)}</span>
          <span className={`${vc} ml-2 shrink-0 font-bold`}>${n(c.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
