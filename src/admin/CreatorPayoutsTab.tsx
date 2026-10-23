import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle, DollarSign, Clock } from 'lucide-react';
import { getAdminAuthHeaders } from './adminAuthHeaders';
import { AdminPayoutRequest, fetchAdminCreatorPayouts, updateCreatorPayoutStatus } from '../lib/creatorApi';

interface Props { showToast: (msg: string, ok?: boolean) => void; }

const STATUS_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  pending:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)' },
  approved: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)' },
  paid:     { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
  rejected: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
};

export const CreatorPayoutsTab: React.FC<Props> = ({ showToast }) => {
  const [requests, setRequests] = useState<AdminPayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const h = await getAdminAuthHeaders();
      setRequests(await fetchAdminCreatorPayouts(h));
    } catch (e: any) { showToast(e.message, false); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    setActionId(id);
    try {
      const h = await getAdminAuthHeaders();
      await updateCreatorPayoutStatus(id, status, notesMap[id] || '', h);
      showToast(`Request ${status}`);
      await load();
    } catch (e: any) { showToast(e.message, false); }
    setActionId(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-white/30" />
    </div>
  );

  const pending = requests.filter(r => r.status === 'pending');
  const processed = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white/80 uppercase tracking-wider">Creator Payouts</h2>
        <button onClick={load} className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg text-white/30 hover:text-white border border-white/10 hover:border-white/20 transition-colors">Refresh</button>
      </div>

      {pending.length === 0 && (
        <div className="rounded-xl py-10 text-center text-white/20 text-sm border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          No pending payout requests
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-yellow-400/60">Pending ({pending.length})</p>
          {pending.map(req => <PayoutCard key={req.id} req={req} notesMap={notesMap} setNotesMap={setNotesMap} actionId={actionId} onUpdate={updateStatus} />)}
        </div>
      )}

      {processed.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-white/20">History</p>
          {processed.map(req => <PayoutCard key={req.id} req={req} notesMap={notesMap} setNotesMap={setNotesMap} actionId={actionId} onUpdate={updateStatus} readonly />)}
        </div>
      )}
    </div>
  );
};

function PayoutCard({ req, notesMap, setNotesMap, actionId, onUpdate, readonly }: {
  req: AdminPayoutRequest;
  notesMap: Record<string, string>;
  setNotesMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  actionId: string | null;
  onUpdate: (id: string, status: string) => void;
  readonly?: boolean;
}) {
  const sc = STATUS_COLORS[req.status] || STATUS_COLORS.pending;
  const busy = actionId === req.id;

  return (
    <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">{req.username}</span>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>{req.status}</span>
          </div>
          <p className="text-[10px] text-white/30 mt-0.5">{req.email}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-lg font-bold text-green-400">${Number(req.amount).toFixed(2)}</span>
            <span className="text-[10px] text-white/30">via {req.payment_method}</span>
            <span className="text-[10px] font-mono text-white/50">{req.payment_details}</span>
          </div>
          <p className="text-[9px] text-white/20 mt-1 flex items-center gap-1">
            <Clock size={9} />
            {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          {req.admin_notes && (
            <p className="text-[10px] text-white/40 mt-1.5 italic">Notes: {req.admin_notes}</p>
          )}
        </div>

        {!readonly && req.status === 'pending' && (
          <div className="flex flex-col gap-2 shrink-0">
            <input
              value={notesMap[req.id] || ''}
              onChange={e => setNotesMap(m => ({ ...m, [req.id]: e.target.value }))}
              placeholder="Admin notes (optional)"
              className="text-[10px] px-2 py-1.5 rounded-lg w-36 text-white placeholder-white/20 focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button
              onClick={() => onUpdate(req.id, 'paid')}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider disabled:opacity-40"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <DollarSign size={11} />} Paid
            </button>
            <button
              onClick={() => onUpdate(req.id, 'approved')}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider disabled:opacity-40"
              style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}
            >
              <CheckCircle size={11} /> Approve
            </button>
            <button
              onClick={() => onUpdate(req.id, 'rejected')}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider disabled:opacity-40"
              style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}
            >
              <XCircle size={11} /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
