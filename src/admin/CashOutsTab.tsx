import React, { useState, useEffect, useCallback } from 'react';
import {
  ExternalLink, ChevronLeft, ChevronRight,
  Package, RefreshCw, FileText, Eye,
} from 'lucide-react';
import { blink } from '../lib/blink';

const BACKEND_BASE = 'https://b2nnhe2n.backend.blink.new';
async function logAdminAction(action: string, targetUser: string, details: Record<string, any> = {}) {
  try {
    await fetch(`${BACKEND_BASE}/admin/logs/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': 'true' },
      body: JSON.stringify({ adminUsername: 'Admin', action, targetUser, details }),
    });
  } catch { /* non-critical */ }
}
import { CashoutRequest } from './cashouts/CashoutTypes';
import { PAGE_SIZE, statusColor, fmt, fmtDate } from './cashouts/CashoutHelpers';
import { DetailView } from './cashouts/DetailView';
import { ViewAllPage } from './cashouts/ViewAllPage';

interface Props { showToast: (msg: string, ok?: boolean) => void; }

export const CashOutsTab: React.FC<Props> = ({ showToast }) => {
  const [view, setView] = useState<'list' | 'detail' | 'all'>('list');
  const [selectedReq, setSelectedReq] = useState<CashoutRequest | null>(null);

  const [requests, setRequests] = useState<CashoutRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const offset = (p - 1) * PAGE_SIZE;
      const [rows, countResult] = await Promise.all([
        blink.db.cashoutRequests.list({
          limit: PAGE_SIZE,
          offset,
          orderBy: { createdAt: 'desc' },
        }) as Promise<CashoutRequest[]>,
        blink.db.cashoutRequests.count({}),
      ]);
      setRequests(Array.isArray(rows) ? rows : []);
      setTotal(countResult);
    } catch (e) {
      console.error(e);
      showToast('Failed to load cashout requests', false);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(page); }, [load, page]);

  // Polling for live data
  useEffect(() => {
    const timer = setInterval(() => {
      load(page);
    }, 3000);
    return () => clearInterval(timer);
  }, [load, page]);

  const goPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const req = requests.find(r => r.id === id) || selectedReq;

    // If admin cancels, also return cards to inventory (same as explicit return flow)
    if (newStatus === 'cancelled') {
      try {
        // Only return cards if not already returned/completed/shipped/partial
        const notYetFulfilled = !req || !['returned', 'completed', 'shipped', 'partial'].includes(req.status || '');
        if (notYetFulfilled) {
          await handleReturn(id);
          showToast('Cashout cancelled and cards returned to player inventory');
        } else {
          await blink.db.cashoutRequests.update(id, {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            processedAt: new Date().toISOString(),
          });
          showToast(`Status updated to ${newStatus}`);
        }
        return;
      } catch (e: any) {
        showToast(`Failed to cancel: ${e?.message || 'Unknown error'}`, false);
        return;
      }
    }

    await blink.db.cashoutRequests.update(id, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
      ...(newStatus === 'completed' || newStatus === 'returned' || newStatus === 'shipped' ? { processedAt: new Date().toISOString() } : {}),
    });
    showToast(`Status updated to ${newStatus}`);
    logAdminAction(`Admin Updated Cashout Status → ${newStatus}`, req?.username || 'Unknown', {
      cashoutId: id, confirmationNumber: req?.confirmationNumber, totalValue: req?.totalValue, newStatus,
    });
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus as CashoutRequest['status'] } : r));
    setSelectedReq(prev => prev?.id === id ? { ...prev, status: newStatus as CashoutRequest['status'] } : prev);
  };

  const handleReturn = async (id: string) => {
    try {
      // 1. Load the latest cashout request from DB
      const req = await blink.db.cashoutRequests.get(id);
      
      if (!req) {
        showToast('Cashout request not found', false);
        return;
      }
      
      if (req.status === 'returned') {
        showToast('Cashout already returned.', false);
        return;
      }

      if (!req.userId) {
        showToast('User ID is missing from this request.', false);
        return;
      }

      // 2. Parse cards first to ensure we have data
      let cards = [];
      try {
        if (typeof req.cardsJson === 'string') {
          cards = JSON.parse(req.cardsJson);
        } else if (Array.isArray(req.cardsJson)) {
          cards = req.cardsJson;
        }
      } catch (parseErr) {
        console.error('Error parsing cardsJson:', parseErr);
      }

      if (!cards || cards.length === 0) {
        showToast('No selected cards found in this request.', false);
        return;
      }

      // 3. Update request status to Returned
      await blink.db.cashoutRequests.update(id, {
        status: 'returned',
        updatedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      });

      // 4. Return cards to player inventory
      const inventoryItems = cards.map(c => ({
        id: crypto.randomUUID(),
        userId: req.userId,
        cardId: c.card_name ? c.card_name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'unknown-card',
        cardName: c.card_name || 'Unknown Card',
        rarity: c.rarity || 'common',
        value: Number(c.value) || 0,
        cardImageUrl: c.card_image_url || null,
        emoji: '🃏',
        isFavorite: 0,
        isLocked: 0,
        createdAt: new Date().toISOString(),
      }));

      // Create inventory records
      await blink.db.inventory.createMany(inventoryItems);

      showToast('Cashout returned and cards restored to player inventory');
      
      // Update local state
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'returned' } : r));
      setSelectedReq(prev => prev?.id === id ? { ...prev, status: 'returned' } : prev);
    } catch (e: any) {
      console.error('Return Cashout Critical Error:', e);
      const msg = e?.message || 'Unknown error';
      showToast(`Failed to return cashout: ${msg}`, false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await blink.db.cashoutRequests.delete(id);
      showToast('Cashout request deleted successfully');
      setRequests(prev => prev.filter(r => r.id !== id));
      setTotal(prev => prev - 1);
      setView('list');
      setSelectedReq(null);
    } catch (e) {
      console.error(e);
      showToast('Failed to delete cashout request', false);
      throw e;
    }
  };

  // Render sub-views
  if (view === 'all') return <ViewAllPage onBack={() => setView('list')} />;

  if (view === 'detail' && selectedReq) return (
    <DetailView
      req={selectedReq}
      onBack={() => { setView('list'); setSelectedReq(null); }}
      onStatusChange={handleStatusChange}
      onDelete={handleDelete}
      onReturn={handleReturn}
      onFulfilled={async (id) => {
        // Refresh selectedReq from DB so totalValue/totalCards/trackingNumber are current
        try {
          const fresh = await blink.db.cashoutRequests.get(id);
          if (fresh) setSelectedReq(fresh as CashoutRequest);
        } catch { /* non-critical */ }
        // Also refresh list in background
        load(page);
      }}
    />
  );

  /* ── List View ── */
  const pageNums: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pageNums.push(i);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileText size={16} className="text-[#9b5cff] shrink-0" /> Cash Out Requests
          </h2>
          <p className="text-[11px] text-white/40 mt-0.5">{total} total request{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => load(page)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all"
            style={{ color: '#00c8ff', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)' }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => setView('all')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all"
            style={{ color: '#9b5cff', background: 'rgba(155,92,255,0.1)', border: '1px solid rgba(155,92,255,0.25)' }}>
            <ExternalLink size={12} /> View All
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-x-auto overflow-y-hidden mb-4" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Column headers */}
        <div className="grid grid-cols-[1.5fr_1.3fr_1fr_1fr_1fr_1.3fr_80px] px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {['Username', 'Confirmation #', 'Total Value', 'Total Cards', 'Status', 'Request Date', 'Actions'].map(h => (
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-white/30">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <RefreshCw size={22} className="text-white/20 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="py-20 text-center">
            <Package size={40} className="text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-sm">No cashout requests yet.</p>
          </div>
        ) : (
          <div>
            {requests.map((req, i) => {
              const sc = statusColor(req.status);
              return (
                <div key={req.id}
                  className="grid grid-cols-[1.5fr_1.3fr_1fr_1fr_1fr_1.3fr_80px] px-4 py-3 items-center transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: i < requests.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                      style={{ background: 'rgba(155,92,255,0.15)', color: '#9b5cff' }}>
                      {(req.username?.[0] || '?').toUpperCase()}
                    </div>
                    <span className="text-sm text-white/80 font-medium truncate">{req.username}</span>
                  </div>
                  <div className="text-[11px] font-mono text-white/50">{req.confirmationNumber || '—'}</div>
                  <div className="text-sm font-bold" style={{ color: '#10b981' }}>
                    {isNaN(Number(req.totalValue)) ? '—' : fmt(req.totalValue)}
                  </div>
                  <div className="text-sm text-white/60">
                    {req.status === 'partial' && req.fulfilledCardIds ? (() => {
                      try {
                        const f = JSON.parse(req.fulfilledCardIds);
                        const fulfilled = Array.isArray(f) ? f.length : 0;
                        try { const original = JSON.parse(req.cardsJson || '[]');
                          return `${fulfilled}/${Array.isArray(original) ? original.length : '?'}`;
                        } catch { return `${fulfilled}/?`; }
                      } catch { return req.totalCards ?? '—'; }
                    })() : (req.totalCards ?? '—')}
                  </div>
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>
                      {req.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/40">{fmtDate(req.createdAt)}</div>
                  <div>
                    <button
                      onClick={() => { setSelectedReq(req); setView('detail'); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                      style={{ color: '#00c8ff', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)' }}>
                      <Eye size={11} /> View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-white/30">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goPage(page - 1)}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ color: '#9b5cff', background: 'rgba(155,92,255,0.08)', border: '1px solid rgba(155,92,255,0.2)' }}>
              <ChevronLeft size={12} /> Prev
            </button>
            {pageNums.map(n => (
              <button key={n} onClick={() => goPage(n)}
                className="w-8 h-8 rounded-lg text-[11px] font-bold transition-all"
                style={{
                  color: n === page ? '#fff' : 'rgba(255,255,255,0.3)',
                  background: n === page ? 'rgba(155,92,255,0.25)' : 'transparent',
                  border: n === page ? '1px solid rgba(155,92,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
                }}>
                {n}
              </button>
            ))}
            <button
              onClick={() => goPage(page + 1)}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ color: '#9b5cff', background: 'rgba(155,92,255,0.08)', border: '1px solid rgba(155,92,255,0.2)' }}>
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};