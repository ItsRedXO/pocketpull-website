import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Printer, User, Hash, DollarSign, Calendar,
  ArrowUpDown, ArrowUp, ArrowDown, Trash2, AlertTriangle, RotateCcw,
  CheckSquare, Square, Truck, Send,
} from 'lucide-react';
import { CashoutRequest, SortKey } from './CashoutTypes';
import {
  fmt, fmtDate, parseCards, extractIdImageUrl,
  statusColor, getRarityColor
} from './CashoutHelpers';
import { generateSinglePdf } from './PdfUtils';
import { blink } from '../../lib/blink';

const BACKEND_BASE = 'https://b2nnhe2n.backend.blink.new';

interface DetailViewProps {
  req: CashoutRequest;
  onBack: () => void;
  onStatusChange: (id: string, newStatus: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReturn: (id: string) => Promise<void>;
  onFulfilled?: (id: string) => Promise<void>;
}

export const DetailView: React.FC<DetailViewProps> = ({ req, onBack, onStatusChange, onDelete, onReturn, onFulfilled }) => {
  const [currentStatus, setCurrentStatus] = useState<CashoutRequest['status']>(req.status);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [showFulfillConfirm, setShowFulfillConfirm] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('value-desc');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const allCards = parseCards(req.cardsJson || '[]');

  // Build sorted index array: each entry maps to allCards[originalIndex]
  // This ensures checkboxes always reference the original-array index,
  // regardless of sort order. The backend processes against the original
  // cardsJson array, so indices must match.
  const sortedIndices = useMemo(() => {
    const indices = allCards.map((_, i) => i);
    indices.sort((a, b) => {
      const ca = allCards[a];
      const cb = allCards[b];
      switch (sortKey) {
        case 'value-desc': return Number(cb.value) - Number(ca.value);
        case 'value-asc': return Number(ca.value) - Number(cb.value);
        case 'name-asc': return ca.card_name.localeCompare(cb.card_name);
        case 'name-desc': return cb.card_name.localeCompare(ca.card_name);
        default: return 0;
      }
    });
    return indices;
  }, [allCards, sortKey]);

  // Parse already-fulfilled card indices from DB (stored as original-array indices)
  const alreadyFulfilledIndices = useMemo(() => {
    try {
      const arr = JSON.parse(req.fulfilledCardIds || '[]');
      return new Set<number>(Array.isArray(arr) ? arr : []);
    } catch { return new Set<number>(); }
  }, [req.fulfilledCardIds]);

  // Initialize selection: pre-select already-fulfilled cards
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => alreadyFulfilledIndices);
  const [trackingNumber, setTrackingNumber] = useState(req.trackingNumber || '');
  const [fulfillError, setFulfillError] = useState('');

  // ── Derived: split cards into fulfilled vs returned for partial/shipped display ──
  const isFulfilledStatus = ['partial', 'shipped'].includes(req.status as string);
  const fulfilledCards = useMemo(() =>
    isFulfilledStatus
      ? allCards.filter((_, i) => alreadyFulfilledIndices.has(i))
      : [],
    [allCards, alreadyFulfilledIndices, isFulfilledStatus]
  );
  const returnedCards = useMemo(() =>
    isFulfilledStatus
      ? allCards.filter((_, i) => !alreadyFulfilledIndices.has(i))
      : [],
    [allCards, alreadyFulfilledIndices, isFulfilledStatus]
  );
  const fulfilledValue = fulfilledCards.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const returnedValue = returnedCards.reduce((s, c) => s + (Number(c.value) || 0), 0);

  // Display value: for fulfilled statuses, show shipped subtotal; otherwise original total
  const displayTotalValue = isFulfilledStatus
    ? fulfilledValue
    : (isNaN(Number(req.totalValue)) ? 0 : Number(req.totalValue));
  const displayTotalCards = isFulfilledStatus
    ? alreadyFulfilledIndices.size
    : (Number(req.totalCards) || allCards.length);

  const selectedCount = selectedIndices.size;
  const isPartial = selectedCount < allCards.length;
  const allSelected = selectedCount === allCards.length && allCards.length > 0;

