import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { blink } from '../lib/blink';
import { BACKEND_BASE } from '../lib/backend';
import { CardPreviewModal } from './CardPreviewModal';
import { UserRow, InventoryRow, FilterTab } from './types';
import { UserList } from './UserList';
import { UserDetail } from './UserDetail';

async function logAdminAction(action: string, targetUser: string, details: Record<string, any> = {}) {
  try {
    await fetch(`${BACKEND_BASE}/admin/logs/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': 'true' },
      body: JSON.stringify({ adminUsername: 'Admin', action, targetUser, details }),
    });
  } catch { /* non-critical */ }
}

export function UsersTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('active');
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [previewCard, setPreviewCard] = useState<InventoryRow | null>(null);

  // Load the real application accounts. The migrated users table also contains
  // AI battle users and placeholder rows that are not site accounts and should
  // never inflate the admin user count.
  const { data: allUsers = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ['admin-users-all'],
    queryFn: async () => {
      const rows = await blink.db.users.list({
        orderBy: { createdAt: 'desc' },
        limit: 500,
      });
      return rows
        .filter((r: any) => {
          const isBot = Number(r.isBot || r.is_bot) > 0;
          const hasAccountIdentity = Boolean(r.username || r.displayName || r.display_name || r.email);
          return !isBot && hasAccountIdentity;
        })
        .map((r: any) => ({
          id: r.id,
          email: r.email || '',
          username: r.username || r.displayName || r.display_name || '',
          displayName: r.displayName || r.display_name || r.username || '',
          balance: Number(r.balance) || 0,
          matchedBalance: Number(r.matchedBalance || r.matched_balance || 0) || 0,
          createdAt: r.createdAt || '',
          isBanned: Number(r.isBanned || r.is_banned) > 0,
          emailVerified: Number(r.emailVerified || r.email_verified) > 0,
          verifiedAt: r.verifiedAt || r.verified_at || null,
          verificationMethod: r.verificationMethod || r.verification_method || null,
          isDeleted: Number(r.isDeleted || r.is_deleted) > 0,
          referredById: (r.referredById || r.referred_by_id || null) as string | null,
          referralCodeUsed: (r.referralCodeUsed || r.referral_code_used || null) as string | null,
          referrerUsername: null,
          referralRewardPaid: Number(r.referralRewardPaid || r.referral_reward_paid || 0) > 0,
          role: (r.role as string) || '',
          avatarUrl: (r.avatarUrl || r.avatar_url || null) as string | null,
        }));
    },
    staleTime: 0,
    refetchInterval: 5000,
  });

  const counts = {
    active: allUsers.filter(u => !u.isDeleted && !u.isBanned).length,
    banned: allUsers.filter(u => !u.isDeleted && u.isBanned).length,
    deleted: allUsers.filter(u => u.isDeleted).length,
  };

  const currentSelectedUser = selectedUser ? (allUsers.find(u => u.id === selectedUser.id) || selectedUser) : null;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-150px)] min-h-[520px] lg:min-h-[500px]">
      <div className={currentSelectedUser ? 'hidden lg:flex' : 'flex'}>
        <UserList
          users={allUsers}
          isLoading={isLoading}
          search={search}
          setSearch={setSearch}
          filterTab={filterTab}
          setFilterTab={(t) => {
            setFilterTab(t);
            setSelectedUser(null);
          }}
          selectedUserId={currentSelectedUser?.id || null}
          onSelectUser={setSelectedUser}
          counts={counts}
        />
      </div>

      <div className="flex-1 min-w-0 min-h-0 h-full overflow-y-auto pr-0 lg:pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {!currentSelectedUser ? (
          <div className="flex items-center justify-center h-full min-h-48">
            <div className="text-center">
              <Users size={36} className="text-white/10 mx-auto mb-3" />
              <p className="text-white/20 text-sm">Select a user to view details</p>
            </div>
          </div>
        ) : (
          <>
            <button onClick={() => setSelectedUser(null)} className="lg:hidden flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider text-[#00c8ff] bg-[#00c8ff]/10 border border-[#00c8ff]/20">
              ← Back to users
            </button>
            <UserDetail
              user={currentSelectedUser}
              showToast={showToast}
              onClose={() => setSelectedUser(null)}
              onUpdate={setSelectedUser}
              onPreviewCard={setPreviewCard}
              logAdminAction={logAdminAction}
            />
          </>
        )}
      </div>
      <CardPreviewModal card={previewCard} onClose={() => setPreviewCard(null)} />
    </div>
  );
}
