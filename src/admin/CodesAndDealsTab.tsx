import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ticket, Percent, Users, Save, Plus, RefreshCw, Shuffle, Pencil, X, Ban, CheckCircle2, Loader2, User } from 'lucide-react';
import {
  fetchPromoCodes, createPromoCode, updatePromoCode, fetchDealSettings, patchDealSettings, fetchPromoCodeRedemptions,
  type PromoCode, type DealSettings,
} from './codesAdminApi';

interface Props { showToast: (msg: string, ok?: boolean) => void; }

const inputClass = 'px-3 py-2 rounded-lg text-[13px] text-white bg-white/5 border border-white/10 focus:outline-none focus:border-[#9b5cff]/50 placeholder-white/25 w-full';

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const emptyForm = { code: '', description: '', rewardAmount: '5', maxUses: '', expiresAt: '' };

function DealsSection({ showToast }: Props) {
  const { data, isLoading, refetch } = useQuery({ queryKey: ['admin-deal-settings'], queryFn: fetchDealSettings, staleTime: 0 });
  const [draft, setDraft] = useState<DealSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data && !draft) setDraft(data); }, [data, draft]);

  const isDirty = draft && data && (
    draft.depositMatchPercent !== data.depositMatchPercent ||
    draft.depositMatchCap !== data.depositMatchCap ||
    draft.referralRewardAmount !== data.referralRewardAmount
  );

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const result = await patchDealSettings(draft);
      setDraft(result.settings);
      showToast('Deal settings saved', true);
      void refetch();
    } catch (e: any) {
      showToast(e?.message || 'Failed to save deal settings', false);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !draft) return <div className="text-white/30 text-xs py-8 text-center">Loading deal settings...</div>;

  return (
    <div className="rounded-2xl p-4 sm:p-5 border border-white/10 bg-white/[0.02] space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/40 mb-1.5"><Percent size={12} /> First Deposit Match %</label>
          <input type="number" min={0} max={1000} value={draft.depositMatchPercent}
            onChange={e => setDraft({ ...draft, depositMatchPercent: Number(e.target.value) })} className={inputClass} />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Match Cap ($)</label>
          <input type="number" min={0} value={draft.depositMatchCap}
            onChange={e => setDraft({ ...draft, depositMatchCap: Number(e.target.value) })} className={inputClass} />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/40 mb-1.5"><Users size={12} /> Referral Reward ($)</label>
          <input type="number" min={0} value={draft.referralRewardAmount}
            onChange={e => setDraft({ ...draft, referralRewardAmount: Number(e.target.value) })} className={inputClass} />
        </div>
      </div>
      <p className="text-[10px] text-white/25">Referral reward applies to both the referrer and the new signup, same as today.</p>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!isDirty || saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-display text-[11px] uppercase tracking-wider disabled:opacity-30"
          style={{ background: '#9b5cff', color: '#fff' }}>
          <Save size={13} /> {saving ? 'Saving...' : 'Save Deal Settings'}
        </button>
        {isDirty && <button onClick={() => data && setDraft(data)} className="px-4 py-2.5 rounded-xl text-[11px] uppercase tracking-wider text-white/40 hover:text-white/70">Discard</button>}
      </div>
    </div>
  );
}

