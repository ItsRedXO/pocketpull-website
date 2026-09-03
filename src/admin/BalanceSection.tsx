import React, { useState } from 'react';
import { blink } from '../lib/blink';
import { BACKEND_BASE } from '../lib/backend';
import { UserRow } from './types';
import { useQueryClient } from '@tanstack/react-query';

interface BalanceSectionProps {
  user: UserRow;
  showToast: (m: string, ok?: boolean) => void;
  onUpdate: (user: UserRow) => void;
  logAdminAction: (action: string, targetUser: string, details?: any) => void;
}

async function adminBalanceChange(userId: string, mode: 'add' | 'set', amount: number) {
  const token = await blink.auth.getValidToken();
  const adminSecret = typeof window !== 'undefined' ? localStorage.getItem('pocketpull_admin_pass') : null;
  const response = await fetch(`${BACKEND_BASE}/admin/users/${encodeURIComponent(userId)}/balance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(adminSecret ? { 'X-Admin-Secret': adminSecret } : {}),
    },
    body: JSON.stringify({ mode, amount }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) throw new Error(payload?.error || `Balance update failed (${response.status})`);
  return payload as { balance: number; previousBalance: number; delta: number };
}

export function BalanceSection({ user, showToast, onUpdate, logAdminAction }: BalanceSectionProps) {
  const qc = useQueryClient();
  const [balanceDelta, setBalanceDelta] = useState('');
  const [savingBalance, setSavingBalance] = useState(false);

  const handleBalanceUpdate = async () => {
    if (!balanceDelta.trim()) return;
    const delta = parseFloat(balanceDelta);
    if (isNaN(delta)) {
      showToast('Enter a valid number (e.g. +10 or -5)', false);
      return;
    }
    setSavingBalance(true);
    try {
      const result = await adminBalanceChange(user.id, 'add', delta);
      onUpdate({ ...user, balance: result.balance });
      qc.invalidateQueries({ queryKey: ['admin-users-all'] });
      setBalanceDelta('');
      showToast(`Balance updated to ${Number(result.balance).toFixed(2)}`);
      logAdminAction('Admin Adjusted Balance', user.username, {
        delta: result.delta,
        newBalance: result.balance,
        previousBalance: result.previousBalance,
      });
    } catch (err: any) {
      showToast(`Balance update failed: ${err?.message || 'Unknown error'}`, false);
    } finally {
      setSavingBalance(false);
    }
  };

  const handleSetBalance = async () => {
    if (!balanceDelta.trim()) return;
    const nb = parseFloat(balanceDelta);
    if (isNaN(nb) || nb < 0) {
      showToast('Enter a valid non-negative amount.', false);
      return;
    }
    setSavingBalance(true);
    try {
      const result = await adminBalanceChange(user.id, 'set', nb);
      onUpdate({ ...user, balance: result.balance });
      qc.invalidateQueries({ queryKey: ['admin-users-all'] });
      setBalanceDelta('');
      showToast(`Balance set to ${Number(result.balance).toFixed(2)}`);
      logAdminAction('Admin Set Balance', user.username, {
        newBalance: result.balance,
        previousBalance: result.previousBalance,
      });
    } catch (err: any) {
      showToast(`Balance update failed: ${err?.message || 'Unknown error'}`, false);
    } finally {
      setSavingBalance(false);
    }
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-display mb-3">Adjust Balance</h4>
      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          value={balanceDelta}
          onChange={(e) => setBalanceDelta(e.target.value)}
          placeholder="Amount (e.g. 10 or -5)"
          className="admin-input flex-1 text-[13px]"
        />
        <button
          onClick={handleBalanceUpdate}
          disabled={savingBalance || !balanceDelta.trim()}
          className="px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 transition-all"
          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}
        >
          {savingBalance ? '...' : '± Add'}
        </button>
        <button
          onClick={handleSetBalance}
          disabled={savingBalance || !balanceDelta.trim()}
          className="px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 transition-all"
          style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}
        >
          {savingBalance ? '...' : '= Set'}
        </button>
      </div>
    </div>
  );
}
