import React, { useState } from 'react';
import { Users, X, Trash2, Ban, UserX, Shield, UsersRound, ShieldPlus } from 'lucide-react';
import { blink } from '../lib/blink';
import { UserRow, InventoryRow } from './types';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import { BalanceSection } from './BalanceSection';
import { InventorySection } from './InventorySection';
import { DepositsSection } from './DepositsSection';
import { ActivitySection } from './ActivitySection';
import { ReferralsSection } from './ReferralsSection';

interface UserDetailProps {
  user: UserRow;
  showToast: (m: string, ok?: boolean) => void;
  onClose: () => void;
  onUpdate: (user: UserRow | null) => void;
  onPreviewCard: (card: InventoryRow) => void;
  logAdminAction: (action: string, targetUser: string, details?: any) => void;
}

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function UserDetail({ user, showToast, onClose, onUpdate, onPreviewCard, logAdminAction }: UserDetailProps) {
  const qc = useQueryClient();
  const [banningUser, setBanningUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [promotingUser, setPromotingUser] = useState(false);

  const { data: referrerInfo } = useQuery<{ username: string; code: string } | null>({
    queryKey: ['admin-referrer', user.id, user.referredById],
    queryFn: async () => {
      if (!user.referredById) return null;
      const ref = await blink.db.users.get(user.referredById) as any;
      if (!ref) return null;
      return {
        username: ref.username || ref.displayName || user.referredById.slice(-6),
        code: user.referralCodeUsed || (ref.referralCode as string) || '',
      };
    },
    enabled: !!user.referredById,
    staleTime: 30_000,
  });

  const handleBan = async () => {
    const confirmed = window.confirm(
      `Ban "${user.username || user.email}"?\n\n` +
      `Banning this user will:\n` +
      `• Prevent them from logging in\n` +
      `• Block new registrations using this email\n` +
      `• Keep their account record intact\n\n` +
      `Their email: ${user.email}`
    );
    if (!confirmed) return;
    setBanningUser(true);
    try {
      await blink.db.users.update(user.id, { isBanned: 1 });
      onUpdate({ ...user, isBanned: true });
      qc.invalidateQueries({ queryKey: ['admin-users-all'] });
      showToast(`User banned.`);
      logAdminAction('Admin Banned User', user.username, { userId: user.id });
    } catch {
      showToast('Ban failed.', false);
    }
    setBanningUser(false);
  };

  const handleUnban = async () => {
    if (!window.confirm(`Unban "${user.username || user.email}"? They will be able to log in again.`)) return;
    setBanningUser(true);
    try {
      await blink.db.users.update(user.id, { isBanned: 0 });
      onUpdate({ ...user, isBanned: false });
      qc.invalidateQueries({ queryKey: ['admin-users-all'] });
      showToast(`User unbanned.`);
      logAdminAction('Admin Unbanned User', user.username, { userId: user.id });
    } catch {
      showToast('Unban failed.', false);
    }
    setBanningUser(false);
  };

  const handleDeleteUser = async () => {
    const confirmed = window.confirm(
      `Permanently delete "${user.username || user.email}"?\n\n` +
      `This will:\n` +
      `• Mark the account as DELETED\n` +
      `• Release their email address for future registration\n` +
      `• Preserve financial and game history (detached from account)\n\n` +
      `⚠ This action cannot be undone.\n` +
      `Email to be released: ${user.email}`
    );
    if (!confirmed) return;
    setDeletingUser(true);
    try {
      const deletedEmail = user.email;
      await blink.db.users.update(user.id, {
        isDeleted: 1,
        email: `DELETED_${user.id}`,
        username: `deleted_${user.id.slice(-8)}`,
        isBanned: 0,
      });
      try {
        await blink.db.leaderboardStats.update(user.id, { isDeleted: 1 });
      } catch { /* stats may not exist */ }

      showToast(`User deleted. Email "${deletedEmail}" has been released.`);
      logAdminAction('Admin Deleted User (True Delete)', user.username, {
        userId: user.id,
        emailReleased: deletedEmail,
        reason: 'Admin true-delete via Users Tab',
      });
      onUpdate(null);
      qc.invalidateQueries({ queryKey: ['admin-users-all'] });
    } catch (err: any) {
      showToast(`Delete user failed: ${err.message || 'Unknown error'}`, false);
    }
    setDeletingUser(false);
  };

  const handlePromoteToAdmin = async () => {
    const confirmed = window.confirm(
      `Promote "${user.username || user.email}" to Admin?\n\n` +
      `This will grant them full access to:\n` +
      `• Admin Panel login\n` +
      `• All admin features (users, packs, cashouts, logs, etc.)\n` +
      `• Support chat admin tools\n\n` +
      `⚠ This action cannot be undone through the UI.`
    );
    if (!confirmed) return;
    setPromotingUser(true);
    try {
      await blink.db.users.update(user.id, { role: 'admin' });
      onUpdate({ ...user, role: 'admin' });
      qc.invalidateQueries({ queryKey: ['admin-users-all'] });
      showToast(`"${user.username || user.email}" has been promoted to Admin.`);
      logAdminAction('Admin Promoted User to Admin', user.username, { userId: user.id });
    } catch (err: any) {
      showToast(`Promotion failed: ${err.message || 'Unknown error'}`, false);
    }
    setPromotingUser(false);
  };

  const balance = safeNum(user.balance);
  const matched = safeNum(user.matchedBalance);
  const realBalance = Math.max(0, balance - matched);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex gap-3 items-start">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username || 'User'} className="w-full h-full object-cover" />
              ) : (
                <Users size={20} className="text-white/20" />
              )}
              {user.isBanned && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 border-2 border-[#0d0f1c]">
                  <Ban size={8} />
                </div>
              )}
              {user.isDeleted && (
                <div className="absolute -top-1 -right-1 bg-gray-600 text-white rounded-full p-0.5 border-2 border-[#0d0f1c]">
                  <UserX size={8} />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-display text-lg text-white uppercase flex items-center gap-2 flex-wrap">
                {user.username || user.displayName}
                <div className="flex gap-1.5 items-center">
                  {user.isBanned && <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 tracking-widest flex items-center gap-1"><Ban size={8} /> BANNED</span>}
                  {user.isDeleted && <span className="text-[9px] bg-gray-500/10 text-gray-400 px-1.5 py-0.5 rounded border border-gray-500/20 tracking-widest flex items-center gap-1"><UserX size={8} /> DELETED</span>}
                  {user.role === 'admin' && <span className="text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20 tracking-widest flex items-center gap-1"><Shield size={8} /> ADMIN</span>}
                </div>
              </h3>
              <p className="text-[11px] text-white/40">
                {user.isDeleted ? <span className="italic text-white/20">Email released</span> : user.email}
              </p>
              <p className="text-[10px] text-white/25 mt-0.5">ID: {user.id}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {!user.isDeleted && (
              <>
                {user.isBanned ? (
                  <button onClick={handleUnban} disabled={banningUser}
                    className="p-2 rounded-xl transition-all bg-green-500/10 text-green-400 hover:bg-green-500/20"
                    title="Unban User">
                    <Shield size={16} />
                  </button>
                ) : (
                  <button onClick={handleBan} disabled={banningUser}
                    className="p-2 rounded-xl transition-all bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    title="Ban User">
                    <Ban size={16} />
                  </button>
                )}
                <button onClick={handleDeleteUser} disabled={deletingUser}
                  className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                  title="Delete User (releases email)">
                  <Trash2 size={16} />
                </button>
              </>
            )}
            {!user.isDeleted && user.role !== 'admin' && (
              <button onClick={handlePromoteToAdmin} disabled={promotingUser}
                className="p-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all"
                title="Promote to Admin">
                <ShieldPlus size={16} />
              </button>
            )}
            <button onClick={onClose} className="text-white/20 hover:text-white/50 p-1">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-display mb-2">Account Info</h4>
            <div className="space-y-1">
              <p className="text-[11px] text-white/60">Created: <span className="text-white/80">{new Date(user.createdAt).toLocaleDateString()}</span></p>
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)' }}>
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#f59e0b]/60 font-display mb-2 flex items-center gap-1.5">
              <UsersRound size={11} />
              Referral Origin
            </h4>
            <div className="space-y-1">
              {user.referredById ? (
                <>
                  <p className="text-[10px] text-white/50">
                    From: <span className="text-white/80 font-bold">{referrerInfo?.username ?? '...'}</span>
                  </p>
                  <p className="text-[10px] text-white/50">
                    Code: <span className="text-[#f59e0b] font-mono font-bold tracking-wider">{user.referralCodeUsed || referrerInfo?.code || '...'}</span>
                  </p>
                  <p className="text-[10px]">
                    <span className="text-white/50">Bonus: </span>
                    <span className={`font-bold uppercase text-[9px] ${user.referralRewardPaid ? 'text-green-400' : 'text-amber-400'}`}>
                      {user.referralRewardPaid ? 'PAID ($10 to referrer)' : 'PENDING'}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-white/30">Referred From: <span className="text-white/20">N/A</span></p>
                  <p className="text-[10px] text-white/30">Code Used: <span className="text-white/20">N/A</span></p>
                  <p className="text-[10px] text-white/30">Bonus: <span className="text-white/20">N/A</span></p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-2">
          {[
            { label: 'Balance', value: '$' + balance.toFixed(2), color: '#10b981' },
            { label: 'Matched', value: '$' + matched.toFixed(2), color: '#60a5fa' },
            { label: 'Real', value: '$' + realBalance.toFixed(2), color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{s.label}</p>
              <p className="text-base font-display font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3">
          {[
            { label: 'Status', value: user.isDeleted ? 'Deleted' : user.isBanned ? 'Banned' : 'Active', color: user.isDeleted ? '#6b7280' : user.isBanned ? '#f87171' : '#10b981' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{s.label}</p>
              <p className="text-base font-display font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {user.isBanned && !user.isDeleted && (
        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex gap-3 items-center">
          <Ban size={16} className="text-red-400 shrink-0" />
          <p className="text-xs text-red-400/80">
            This user is <strong>banned</strong>. They cannot log in and their email is blocked from new registrations.
          </p>
        </div>
      )}
      {user.isDeleted && (
        <div className="bg-gray-500/10 border border-gray-500/20 p-3 rounded-xl flex gap-3 items-center">
          <UserX size={16} className="text-gray-400 shrink-0" />
          <p className="text-xs text-gray-400/80">
            This account has been <strong>permanently deleted</strong>. Their email address has been released and can be used for new registrations. Financial and game history has been preserved for audit purposes.
          </p>
        </div>
      )}

      {!user.isDeleted && (
        <>
          <SectionErrorBoundary>
            <BalanceSection
              user={user}
              showToast={showToast}
              onUpdate={onUpdate}
              logAdminAction={logAdminAction}
            />
          </SectionErrorBoundary>
          <SectionErrorBoundary>
            <InventorySection
              user={user}
              showToast={showToast}
              onPreviewCard={onPreviewCard}
            />
          </SectionErrorBoundary>
          <SectionErrorBoundary>
            <DepositsSection user={user} />
          </SectionErrorBoundary>
          <SectionErrorBoundary>
            <ReferralsSection
              user={user}
              showToast={showToast}
              logAdminAction={logAdminAction}
            />
          </SectionErrorBoundary>
          <SectionErrorBoundary>
            <ActivitySection user={user} />
          </SectionErrorBoundary>
        </>
      )}
    </div>
  );
}