function CodeDetailModal({ code, onClose }: { code: PromoCode; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['admin-promo-code-redemptions', code.id], queryFn: () => fetchPromoCodeRedemptions(code.id) });
  const redemptions = data?.redemptions || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d0e14] overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h3 className="font-mono font-black text-lg text-[#00c8ff]">{code.code}</h3>
            <p className="text-[11px] text-white/40">{code.description || 'No description'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 border-b border-white/5">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/30">Reward</p>
            <p className="text-sm font-bold text-white">${code.rewardAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/30">Uses</p>
            <p className="text-sm font-bold text-white">{code.useCount}{code.maxUses !== null ? ` / ${code.maxUses}` : ' / ∞'}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/30">Status</p>
            <p className={`text-sm font-bold ${code.isActive ? 'text-green-400' : 'text-white/40'}`}>{code.isActive ? 'Active' : 'Inactive'}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/30">Expires</p>
            <p className="text-sm font-bold text-white">{code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : 'Never'}</p>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <p className="text-[9px] uppercase tracking-widest text-white/30">Created</p>
            <p className="text-sm font-bold text-white">{new Date(code.createdAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-3 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/40 font-bold sticky top-0 bg-[#0d0e14]">
            <User size={12} /> Redeemed By ({redemptions.length})
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-white/30" /></div>
          ) : redemptions.length === 0 ? (
            <div className="text-white/30 text-xs text-center py-8">No one has redeemed this code yet.</div>
          ) : (
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-white/30">
                  <th className="px-5 py-2">User</th>
                  <th className="px-5 py-2">Amount</th>
                  <th className="px-5 py-2">Redeemed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {redemptions.map(r => (
                  <tr key={r.userId}>
                    <td className="px-5 py-2.5">
                      <div className="text-white font-medium">{r.username || 'Trainer'}</div>
                      <div className="text-white/30 text-[10px]">{r.email || r.userId}</div>
                    </td>
                    <td className="px-5 py-2.5 text-green-400 font-bold">${r.amount.toFixed(2)}</td>
                    <td className="px-5 py-2.5 text-white/50">{new Date(r.redeemedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export const CodesAndDealsTab: React.FC<Props> = ({ showToast }) => {
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useQuery({ queryKey: ['admin-promo-codes'], queryFn: fetchPromoCodes, staleTime: 0 });
  const codes = data?.codes || [];

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewingCode, setViewingCode] = useState<PromoCode | null>(null);

  const startEdit = (c: PromoCode) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      description: c.description || '',
      rewardAmount: String(c.rewardAmount),
      maxUses: c.maxUses === null ? '' : String(c.maxUses),
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
    });
  };
  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rewardAmount = Number(form.rewardAmount);
    if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) { showToast('Reward amount must be a positive number', false); return; }
    const maxUses = form.maxUses.trim() === '' ? null : Number(form.maxUses);
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) { showToast('Max uses must be a positive whole number, or left blank for unlimited', false); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        await updatePromoCode(editingId, { description: form.description || null, rewardAmount, maxUses, expiresAt: form.expiresAt || null });
        showToast('Code updated', true);
      } else {
        if (!form.code.trim()) { showToast('Enter a code', false); setSubmitting(false); return; }
        await createPromoCode({ code: form.code, description: form.description || null, rewardAmount, maxUses, expiresAt: form.expiresAt || null });
        showToast('Code created', true);
      }
      cancelEdit();
      void refetch();
    } catch (e: any) {
      showToast(e?.message || 'Failed to save code', false);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (c: PromoCode) => {
    try {
      await updatePromoCode(c.id, { isActive: !c.isActive });
      showToast(c.isActive ? 'Code deactivated' : 'Code activated', true);
      qc.invalidateQueries({ queryKey: ['admin-promo-codes'] });
    } catch (e: any) {
      showToast(e?.message || 'Failed to update code', false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-xl uppercase tracking-wider text-white">Codes & Deals</h2>
        <p className="text-[11px] text-white/30 mt-0.5">Promo codes for socials, plus the standing first-deposit match and referral bonus</p>
      </div>

      <DealsSection showToast={showToast} />

      <div className="rounded-2xl p-4 sm:p-5 border border-white/10 bg-white/[0.02] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-white"><Ticket size={14} className="text-[#00c8ff]" /> {editingId ? 'Edit Code' : 'New Promo Code'}</h3>
          {editingId && <button onClick={cancelEdit} className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/40 hover:text-white/70"><X size={12} /> Cancel</button>}
        </div>
        <form onSubmit={submit} className="grid sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-1">
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Code</label>
            <div className="flex gap-1">
              <input value={form.code} disabled={!!editingId} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="6DIGIT" className={inputClass + ' font-mono disabled:opacity-50'} />
              {!editingId && (
                <button type="button" onClick={() => setForm({ ...form, code: randomCode() })}
                  className="shrink-0 px-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white" title="Generate random code">
                  <Shuffle size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="sm:col-span-1">
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Description</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Instagram drop 9/16" className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Reward ($)</label>
            <input type="number" min={0.01} step="0.01" value={form.rewardAmount} onChange={e => setForm({ ...form, rewardAmount: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Max Uses</label>
            <input type="number" min={1} value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} placeholder="Unlimited" className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Expires</label>
            <input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} className={inputClass} />
          </div>
          <div className="sm:col-span-5">
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-display text-[11px] uppercase tracking-wider disabled:opacity-30"
              style={{ background: 'linear-gradient(90deg,#9b5cff,#00c8ff)', color: '#000' }}>
              <Plus size={13} /> {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Create Code'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/5">
          <h3 className="text-sm font-bold text-white">All Codes ({codes.length})</h3>
          <button onClick={() => refetch()} disabled={isFetching} className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 disabled:opacity-30">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
        {isLoading ? (
          <div className="text-white/30 text-xs py-10 text-center">Loading codes...</div>
        ) : codes.length === 0 ? (
          <div className="text-white/30 text-xs py-10 text-center">No promo codes yet — create one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="bg-white/5 text-[10px] uppercase tracking-wider text-white/40">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Reward</th>
                  <th className="px-4 py-3">Uses</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {codes.map(c => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <button onClick={() => setViewingCode(c)} className="font-mono font-bold text-[#00c8ff] hover:underline">{c.code}</button>
                    </td>
                    <td className="px-4 py-3 text-white/60">{c.description || '—'}</td>
                    <td className="px-4 py-3 text-white font-bold">${c.rewardAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-white/60">{c.useCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ' / ∞'}</td>
                    <td className="px-4 py-3 text-white/60">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(c)}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${c.isActive ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-white/5 text-white/30 border-white/10'}`}>
                        {c.isActive ? <CheckCircle2 size={11} /> : <Ban size={11} />} {c.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><Pencil size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingCode && <CodeDetailModal code={viewingCode} onClose={() => setViewingCode(null)} />}
    </section>
  );
};
