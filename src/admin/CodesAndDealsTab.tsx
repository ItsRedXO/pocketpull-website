import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ticket, Percent, Users, Save, Plus, RefreshCw, Shuffle, Pencil, X, Ban, CheckCircle2, Loader2, User, Trash2, DollarSign, Package, Clock } from 'lucide-react';
import {
  fetchPromoCodes, fetchSocialPacks, createPromoCode, updatePromoCode, deletePromoCode, fetchDealSettings, patchDealSettings, fetchPromoCodeRedemptions,
  type PromoCode, type DealSettings, type SocialPack,
} from './codesAdminApi';

interface Props { showToast: (msg: string, ok?: boolean) => void; }

const inputClass = 'px-3 py-2 rounded-lg text-[13px] text-white bg-white/5 border border-white/10 focus:outline-none focus:border-[#9b5cff]/50 placeholder-white/25 w-full';

function formatExpiryDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

function formatExpiryFull(iso: string): string {
  const d = new Date(iso);
  const date = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  if (h === 23 && m === 59) return date;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${date} ${hh}:${String(m).padStart(2, '0')} ${ampm} UTC`;
}

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const emptyForm = {
  code: '', description: '',
  rewardType: 'cash' as 'cash' | 'social_pack',
  rewardAmount: '5', rewardPackId: '',
  maxUses: '', expiresAt: '', expiresTime: '',
};

// ── Deal Settings ──────────────────────────────────────────────────────────────
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
    } finally { setSaving(false); }
  };

  if (isLoading || !draft) return <div className="text-white/30 text-xs py-8 text-center">Loading deal settings...</div>;

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(13,14,20,0.9)' }}>
      <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(155,92,255,0.15)' }}>
          <Percent size={13} className="text-[#9b5cff]" />
        </div>
        <h3 className="font-display text-sm uppercase tracking-wider text-white">Standing Deals</h3>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5 flex items-center gap-1"><Percent size={10} /> First Deposit Match %</label>
            <input type="number" min={0} max={1000} value={draft.depositMatchPercent}
              onChange={e => setDraft({ ...draft, depositMatchPercent: Number(e.target.value) })} className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Match Cap ($)</label>
            <input type="number" min={0} value={draft.depositMatchCap}
              onChange={e => setDraft({ ...draft, depositMatchCap: Number(e.target.value) })} className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5 flex items-center gap-1"><Users size={10} /> Referral Reward ($)</label>
            <input type="number" min={0} value={draft.referralRewardAmount}
              onChange={e => setDraft({ ...draft, referralRewardAmount: Number(e.target.value) })} className={inputClass} />
          </div>
        </div>
        <p className="text-[10px] text-white/25">Referral reward applies to both the referrer and the new signup.</p>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={!isDirty || saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-display text-[11px] uppercase tracking-wider disabled:opacity-30 transition-all"
            style={{ background: 'rgba(155,92,255,0.9)', color: '#fff' }}>
            <Save size={13} /> {saving ? 'Saving...' : 'Save Deal Settings'}
          </button>
          {isDirty && <button onClick={() => data && setDraft(data)} className="px-4 py-2.5 rounded-xl text-[11px] uppercase tracking-wider text-white/40 hover:text-white/70">Discard</button>}
        </div>
      </div>
    </div>
  );
}

// ── Code Detail Modal ─────────────────────────────────────────────────────────
function CodeDetailModal({ code, onClose, showToast }: { code: PromoCode; onClose: () => void; showToast: (msg: string, ok?: boolean) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-promo-code-redemptions', code.id], queryFn: () => fetchPromoCodeRedemptions(code.id) });
  const redemptions = data?.redemptions || [];
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePromoCode(code.id);
      showToast('Code deleted', true);
      qc.invalidateQueries({ queryKey: ['admin-promo-codes'] });
      onClose();
    } catch (e: any) {
      showToast(e?.message || 'Failed to delete code', false);
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const isSocial = code.rewardType === 'social_pack';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d0e14] overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h3 className="font-mono font-black text-lg text-[#00c8ff]">{code.code}</h3>
            <p className="text-[11px] text-white/40">{code.description || 'No description'}</p>
          </div>
          <div className="flex items-center gap-1">
            {confirmingDelete ? (
              <>
                <span className="text-[10px] text-white/40 mr-1">Delete this code?</span>
                <button onClick={handleDelete} disabled={deleting} className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-40">
                  {deleting ? 'Deleting...' : 'Confirm'}
                </button>
                <button onClick={() => setConfirmingDelete(false)} disabled={deleting} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5"><X size={14} /></button>
              </>
            ) : (
              <button onClick={() => setConfirmingDelete(true)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={16} /></button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5"><X size={16} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 border-b border-white/5">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/30">Reward</p>
            {isSocial ? (
              <div>
                <p className="text-[10px] font-bold text-[#9b5cff] flex items-center gap-1"><Package size={10} /> Social Pack</p>
                <p className="text-[10px] text-white/60">{code.rewardPackName || '—'}</p>
              </div>
            ) : (
              <p className="text-sm font-bold text-white">${code.rewardAmount.toFixed(2)}</p>
            )}
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/30">Total Uses</p>
            <p className="text-sm font-bold text-white">{code.useCount}{code.maxUses !== null ? ` / ${code.maxUses}` : ' / ∞'}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/30">Status</p>
            <p className={`text-sm font-bold ${code.isActive ? 'text-green-400' : 'text-white/40'}`}>{code.isActive ? 'Active' : 'Inactive'}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/30">Expires</p>
            <p className="text-sm font-bold text-white">{code.expiresAt ? formatExpiryFull(code.expiresAt) : 'Never'}</p>
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
            <div className="text-white/30 text-xs text-center py-8">No redemptions yet.</div>
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

// ── Main ──────────────────────────────────────────────────────────────────────
export const CodesAndDealsTab: React.FC<Props> = ({ showToast }) => {
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useQuery({ queryKey: ['admin-promo-codes'], queryFn: fetchPromoCodes, staleTime: 0 });
  const { data: socialPacksData } = useQuery({ queryKey: ['admin-social-packs'], queryFn: fetchSocialPacks, staleTime: 60000 });
  const codes = data?.codes || [];
  const socialPacks: SocialPack[] = socialPacksData?.packs || [];

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewingCode, setViewingCode] = useState<PromoCode | null>(null);

  const startEdit = (c: PromoCode) => {
    setEditingId(c.id);
    const expiresDate = c.expiresAt ? c.expiresAt.slice(0, 10) : '';
    const expiresTime = c.expiresAt ? (() => {
      const d = new Date(c.expiresAt);
      const h = d.getUTCHours(), m = d.getUTCMinutes();
      return (h === 23 && m === 59) ? '' : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    })() : '';
    setForm({
      code: c.code,
      description: c.description || '',
      rewardType: c.rewardType || 'cash',
      rewardAmount: String(c.rewardAmount),
      rewardPackId: c.rewardPackId || '',
      maxUses: c.maxUses === null ? '' : String(c.maxUses),
      expiresAt: expiresDate,
      expiresTime,
    });
  };
  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); };

  const buildExpiresAt = (): string | null => {
    if (!form.expiresAt) return null;
    const time = form.expiresTime || '23:59';
    return `${form.expiresAt}T${time}:00Z`;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.rewardType === 'social_pack' && !form.rewardPackId) { showToast('Select a social pack', false); return; }
    const rewardAmount = form.rewardType === 'social_pack' ? 0 : Number(form.rewardAmount);
    if (form.rewardType === 'cash' && (!Number.isFinite(rewardAmount) || rewardAmount <= 0)) { showToast('Reward amount must be a positive number', false); return; }
    const maxUses = form.maxUses.trim() === '' ? null : Number(form.maxUses);
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) { showToast('Max uses must be a positive whole number, or left blank for unlimited', false); return; }
    setSubmitting(true);
    try {
      const expiresAt = buildExpiresAt();
      if (editingId) {
        await updatePromoCode(editingId, { description: form.description || null, rewardType: form.rewardType, rewardAmount, rewardPackId: form.rewardPackId || null, maxUses, expiresAt });
        showToast('Code updated', true);
      } else {
        if (!form.code.trim()) { showToast('Enter a code', false); setSubmitting(false); return; }
        await createPromoCode({ code: form.code, description: form.description || null, rewardType: form.rewardType, rewardAmount, rewardPackId: form.rewardPackId || null, maxUses, expiresAt });
        showToast('Code created', true);
      }
      cancelEdit();
      void refetch();
    } catch (e: any) {
      showToast(e?.message || 'Failed to save code', false);
    } finally { setSubmitting(false); }
  };

  const toggleActive = async (c: PromoCode) => {
    try {
      await updatePromoCode(c.id, { isActive: !c.isActive });
      showToast(c.isActive ? 'Code deactivated' : 'Code activated', true);
      qc.invalidateQueries({ queryKey: ['admin-promo-codes'] });
    } catch (e: any) { showToast(e?.message || 'Failed to update code', false); }
  };

  const isSocialForm = form.rewardType === 'social_pack';

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-xl uppercase tracking-wider text-white">Codes & Deals</h2>
        <p className="text-[11px] text-white/30 mt-0.5">Promo codes for socials, plus the standing first-deposit match and referral bonus</p>
      </div>

      <DealsSection showToast={showToast} />

      {/* ── Code Form ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(13,14,20,0.9)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,200,255,0.12)' }}>
              <Ticket size={13} className="text-[#00c8ff]" />
            </div>
            <h3 className="font-display text-sm uppercase tracking-wider text-white">{editingId ? 'Edit Code' : 'New Promo Code'}</h3>
          </div>
          {editingId && (
            <button onClick={cancelEdit} className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/40 hover:text-white/70 transition-colors">
              <X size={12} /> Cancel
            </button>
          )}
        </div>

        <form onSubmit={submit} className="p-5 space-y-5">
          {/* Row 1: Code + Description */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Code</label>
              <div className="flex gap-1.5">
                <input value={form.code} disabled={!!editingId}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="K55ZLX" className={inputClass + ' font-mono disabled:opacity-50'} />
                {!editingId && (
                  <button type="button" onClick={() => setForm({ ...form, code: randomCode() })}
                    className="shrink-0 px-2.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all" title="Generate random code">
                    <Shuffle size={14} />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Description</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="IG Drop 9/24" className={inputClass} />
            </div>
          </div>

          {/* Row 2: Reward Type Toggle */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Reward Type</label>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => setForm({ ...form, rewardType: 'cash' })}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold uppercase tracking-wider border transition-all"
                style={form.rewardType === 'cash'
                  ? { background: 'rgba(0,200,255,0.15)', border: '1.5px solid rgba(0,200,255,0.5)', color: '#00c8ff' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
                <DollarSign size={13} /> Cash Value
              </button>
              <button type="button"
                onClick={() => setForm({ ...form, rewardType: 'social_pack' })}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold uppercase tracking-wider border transition-all"
                style={form.rewardType === 'social_pack'
                  ? { background: 'rgba(155,92,255,0.15)', border: '1.5px solid rgba(155,92,255,0.5)', color: '#9b5cff' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
                <Package size={13} /> Social Pack
              </button>
            </div>
          </div>

          {/* Row 3: Cash amount OR pack picker */}
          {isSocialForm ? (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Select Pack</label>
              {socialPacks.length === 0 ? (
                <p className="text-[11px] text-white/30 py-2">No social packs found — create one in the Packs tab first.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {socialPacks.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => setForm({ ...form, rewardPackId: p.id })}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all"
                      style={form.rewardPackId === p.id
                        ? { background: 'rgba(155,92,255,0.12)', border: '1.5px solid rgba(155,92,255,0.5)' }
                        : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {p.imageUrl ? (
                        <div className="w-8 h-10 shrink-0 flex items-center justify-center rounded-lg overflow-hidden bg-black/40">
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" style={{ mixBlendMode: 'screen' }} />
                        </div>
                      ) : (
                        <div className="w-8 h-10 shrink-0 flex items-center justify-center rounded-lg bg-white/5 border border-white/10">
                          <Package size={14} className="text-white/30" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-[#9b5cff]">Social Pack</p>
                      </div>
                      {form.rewardPackId === p.id && (
                        <CheckCircle2 size={14} className="text-[#9b5cff] ml-auto shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="sm:w-48">
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Reward Amount ($)</label>
              <div className="relative">
                <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="number" min={0.01} step="0.01" value={form.rewardAmount}
                  onChange={e => setForm({ ...form, rewardAmount: e.target.value })}
                  className={inputClass + ' pl-8'} />
              </div>
            </div>
          )}

          {/* Row 4: Limits + Expiry */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Max Total Uses</label>
              <input type="number" min={1} value={form.maxUses}
                onChange={e => setForm({ ...form, maxUses: e.target.value })}
                placeholder="Unlimited" className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Expiry Date</label>
              <input type="date" value={form.expiresAt}
                onChange={e => setForm({ ...form, expiresAt: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5 flex items-center gap-1">
                <Clock size={10} /> Expiry Time <span className="text-white/20">(optional · UTC)</span>
              </label>
              <input type="time" value={form.expiresTime}
                onChange={e => setForm({ ...form, expiresTime: e.target.value })}
                disabled={!form.expiresAt}
                placeholder="23:59"
                className={inputClass + ' disabled:opacity-30'} />
            </div>
          </div>

          <div className="pt-1">
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-display text-[11px] uppercase tracking-wider disabled:opacity-40 transition-all active:scale-95"
              style={{ background: 'linear-gradient(90deg,#9b5cff,#00c8ff)', color: '#000', fontWeight: 700 }}>
              <Plus size={13} /> {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Create Code'}
            </button>
            <p className="text-[10px] text-white/20 mt-2">Each player can only redeem any given code once regardless of Max Total Uses.</p>
          </div>
        </form>
      </div>

      {/* ── Codes List ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(13,14,20,0.9)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h3 className="font-display text-sm uppercase tracking-wider text-white">All Codes ({codes.length})</h3>
          <button onClick={() => refetch()} disabled={isFetching} className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 disabled:opacity-30 transition-all">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-white/30" /></div>
        ) : codes.length === 0 ? (
          <div className="text-white/30 text-xs py-10 text-center">No promo codes yet — create one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-white/30">
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Reward</th>
                  <th className="px-5 py-3">Uses</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Expires</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {codes.map(c => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <button onClick={() => setViewingCode(c)} className="font-mono font-bold text-[#00c8ff] hover:underline">{c.code}</button>
                    </td>
                    <td className="px-5 py-3 text-white/50 max-w-[160px] truncate">{c.description || '—'}</td>
                    <td className="px-5 py-3">
                      {c.rewardType === 'social_pack' ? (
                        <div className="flex items-center gap-1.5">
                          <Package size={12} className="text-[#9b5cff] shrink-0" />
                          <span className="text-[#9b5cff] font-bold text-[11px] truncate max-w-[100px]">{c.rewardPackName || 'Social Pack'}</span>
                        </div>
                      ) : (
                        <span className="text-white font-bold">${c.rewardAmount.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-white/50">{c.useCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ' / ∞'}</td>
                    <td className="px-5 py-3 text-white/50">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-white/50">{c.expiresAt ? formatExpiryFull(c.expiresAt) : '—'}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => toggleActive(c)}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${c.isActive ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20' : 'bg-white/5 text-white/30 border-white/10 hover:bg-white/10'}`}>
                        {c.isActive ? <CheckCircle2 size={11} /> : <Ban size={11} />} {c.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"><Pencil size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingCode && <CodeDetailModal code={viewingCode} onClose={() => setViewingCode(null)} showToast={showToast} />}
    </section>
  );
};
