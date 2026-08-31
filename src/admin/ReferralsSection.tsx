import React, { useState } from 'react';
import { Users, Edit3, Check, X, Copy } from 'lucide-react';
import { blink } from '../lib/blink';
import { UserRow } from './types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface ReferralsSectionProps {
  user: UserRow;
  showToast: (m: string, ok?: boolean) => void;
  logAdminAction: (action: string, targetUser: string, details?: any) => void;
}

interface ReferredUser {
  id: string;
  username: string;
  signedUpAt: string;
  hasDeposited5: boolean;
  rewardPaid: boolean;
}

export function ReferralsSection({ user, showToast, logAdminAction }: ReferralsSectionProps) {
  const qc = useQueryClient();
  const [editingCode, setEditingCode] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Fetch user's own referral code & referred users ──────────────────────
  const { data, isLoading } = useQuery<{
    referralCode: string;
    referredUsers: ReferredUser[];
    totalCount: number;
  }>({
    queryKey: ['admin-referrals', user.id],
    queryFn: async () => {
      // Get user row fresh for latest referralCode
      const userRow = await blink.db.users.get(user.id) as any;
      const referralCode = (userRow?.referralCode as string) || '';

      // Get referred users
      const rawReferred = await blink.db.users.list({
        where: { referredById: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 100,
      }) as any[];

      // Resolve deposit status for each referred user
      const referredUsers: ReferredUser[] = await Promise.all(
        (rawReferred || []).map(async (u: any) => {
          let hasDeposited5 = false;
          let rewardPaid = Number(u.referralRewardPaid) > 0;

          if (!rewardPaid) {
            // Check if any deposit >= $5 exists
            const rows = await blink.db.transactions.list({
              where: { userId: u.id, type: 'deposit' },
              limit: 50,
            }) as any[];
            hasDeposited5 = (rows || []).some((t: any) => Number(t.amount) >= 5);
          } else {
            hasDeposited5 = true;
          }

          return {
            id: u.id,
            username: u.username || u.displayName || u.id.slice(-6),
            signedUpAt: u.createdAt || '',
            hasDeposited5,
            rewardPaid,
          };
        })
      );

      return {
        referralCode,
        referredUsers,
        totalCount: rawReferred?.length || 0,
      };
    },
    staleTime: 15_000,
  });

  // ── Edit referral code ───────────────────────────────────────────────────
  const startEditing = () => {
    setNewCode(data?.referralCode || '');
    setEditingCode(true);
  };

  const cancelEditing = () => {
    setEditingCode(false);
    setNewCode('');
  };

  const handleSaveCode = async () => {
    const trimmed = newCode.trim().toUpperCase();
    if (!trimmed || trimmed.length < 4 || trimmed.length > 16) {
      showToast('Code must be 4-16 characters.', false);
      return;
    }

    // Check uniqueness
    const existing = await blink.db.users.list({
      where: { referralCode: trimmed },
      limit: 5,
    }) as any[];
    const conflict = existing?.find((r: any) => r.id !== user.id);
    if (conflict) {
      showToast(`Code "${trimmed}" is already in use.`, false);
      return;
    }

    setSaving(true);
    try {
      await blink.db.users.update(user.id, { referralCode: trimmed });
      qc.invalidateQueries({ queryKey: ['admin-referrals', user.id] });
      showToast(`Referral code changed to "${trimmed}".`);
      logAdminAction('Admin Changed Referral Code', user.username, {
        oldCode: data?.referralCode,
        newCode: trimmed,
      });
      setEditingCode(false);
    } catch {
      showToast('Failed to update code.', false);
    }
    setSaving(false);
  };

  const copyCode = () => {
    if (data?.referralCode) {
      navigator.clipboard.writeText(data.referralCode);
      showToast('Code copied!');
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 border-[#00c8ff]/20 border-t-[#00c8ff] animate-spin" />
        </div>
      </div>
    );
  }

  const referralCode = data?.referralCode || '';
  const referredUsers = data?.referredUsers || [];
  const totalCount = data?.totalCount || 0;

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-display flex items-center gap-2">
          <Users size={12} className="text-[#f59e0b]" />
          Referrals · {totalCount} user{totalCount !== 1 ? 's' : ''}
        </h4>
        <span className="text-[10px] font-bold font-display text-[#f59e0b]/80 tracking-wider">
          ${(totalCount * 10).toFixed(2)} potential
        </span>
      </div>

      {/* Referral code */}
      <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-widest text-white/30">Referral Code</span>
          {!editingCode && (
            <div className="flex items-center gap-1">
              <button onClick={copyCode} className="text-white/20 hover:text-white/50 transition-colors" title="Copy code">
                <Copy size={11} />
              </button>
              <button onClick={startEditing} className="text-white/20 hover:text-white/50 transition-colors ml-1" title="Edit code">
                <Edit3 size={11} />
              </button>
            </div>
          )}
        </div>

        {editingCode ? (
          <div className="flex items-center gap-2">
            <input
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              className="admin-input text-[13px] flex-1 font-mono tracking-widest text-center"
              placeholder="NEWCODE"
              maxLength={16}
              autoFocus
            />
            <button
              onClick={handleSaveCode}
              disabled={saving}
              className="p-1.5 rounded-lg text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-30"
              title="Save"
            >
              <Check size={14} />
            </button>
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <p className="text-lg font-mono font-bold tracking-widest text-[#f59e0b]">
            {referralCode || '—'}
          </p>
        )}

        <p className="text-[8px] text-white/20 mt-1.5 leading-relaxed">
          New users who enter this code at signup are linked to this account.
          Editing this code does not break existing referrals.
        </p>
      </div>

      {/* Referred users list */}
      {referredUsers.length === 0 ? (
        <p className="text-[11px] text-white/20 text-center py-4">No one has used this referral code yet.</p>
      ) : (
        <div
          className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
        >
          {referredUsers.map((ref) => {
            const statusLabel = ref.rewardPaid
              ? 'Reward Paid'
              : ref.hasDeposited5
                ? 'Deposit Pending'
                : 'Signed Up';
            const statusColor = ref.rewardPaid
              ? '#10b981'
              : ref.hasDeposited5
                ? '#f59e0b'
                : '#6b7280';

            return (
              <div
                key={ref.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-white/80 truncate">{ref.username}</p>
                  <p className="text-[8px] text-white/25">
                    {ref.signedUpAt ? new Date(ref.signedUpAt).toLocaleDateString() : ''}
                  </p>
                </div>
                <span
                  className="text-[9px] font-bold uppercase tracking-wider shrink-0 px-2 py-0.5 rounded"
                  style={{
                    background: statusColor + '18',
                    color: statusColor,
                    border: `1px solid ${statusColor}30`,
                  }}
                >
                  {statusLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