  const idImageUrl = req.idImageUrl || extractIdImageUrl(req.notes);

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus || saving) return;
    setSaving(true);
    try {
      await onStatusChange(req.id, newStatus);
      setCurrentStatus(newStatus as CashoutRequest['status']);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onDelete(req.id);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onReturn(req.id);
      setCurrentStatus('returned');
      setShowReturnConfirm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const toggleCard = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleSelectAll = () => setSelectedIndices(new Set(allCards.map((_, i) => i)));
  const handleDeselectAll = () => setSelectedIndices(new Set());

  const handleFulfill = async () => {
    if (saving || selectedCount === 0) return;
    setSaving(true);
    setFulfillError('');

    try {
      const adminSecret = localStorage.getItem('pocketpull_admin_pass') || '';
      let token = '';
      try { token = await blink.auth.getValidToken() || ''; } catch { /* no valid Blink auth token */ }

      const res = await fetch(`${BACKEND_BASE}/admin/cashout/partial-fulfill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': adminSecret,
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          cashoutId: req.id,
          fulfilledIndices: [...selectedIndices],
          trackingNumber: trackingNumber.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API error ${res.status}`);

      // Update local state
      setCurrentStatus(isPartial ? 'partial' : 'shipped');
      setShowFulfillConfirm(false);

      // Let parent refresh selectedReq from DB so totalValue/totalCards are current
      if (onFulfilled) await onFulfilled(req.id);

    } catch (err: any) {
      setFulfillError(err.message || 'Fulfillment failed');
    } finally {
      setSaving(false);
    }
  };

  const isFulfillable = !['returned', 'completed', 'cancelled', 'shipped'].includes(currentStatus);
  const isAlreadyFulfilled = ['shipped', 'partial'].includes(currentStatus);

  const selectedValue = allCards
    .filter((_, i) => selectedIndices.has(i))
    .reduce((s, c) => s + (Number(c.value) || 0), 0);

  const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode }[] = [
    { key: 'value-desc', label: 'Price ↓', icon: <ArrowDown size={10} /> },
    { key: 'value-asc', label: 'Price ↑', icon: <ArrowUp size={10} /> },
    { key: 'name-asc', label: 'Name A–Z', icon: <ArrowUpDown size={10} /> },
    { key: 'name-desc', label: 'Name Z–A', icon: <ArrowUpDown size={10} /> },
  ];

  return (
    <div>
      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
            onClick={() => setLightboxUrl(null)}
          >
            <img src={lightboxUrl} alt="Uploaded ID" className="max-w-full max-h-full rounded-xl object-contain" />
            <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl font-bold">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-2xl p-6 overflow-hidden"
              style={{ background: '#0a0a1a', border: '1px solid rgba(248,113,113,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(248,113,113,0.1)' }}>
                  <AlertTriangle size={32} className="text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Delete Cashout Request?</h3>
                <p className="text-white/60 text-sm mb-8">
                  Are you sure you want to delete this cashout request? This action cannot be undone.
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white/40 hover:text-white transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #f87171, #dc2626)', boxShadow: '0 0 20px rgba(248,113,113,0.3)' }}
                  >
                    {saving ? 'Deleting...' : 'Yes, Delete Cashout'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Return Confirmation Modal */}
      <AnimatePresence>
        {showReturnConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-2xl p-6 overflow-hidden"
              style={{ background: '#0a0a1a', border: '1px solid rgba(251,191,36,0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(251,191,36,0.1)' }}>
                  <RotateCcw size={32} className="text-[#fbbf24]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Return Cashout?</h3>
                <p className="text-white/60 text-sm mb-8">
                  Are you sure you want to return this cashout? This will return all selected cards to the player&apos;s inventory.
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setShowReturnConfirm(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white/40 hover:text-white transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReturn}
                    disabled={saving}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)', boxShadow: '0 0 20px rgba(251,191,36,0.3)' }}
                  >
                    {saving ? 'Returning...' : 'Yes, Return Cashout'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fulfillment Confirmation Modal */}
      <AnimatePresence>
        {showFulfillConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-2xl p-6 overflow-hidden"
              style={{ background: '#0a0a1a', border: isPartial ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(139,92,246,0.4)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background: isPartial ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.1)' }}>
                  {isPartial ? <AlertTriangle size={32} className="text-[#f59e0b]" /> : <Truck size={32} className="text-[#8b5cf6]" />}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {isPartial ? 'Partial Fulfillment' : 'Fulfill All Cards'}
                </h3>
                <p className="text-white/60 text-sm mb-4">
                  {isPartial
                    ? `You selected ${selectedCount} of ${allCards.length} cards. Unselected cards will be returned to the user's inventory.`
                    : `All ${allCards.length} cards will be shipped.`}
                </p>
                <div className="flex items-center gap-6 mb-6">
                  <div className="text-center">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Shipping</p>
                    <p className="text-lg font-display font-bold text-[#8b5cf6]">{selectedCount} cards</p>
                    <p className="text-xs font-bold text-[#10b981]">{fmt(selectedValue)}</p>
                  </div>
                  {isPartial && (
                    <div className="text-center">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider">Returning</p>
                      <p className="text-lg font-display font-bold text-[#fbbf24]">{allCards.length - selectedCount} cards</p>
                    </div>
                  )}
                </div>
                {trackingNumber.trim() && (
                  <div className="w-full mb-4 px-3 py-2 rounded-lg text-[11px]"
                    style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <span className="text-white/40">Tracking: </span>
                    <span className="text-white font-bold">{trackingNumber.trim()}</span>
                  </div>
                )}
                <p className="text-[11px] text-white/30 mb-6">An email will be sent to the user with fulfillment details.</p>
                {fulfillError && (
                  <p className="text-[11px] text-red-400 mb-4 px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>{fulfillError}</p>
                )}
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => { setShowFulfillConfirm(false); setFulfillError(''); }}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white/40 hover:text-white transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFulfill}
                    disabled={saving}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{
                      background: isPartial
                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                        : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                      boxShadow: `0 0 20px ${isPartial ? 'rgba(245,158,11,0.3)' : 'rgba(139,92,246,0.3)'}`
                    }}
                  >
                    {saving ? 'Processing...' : <><Send size={14} /> Confirm {isPartial ? 'Partial' : ''} Fulfillment</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
            style={{ color: '#9b5cff', background: 'rgba(155,92,255,0.08)', border: '1px solid rgba(155,92,255,0.2)' }}>
            <ArrowLeft size={13} /> Back
          </button>
          <div>
            <h2 className="text-base font-bold text-white">Cashout #{req.confirmationNumber || '—'}</h2>
            <p className="text-[11px] text-white/40 mt-0.5">{req.username} · {fmtDate(req.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReturnConfirm(true)}
            disabled={currentStatus === 'returned'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <RotateCcw size={13} /> Return Cashout
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
            style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>
            <Trash2 size={13} /> Delete Cashout
          </button>
          <button
            onClick={() => generateSinglePdf(req)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
            style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <Printer size={13} /> Print This Cashout
          </button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: <User size={14} />, label: 'Username', value: req.username || '—' },
          { icon: <Hash size={14} />, label: 'Confirmation #', value: req.confirmationNumber || '—' },
          { icon: <DollarSign size={14} />, label: isFulfilledStatus ? 'Fulfilled Value' : 'Total Value',
            value: fmt(displayTotalValue), accent: '#10b981' },
          { icon: <Calendar size={14} />, label: 'Date Submitted', value: fmtDate(req.createdAt) },
        ].map(item => (
          <div key={item.label} className="rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-1.5 text-white/30 text-[10px] uppercase tracking-wider mb-2">
              {item.icon} {item.label}
            </div>
            <div className="text-sm font-bold" style={{ color: item.accent || '#ffffff' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Status Controls */}
      <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Update Status</div>
        <div className="flex flex-wrap gap-2">
          {(['pending', 'processing', 'shipped', 'partial', 'completed', 'cancelled', 'returned'] as const).map(s => {
            const sc = statusColor(s);
            const isCurrent = currentStatus === s;
            return (
              <button key={s} onClick={() => handleStatusChange(s)} disabled={saving || isCurrent}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all disabled:cursor-not-allowed"
                style={{
                  color: isCurrent ? sc.color : 'rgba(255,255,255,0.4)',
                  background: isCurrent ? sc.bg : 'transparent',
                  border: isCurrent ? `1px solid ${sc.border}` : '1px solid rgba(255,255,255,0.1)',
                  opacity: isCurrent ? 1 : 0.7,
                }}>
                {isCurrent ? '✓ ' : ''}{s}
              </button>
            );
          })}
        </div>
        {saving && <p className="text-[10px] text-white/30 mt-2">Saving...</p>}
      </div>

      {/* Shipping info */}
      <div className="rounded-xl p-4 mb-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Shipping Info</div>
        {req.shippingAddress ? (
          <div className="text-sm text-white/70 space-y-1">
            {req.shippingName && <div className="font-bold text-white">{req.shippingName}</div>}
            <div>{req.shippingAddress}</div>
            <div>{req.shippingCity}, {req.shippingState} {req.shippingZip}</div>
            <div>{req.shippingCountry || 'US'}</div>
          </div>
        ) : (
          <div className="text-sm text-white/30 italic">No shipping information provided.</div>
        )}
        {req.notes && (
          <div className="mt-3 pt-3 border-t border-white/5">
            {req.notes.match(/Email: ([^\s|]+)/) && (
              <div className="text-[11px] text-white/40">Email: <span className="text-white/60">{req.notes.match(/Email: ([^\s|]+)/)?.[1]}</span></div>
            )}
            {req.notes.match(/Phone: ([^\s|]+)/) && (
              <div className="text-[11px] text-white/40 mt-0.5">Phone: <span className="text-white/60">{req.notes.match(/Phone: ([^\s|]+)/)?.[1]}</span></div>
            )}
          </div>
        )}
      </div>

      {/* ID Verification Image */}
      <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">ID Verification Image</div>
        {idImageUrl ? (
          <>
            <button onClick={() => setLightboxUrl(idImageUrl)} className="block relative group">
              <img src={idImageUrl} alt="Uploaded ID" className="max-h-48 rounded-lg object-contain transition-all group-hover:opacity-75"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">
                  Expand Image
                </div>
              </div>
            </button>
            <p className="text-[10px] text-white/30 mt-2 italic flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> Click image to review full size
            </p>
          </>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-lg">
            <User size={24} className="text-white/10 mb-2" />
            <p className="text-[11px] text-white/30 font-medium italic">No ID image uploaded for this request.</p>
          </div>
        )}
      </div>

      {/* Fulfillment: Tracking Number Input */}
      {isFulfillable && (
        <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <div className="text-[10px] text-[#8b5cf6] uppercase tracking-wider mb-3">Tracking Number (Optional)</div>
          <input
            type="text"
            value={trackingNumber}
            onChange={e => setTrackingNumber(e.target.value)}
            placeholder="Enter tracking number..."
            className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>
      )}

      {/* Tracking Number display (post-fulfillment) */}
      {isFulfilledStatus && req.trackingNumber && (
        <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <div className="text-[10px] text-[#8b5cf6] uppercase tracking-wider mb-2">Tracking Number</div>
          <div className="text-sm font-bold text-white">{req.trackingNumber}</div>
        </div>
      )}

      {/* Card list — with checkboxes and fulfillment controls */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Header with sort controls */}
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ background: 'rgba(155,92,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
            Card List{' '}
            {isFulfilledStatus ? (
              <span className="text-white/30 normal-case">
                ({fulfilledCards.length} shipped{returnedCards.length > 0 ? ` + ${returnedCards.length} returned` : ''})
              </span>
            ) : (
              <span className="text-white/30 normal-case">({allCards.length} cards)</span>
            )}
            {isFulfilledStatus && (
              <span className="ml-2 text-[10px] text-[#8b5cf6]">· Fulfilled: {alreadyFulfilledIndices.size} of {allCards.length}</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {!isFulfilledStatus && (
              <div className="flex items-center gap-1">
                {SORT_OPTIONS.map(opt => (
                  <button key={opt.key} onClick={() => setSortKey(opt.key)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all"
                    style={{
                      color: sortKey === opt.key ? '#9b5cff' : 'rgba(255,255,255,0.3)',
                      background: sortKey === opt.key ? 'rgba(155,92,255,0.15)' : 'transparent',
                      border: sortKey === opt.key ? '1px solid rgba(155,92,255,0.3)' : '1px solid transparent',
                    }}>
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            )}
            <span className="text-[11px] font-bold" style={{ color: isFulfilledStatus ? '#10b981' : '#10b981' }}>
              {fmt(isFulfilledStatus ? fulfilledValue : Number(req.totalValue))}
            </span>
          </div>
        </div>

        {/* ── PENDING / PROCESSING: editable checklist table ── */}
        {!isFulfilledStatus && allCards.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/30">
                    {isFulfillable ? (
                      <button onClick={allSelected ? handleDeselectAll : handleSelectAll}
                        className="hover:text-white transition-colors">
                        {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                      </button>
                    ) : (
                      <CheckSquare size={14} className="text-white/10" />
                    )}
                  </th>
                  {['#', 'Card Image', 'Card Name', 'Rarity', 'Value'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedIndices.map((originalIdx, displayIdx) => {
                  const c = allCards[originalIdx];
                  const isChecked = selectedIndices.has(originalIdx);
                  return (
                  <tr key={originalIdx}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: displayIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td className="px-4 py-2.5">
                      {isFulfillable ? (
                        <button onClick={() => toggleCard(originalIdx)} className="hover:scale-110 transition-transform">
                          {isChecked
                            ? <CheckSquare size={14} style={{ color: '#8b5cf6' }} />
                            : <Square size={14} style={{ color: '#4b5563' }} />}
                        </button>
                      ) : (
                        isChecked
                          ? <CheckSquare size={14} className="text-white/10" />
                          : <Square size={14} className="text-white/10" />
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] text-white/25 font-mono">{displayIdx + 1}</span>
                    </td>
                    <td className="px-4 py-2">
                      {c.card_image_url ? (
                        <button onClick={() => setLightboxUrl(c.card_image_url!)}>
                          <img src={c.card_image_url} alt={c.card_name}
                            className="w-10 h-14 object-cover rounded hover:opacity-80 transition-opacity"
                            style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                        </button>
                      ) : (
                        <div className="w-10 h-14 rounded flex items-center justify-center text-xl"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          🃏
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-white/80 font-medium max-w-[200px]">
                      <div className="truncate">{c.card_name}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      {c.rarity && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: `${getRarityColor(c.rarity)}18`, color: getRarityColor(c.rarity) }}>
                          {c.rarity}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-bold" style={{ color: '#10b981' }}>
                      {fmt(c.value)}
                    </td>
                  </tr>
                )})}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <td colSpan={4} className="px-4 py-3 text-[11px] font-bold text-white/40 uppercase tracking-wider">
                    Total ({allCards.length} cards)
                    {selectedCount > 0 && (
                      <span className="ml-2 text-[#8b5cf6]">· {selectedCount} selected · {fmt(selectedValue)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color: '#10b981' }}>
                    {fmt(req.totalValue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ── FULFILLED (partial/shipped): split view ── */}
        {isFulfilledStatus && (
          <div className="overflow-x-auto">
            {/* Shipped section */}
            {fulfilledCards.length > 0 && (
              <>
                <div className="px-5 py-2.5 flex items-center gap-2"
                  style={{ background: 'rgba(16,185,129,0.05)', borderBottom: '1px solid rgba(16,185,129,0.1)' }}>
                  <CheckSquare size={12} style={{ color: '#10b981' }} />
                  <span className="text-[11px] font-bold text-[#10b981] uppercase tracking-wider">
                    Being Shipped ({fulfilledCards.length} card{fulfilledCards.length !== 1 ? 's' : ''})
                  </span>
                  <span className="text-[10px] text-[#10b981]/60 ml-auto">{fmt(fulfilledValue)}</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'rgba(16,185,129,0.03)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {['', '#', 'Card Image', 'Card Name', 'Rarity', 'Value'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-white/25">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fulfilledCards.map((c, i) => (
                      <tr key={i}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: 'transparent' }}>
                        <td className="px-4 py-2.5">
                          <CheckSquare size={14} style={{ color: '#10b981' }} />
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] text-white/20 font-mono">{i + 1}</span>
                        </td>
                        <td className="px-4 py-2">
                          {c.card_image_url ? (
                            <button onClick={() => setLightboxUrl(c.card_image_url!)}>
                              <img src={c.card_image_url} alt={c.card_name}
                                className="w-10 h-14 object-cover rounded hover:opacity-80 transition-opacity"
                                style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                            </button>
                          ) : (
                            <div className="w-10 h-14 rounded flex items-center justify-center text-xl"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>🃏</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-white/80 font-medium max-w-[200px]">
                          <div className="truncate">{c.card_name}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          {c.rarity && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                              style={{ background: `${getRarityColor(c.rarity)}18`, color: getRarityColor(c.rarity) }}>
                              {c.rarity}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm font-bold" style={{ color: '#10b981' }}>{fmt(c.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Returned section */}
            {returnedCards.length > 0 && (
              <>
                <div className="px-5 py-2.5 flex items-center gap-2"
                  style={{ background: 'rgba(251,191,36,0.05)', borderBottom: '1px solid rgba(251,191,36,0.1)' }}>
                  <RotateCcw size={12} style={{ color: '#fbbf24' }} />
                  <span className="text-[11px] font-bold text-[#fbbf24] uppercase tracking-wider">
                    Returned to Inventory ({returnedCards.length} card{returnedCards.length !== 1 ? 's' : ''})
                  </span>
                  <span className="text-[10px] text-[#fbbf24]/60 ml-auto">{fmt(returnedValue)}</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'rgba(251,191,36,0.03)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {['', '#', 'Card Image', 'Card Name', 'Rarity', 'Value'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-white/25">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {returnedCards.map((c, i) => (
                      <tr key={i}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: 'transparent' }}>
                        <td className="px-4 py-2.5">
                          <RotateCcw size={14} style={{ color: '#fbbf24', opacity: 0.7 }} />
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] text-white/20 font-mono">{i + 1}</span>
                        </td>
                        <td className="px-4 py-2">
                          {c.card_image_url ? (
                            <button onClick={() => setLightboxUrl(c.card_image_url!)}>
                              <img src={c.card_image_url} alt={c.card_name}
                                className="w-10 h-14 object-cover rounded hover:opacity-80 transition-opacity"
                                style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
                            </button>
                          ) : (
                            <div className="w-10 h-14 rounded flex items-center justify-center text-xl"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>🃏</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-white/60 font-medium max-w-[200px] line-through">
                          <div className="truncate">{c.card_name}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          {c.rarity && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                              style={{ background: `${getRarityColor(c.rarity)}18`, color: getRarityColor(c.rarity), opacity: 0.6 }}>
                              {c.rarity}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm font-bold" style={{ color: '#fbbf24', opacity: 0.7 }}>{fmt(c.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Grand total footer */}
            <div className="px-5 py-3 flex items-center justify-between"
              style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-[11px] font-bold text-white/30 uppercase tracking-wider">
                {fulfilledCards.length} shipped{returnedCards.length > 0 ? ` + ${returnedCards.length} returned` : ''}
              </span>
              <span className="text-sm font-bold" style={{ color: '#10b981' }}>{fmt(fulfilledValue)}</span>
            </div>
          </div>
        )}

        {/* Show 'no cards' if empty (both pre- and post-fulfillment) */}
        {!isFulfilledStatus && allCards.length === 0 && (
          <div className="py-10 text-center text-white/30 text-sm">No cards in this request.</div>
        )}

        {/* Fulfillment action bar */}
        {isFulfillable && allCards.length > 0 && (
          <div className="px-5 py-4 flex items-center justify-between"
            style={{ background: 'rgba(139,92,246,0.04)', borderTop: '1px solid rgba(139,92,246,0.15)' }}>
            <div className="text-[10px] text-white/40">
              Check the cards you&apos;re shipping. Unchecked cards will be returned to the player&apos;s inventory.
            </div>
            <button
              onClick={() => setShowFulfillConfirm(true)}
              disabled={selectedCount === 0 || saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
              style={{
                background: selectedCount === 0 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                border: selectedCount === 0 ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(139,92,246,0.4)',
                color: selectedCount === 0 ? 'rgba(255,255,255,0.3)' : '#ffffff',
                boxShadow: selectedCount > 0 ? '0 0 20px rgba(139,92,246,0.3)' : 'none',
              }}>
              <Truck size={13} />
              Fulfill {selectedCount > 0 ? `Selected (${selectedCount})` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
