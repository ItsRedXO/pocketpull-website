import React, { useState } from 'react';
import { Gem } from 'lucide-react';
import { BACKEND_BASE } from '../lib/backend';
import { UserRow } from './types';
import { useQueryClient } from '@tanstack/react-query';
import { getAdminAuthHeaders } from './adminAuthHeaders';

interface GemsSectionProps {
  user: UserRow;
  showToast: (m: string, ok?: boolean) => void;
  onUpdate: (user: UserRow) => void;
  logAdminAction: (action: string, targetUser: string, details?: any) => void;
}

async function adminGemsChange(userId: string, mode: 'add' | 'set', amount: number) {
  const h = await getAdminAuthHeaders();
  const response = await fetch(`${BACKEND_BASE}/admin/users/${encodeURIComponent(userId)}/gems`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...h },
    body: JSON.stringify({ mode, amount }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) throw new Error(payload?.error || `Gems update failed (${response.status})`);
  return payload as { gems: number; previousGems: number; delta: number };
}

export function GemsSection({ user, showToast, onUpdate, logAdminAction }: GemsSectionProps) {
  const qc = useQueryClient();
  const [gemsDelta, setGemsDelta] = useState('');
  const [saving, setSaving] = useState(false);
  const currentGems = user.gems ?? 0;

  const handleAdd = async () => {
    if (!gemsDelta.trim()) return;
    const delta = parseInt(gemsDelta, 10);
    if (isNaN(delta)) { showToast('Enter a valid integer (e.g. 500 or -200)', false); return; }
    setSaving(true);
    try {
      const result = await adminGemsChange(user.id, 'add', delta);
      onUpdate({ ...user, gems: result.gems });
      qc.invalidateQueries({ queryKey: ['admin-users-all'] });
      setGemsDelta('');
      showToast(`Gems updated to ${result.gems.toLocaleString()}`);
      logAdminAction('Admin Adjusted Gems', user.username, {
        delta: result.delta, newGems: result.gems, previousGems: result.previousGems,
      });
    } catch (err: any) {
      showToast(`Gems update failed: ${err?.message || 'Unknown error'}`, false);
    } finally { setSaving(false); }
  };

  const handleSet = async () => {
    if (!gemsDelta.trim()) return;
    const nb = parseInt(gemsDelta, 10);
    if (isNaN(nb) || nb < 0) { showToast('Enter a valid non-negative integer.', false); return; }
    setSaving(true);
    try {
      const result = await adminGemsChange(user.id, 'set', nb);
      onUpdate({ ...user, gems: result.gems });
      qc.invalidateQueries({ queryKey: ['admin-users-all'] });
      setGemsDelta('');
      showToast(`Gems set to ${result.gems.toLocaleString()}`);
      logAdminAction('Admin Set Gems', user.username, {
        newGems: result.gems, previousGems: result.previousGems,
      });
    } catch (err: any) {
      showToast(`Gems update failed: ${err?.message || 'Unknown error'}`, false);
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(155,92,255,0.04)', border: '1px solid rgba(155,92,255,0.15)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#9b5cff]/70 font-sans flex items-center gap-1.5">
          <Gem size={11} className="text-[#9b5cff]" />
          Adjust Gems
        </h4>
        <span className="text-sm font-bold text-[#9b5cff]">{currentGems.toLocaleString()} gems</span>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          step="1"
          value={gemsDelta}
          onChange={(e) => setGemsDelta(e.target.value)}
          placeholder="Amount (e.g. 500 or -200)"
          className="admin-input flex-1 text-[13px]"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !gemsDelta.trim()}
          className="px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 transition-all"
          style={{ background: 'rgba(155,92,255,0.15)', border: '1px solid rgba(155,92,255,0.3)', color: '#9b5cff' }}
        >
          {saving ? '...' : '+/- Add'}
        </button>
        <button
          onClick={handleSet}
          disabled={saving || !gemsDelta.trim()}
          className="px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 transition-all"
          style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}
        >
          {saving ? '...' : '= Set'}
        </button>
      </div>
    </div>
  );
}
