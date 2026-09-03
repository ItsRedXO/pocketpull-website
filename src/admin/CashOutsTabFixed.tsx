import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, CheckCircle, ChevronLeft, ChevronRight, Loader2, Package, Printer, RefreshCw, RotateCcw, Search, Truck, X } from 'lucide-react';
import { blink } from '../lib/blink';
import { BACKEND_BASE } from '../lib/backend';
import { CashoutRequest, CashoutCard } from './cashouts/CashoutTypes';
import { fmt, fmtDate, parseCards, statusColor } from './cashouts/CashoutHelpers';
import { generateAllPdf, generateSinglePdf } from './cashouts/PdfUtils';

function authHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const secret = localStorage.getItem('pocketpull_admin_pass');
    if (secret) headers['X-Admin-Secret'] = secret;
  } catch {}
  return headers;
}

async function apiHeaders() {
  const headers = authHeaders();
  try {
    const token = await blink.auth.getValidToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {}
  return headers;
}

function fulfilledIndices(req: CashoutRequest): Set<number> {
  try {
    const value: any = (req as any).fulfilledCardIds;
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
    return new Set(Array.isArray(parsed) ? parsed.map(Number).filter(Number.isInteger) : []);
  } catch { return new Set(); }
}

function normalizeRequest(row: any): CashoutRequest {
  return {
    ...row,
    totalValue: row.totalValue ?? row.total_value ?? 0,
    totalCards: row.totalCards ?? row.total_cards ?? 0,
    cardsJson: row.cardsJson ?? row.cards_json ?? '[]',
    fulfilledCardIds: row.fulfilledCardIds ?? row.fulfilled_card_ids ?? '[]',
    confirmationNumber: row.confirmationNumber ?? row.confirmation_number ?? '',
    shippingName: row.shippingName ?? row.shipping_name ?? '',
    shippingAddress: row.shippingAddress ?? row.shipping_address ?? '',
    shippingCity: row.shippingCity ?? row.shipping_city ?? '',
    shippingState: row.shippingState ?? row.shipping_state ?? '',
    shippingZip: row.shippingZip ?? row.shipping_zip ?? '',
    idImageUrl: row.idImageUrl ?? row.id_image_url ?? '',
    createdAt: row.createdAt ?? row.created_at ?? '',
  } as CashoutRequest;
}

export const CashOutsTabFixed: React.FC<{ showToast?: (msg: string, ok?: boolean) => void }> = ({ showToast }) => {
  const [requests, setRequests] = useState<CashoutRequest[]>([]);
  const [selected, setSelected] = useState<CashoutRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [tracking, setTracking] = useState('');
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await blink.db.cashoutRequests.list({ orderBy: { createdAt: 'desc' }, limit: 500 });
      setRequests(Array.isArray(rows) ? (rows as any[]).map(normalizeRequest) : []);
    } catch (e: any) {
      showToast?.(e?.message || 'Failed to load cashouts', false);
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => requests.filter(r => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || String(r.username).toLowerCase().includes(q) || String(r.confirmationNumber).toLowerCase().includes(q);
    return matchesSearch && (!status || r.status === status);
  }), [requests, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const pendingSummary = useMemo(() => {
    const pending = requests.filter(r => r.status === 'pending');
    const cards: CashoutCard[] = [];
    let value = 0;
    for (const req of pending) {
      const fulfilled = fulfilledIndices(req);
      parseCards(req.cardsJson).forEach((card: any, i: number) => {
        if (!fulfilled.has(i)) cards.push(card as CashoutCard);
      });
      value += Number(req.totalValue) || 0;
    }
    const grouped = new Map<string, { name: string; quantity: number; value: number }>();
    cards.forEach(card => {
      const name = card.card_name || 'Unknown Card';
      const current = grouped.get(name) || { name, quantity: 0, value: 0 };
      current.quantity += 1;
      current.value += Number(card.value) || 0;
      grouped.set(name, current);
    });
    return { cards: Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name)), value };
  }, [requests]);

  const openRequest = (req: CashoutRequest) => {
    setSelected(req);
    setSelectedIndices(fulfilledIndices(req));
    setTracking(req.trackingNumber || '');
  };

  const refreshSelected = async (id: string) => {
    const row = await blink.db.cashoutRequests.get(id) as any;
    if (!row) { setSelected(null); return; }
    const fresh = normalizeRequest(row);
    setSelected(fresh);
    setRequests(prev => prev.map(r => r.id === id ? fresh : r));
    setSelectedIndices(fulfilledIndices(fresh));
  };

  const setStatusForRequest = async (newStatus: string) => {
    if (!selected || busy || newStatus === selected.status) return;
    if (newStatus === 'returned' || newStatus === 'cancelled') {
      await returnCashout();
      return;
    }
    setBusy(true);
    try {
      await blink.db.cashoutRequests.update(selected.id, { status: newStatus, updatedAt: new Date().toISOString(), processedAt: new Date().toISOString() });
      showToast?.(`Cashout marked ${newStatus}.`);
      await refreshSelected(selected.id);
      await load();
    } catch (e: any) { showToast?.(e?.message || 'Status update failed', false); }
    finally { setBusy(false); }
  };

  const fulfill = async () => {
    if (!selected || busy || selectedIndices.size === 0) return;
    setBusy(true);
    try {
      const response = await fetch(`${BACKEND_BASE}/admin/cashout/partial-fulfill`, {
        method: 'POST', headers: await apiHeaders(),
        body: JSON.stringify({ cashoutId: selected.id, fulfilledIndices: [...selectedIndices], trackingNumber: tracking.trim() || undefined }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Fulfillment failed (${response.status})`);
      showToast?.(payload.status === 'shipped' ? 'All cards marked shipped.' : 'Cashout partially fulfilled.');
      await refreshSelected(selected.id);
      await load();
    } catch (e: any) { showToast?.(e?.message || 'Fulfillment failed', false); }
    finally { setBusy(false); }
  };

  async function returnCashout() {
    if (!selected || busy) return;
    if (!window.confirm('Return this pending cashout and restore its cards to the user inventory?')) return;
    setBusy(true);
    try {
      const response = await fetch(`${BACKEND_BASE}/admin/cashout/return`, {
        method: 'POST', headers: await apiHeaders(), body: JSON.stringify({ cashoutId: selected.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Return failed (${response.status})`);
      showToast?.(`Cashout returned. ${payload.restoredCards || 0} cards restored.`);
      setSelected(null);
      await load();
    } catch (e: any) { showToast?.(e?.message || 'Return failed', false); }
    finally { setBusy(false); }
  }

  const deleteRequest = async () => {
    if (!selected || busy || !window.confirm('Delete this cashout record? This should only be used for an administrative cleanup.')) return;
    setBusy(true);
    try {
      await blink.db.cashoutRequests.delete(selected.id);
      showToast?.('Cashout record deleted.');
      setSelected(null);
      await load();
    } catch (e: any) { showToast?.(e?.message || 'Delete failed', false); }
    finally { setBusy(false); }
  };

  if (selected) {
    const cards = parseCards(selected.cardsJson);
    const fulfilled = fulfilledIndices(selected);
    const returnable = selected.status === 'pending';
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div><button onClick={() => setSelected(null)} className="text-[10px] font-bold uppercase tracking-wider text-[#00c8ff]">← Back to cashouts</button><h1 className="font-display text-2xl uppercase text-white mt-1">Cashout #{selected.confirmationNumber}</h1></div>
          <button onClick={() => void refreshSelected(selected.id)} disabled={busy} className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/50"><RefreshCw size={14} className={busy ? 'animate-spin' : ''} /></button>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Stat label="User" value={selected.username} /><Stat label="Value" value={fmt(selected.totalValue)} /><Stat label="Cards" value={String(selected.totalCards)} /><Stat label="Status" value={selected.status} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h2 className="text-xs font-bold uppercase tracking-widest text-white/50">Cards</h2><div className="flex gap-2"><button onClick={() => setSelectedIndices(new Set(cards.map((_, i) => i)))} className="text-[10px] text-[#00c8ff]">Select all</button><button onClick={() => setSelectedIndices(new Set())} className="text-[10px] text-white/30">Clear</button></div></div>
            {cards.map((card: any, i: number) => {
              const isFulfilled = fulfilled.has(i);
              const checked = selectedIndices.has(i);
              return <label key={`${card.inventory_id || i}`} className="flex items-center gap-3 border-b border-white/5 px-4 py-3 cursor-pointer hover:bg-white/[0.03]">
                <input type="checkbox" checked={checked} onChange={() => setSelectedIndices(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; })} disabled={isFulfilled || !['pending','processing','partial'].includes(selected.status)} />
                {card.card_image_url ? <img src={card.card_image_url} alt="" className="h-10 w-8 rounded object-cover bg-black/20" /> : <div className="h-10 w-8 rounded bg-white/5 flex items-center justify-center"><Package size={13} className="text-white/20" /></div>}
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{card.card_name || 'Unknown Card'}</p><p className="text-[10px] text-white/35">{card.rarity || '—'} · {fmt(card.value)}</p></div>
                <span className={`text-[9px] font-bold uppercase ${isFulfilled ? 'text-green-400' : 'text-amber-400'}`}>{isFulfilled ? 'Fulfilled' : 'Pending'}</span>
              </label>;
            })}
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">Shipping</h2>
              <p className="text-xs text-white/70">{selected.shippingName}</p><p className="text-xs text-white/50">{selected.shippingAddress}<br />{selected.shippingCity}, {selected.shippingState} {selected.shippingZip}</p>
              <p className="text-[10px] text-white/30">Submitted {fmtDate(selected.createdAt)}</p>
              {selected.idImageUrl && <a href={selected.idImageUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[#00c8ff]">View ID verification</a>}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white/50">Fulfillment</h2>
              <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking number (optional)" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none" />
              <button onClick={() => void fulfill()} disabled={busy || selectedIndices.size === 0 || !['pending','processing','partial'].includes(selected.status)} className="w-full rounded-lg bg-[#10b981]/15 border border-[#10b981]/25 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#10b981] disabled:opacity-30"><Truck size={13} className="inline mr-1" /> Ship selected ({selectedIndices.size})</button>
              {returnable && <button onClick={() => void returnCashout()} disabled={busy} className="w-full rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 disabled:opacity-30"><RotateCcw size={13} className="inline mr-1" /> Return to inventory</button>}
              <button onClick={() => generateSinglePdf(selected)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white/50"><Printer size={13} className="inline mr-1" /> Print request</button>
              <button onClick={() => void deleteRequest()} disabled={busy} className="w-full rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-red-300 disabled:opacity-30">Delete record</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-[#9b5cff]">Physical card fulfillment</p><h1 className="font-display text-2xl uppercase text-white">Cash Outs</h1><p className="text-[11px] text-white/30">Manage requests, fulfillment, returns and shipping</p></div>
        <div className="flex gap-2"><button onClick={() => generateAllPdf(pendingSummary.cards.map(c => ({ card_name: c.name, quantity: c.quantity, value: c.value })), pendingSummary.value)} disabled={!pendingSummary.cards.length} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50 disabled:opacity-30"><Printer size={12} className="inline mr-1" /> Print pending</button><button onClick={() => void load()} disabled={loading} className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Stat label="Pending" value={String(requests.filter(r => r.status === 'pending').length)} /><Stat label="Processing" value={String(requests.filter(r => r.status === 'processing').length)} /><Stat label="Shipped" value={String(requests.filter(r => r.status === 'shipped').length)} /><Stat label="Total Requests" value={String(requests.length)} /></div>
      <div className="grid gap-2 md:grid-cols-[1fr_180px]"><label className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" /><input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search username or confirmation" className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-xs text-white outline-none" /></label><select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-white/10 bg-[#141622] px-3 text-xs text-white/70 outline-none"><option value="">All statuses</option>{['pending','processing','partial','shipped','completed','cancelled','returned'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        {loading ? <div className="p-12 text-center text-white/30"><Loader2 size={20} className="mx-auto animate-spin mb-2" />Loading cashouts...</div> : visible.length === 0 ? <div className="p-12 text-center text-white/30">No cashout requests match.</div> : visible.map(req => { const colors = statusColor(req.status); return <button key={req.id} onClick={() => openRequest(req)} className="grid w-full gap-2 border-b border-white/5 px-4 py-3 text-left hover:bg-white/[0.04] md:grid-cols-[1.2fr_1fr_100px_100px_120px] md:items-center"><span className="truncate text-xs text-white">{req.username}</span><span className="truncate text-[10px] text-white/45">#{req.confirmationNumber}</span><span className="text-xs font-bold text-[#10b981]">{fmt(req.totalValue)}</span><span className="text-[10px] font-bold uppercase" style={{ color: colors.color }}>{req.status}</span><span className="text-[10px] text-white/30">{fmtDate(req.createdAt)}</span></button>; })}
      </div>
      <div className="flex items-center justify-between"><span className="text-[11px] text-white/30">{filtered.length} requests · Page {page} of {totalPages}</span><div className="flex gap-1"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg border border-white/10 bg-white/5 text-white/40 disabled:opacity-30"><ChevronLeft size={13} /></button><button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg border border-white/10 bg-white/5 text-white/40 disabled:opacity-30"><ChevronRight size={13} /></button></div></div>
    </section>
  );
};

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center"><p className="text-[10px] uppercase tracking-wider text-white/30">{label}</p><p className="mt-1 text-lg font-display font-bold text-white">{value}</p></div>; }
