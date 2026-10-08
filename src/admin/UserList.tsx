import React, { useState, useEffect } from 'react';
import { Search, Ban, UserX, ChevronLeft, ChevronRight, Shield, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { UserRow, FilterTab } from './types';
import { getPresenceStatus, PRESENCE_COLOR, PRESENCE_LABEL } from './presence';

interface UserListProps {
  users: UserRow[];
  isLoading: boolean;
  search: string;
  setSearch: (s: string) => void;
  filterTab: FilterTab;
  setFilterTab: (t: FilterTab) => void;
  selectedUserId: string | null;
  onSelectUser: (user: UserRow) => void;
  counts: Record<FilterTab, number>;
}

const FILTER_TABS: { key: FilterTab; label: string; color: string }[] = [
  { key: 'active', label: 'Active', color: '#10b981' },
  { key: 'banned', label: 'Banned', color: '#f87171' },
  { key: 'deleted', label: 'Deleted', color: '#6b7280' },
];

const USERS_PER_PAGE = 25;

type SortKey = 'username' | 'balance' | 'createdAt';
type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortKey; label: string; asc: string; desc: string }[] = [
  { key: 'username',  label: 'Name',     asc: 'A→Z',       desc: 'Z→A' },
  { key: 'balance',   label: 'Balance',  asc: 'Low→High',   desc: 'High→Low' },
  { key: 'createdAt', label: 'Joined',   asc: 'Oldest',     desc: 'Newest' },
];

export function UserList({
  users,
  isLoading,
  search,
  setSearch,
  filterTab,
  setFilterTab,
  selectedUserId,
  onSelectUser,
  counts,
}: UserListProps) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Reset page when tab, search, or sort changes
  useEffect(() => {
    setPage(1);
  }, [filterTab, search, sortBy, sortDir]);

  // Filter by tab then by search
  const tabFiltered = users.filter((u) => {
    if (filterTab === 'active') return !u.isDeleted && !u.isBanned;
    if (filterTab === 'banned') return !u.isDeleted && u.isBanned;
    if (filterTab === 'deleted') return u.isDeleted;
    return true;
  });

  const filtered = tabFiltered.filter((u) => {
    const s = search.toLowerCase();
    if (!s) return true;
    return (
      u.email.toLowerCase().includes(s) ||
      u.username.toLowerCase().includes(s) ||
      u.displayName.toLowerCase().includes(s)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'username') cmp = (a.username || a.displayName || '').localeCompare(b.username || b.displayName || '');
    else if (sortBy === 'balance') cmp = a.balance - b.balance;
    else if (sortBy === 'createdAt') cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / USERS_PER_PAGE);
  const startIdx = (page - 1) * USERS_PER_PAGE;
  const pagedUsers = sorted.slice(startIdx, startIdx + USERS_PER_PAGE);

  return (
    <div className="w-full lg:w-72 shrink-0 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Filter tabs */}
      <div className="flex gap-1 mb-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setFilterTab(tab.key);
            }}
            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
            style={{
              background: filterTab === tab.key ? `${tab.color}20` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filterTab === tab.key ? tab.color + '50' : 'rgba(255,255,255,0.07)'}`,
              color: filterTab === tab.key ? tab.color : 'rgba(255,255,255,0.3)',
            }}
          >
            {tab.label}
            <span className="ml-1 opacity-60">({counts[tab.key]})</span>
          </button>
        ))}
      </div>

      <div className="relative mb-2 shrink-0">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-[12px] text-white placeholder-white/20 outline-none focus:border-[#9b5cff]/50 focus:bg-white/[0.07] transition-colors"
        />
      </div>

      {/* Sort bar */}
      <div className="flex gap-1 mb-2 shrink-0 flex-wrap">
        {SORT_OPTIONS.map(opt => {
          const active = sortBy === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => {
                if (active) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                else { setSortBy(opt.key); setSortDir(opt.key === 'balance' ? 'desc' : opt.key === 'createdAt' ? 'desc' : 'asc'); }
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: active ? 'rgba(155,92,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(155,92,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: active ? '#9b5cff' : 'rgba(255,255,255,0.3)',
              }}
            >
              {opt.label}
              {active
                ? sortDir === 'asc'
                  ? <ArrowUp size={9} />
                  : <ArrowDown size={9} />
                : <ArrowUpDown size={9} className="opacity-40" />
              }
            </button>
          );
        })}
      </div>

      <div className="flex justify-between items-center mb-1 px-1 shrink-0">
        <p className="text-[10px] text-white/25 uppercase tracking-wider">{sorted.length} users</p>
        {totalPages > 1 && (
          <p className="text-[10px] text-white/25 uppercase tracking-wider">Page {page} of {totalPages}</p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-12 rounded-xl animate-pulse"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 pb-2">
            {pagedUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => onSelectUser(u)}
                className="text-left px-3 py-2.5 rounded-xl transition-all relative overflow-hidden shrink-0"
                style={{
                  background: selectedUserId === u.id ? 'rgba(155,92,255,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${
                    selectedUserId === u.id
                      ? 'rgba(155,92,255,0.4)'
                      : u.isBanned
                      ? 'rgba(248,113,113,0.2)'
                      : u.isDeleted
                      ? 'rgba(107,114,128,0.2)'
                      : 'rgba(255,255,255,0.07)'
                  }`,
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex items-center gap-2">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 border border-white/10" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <span className="text-[8px] text-white/20 font-bold uppercase">{(u.username || u.displayName || '?')[0]}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {!u.isDeleted && (() => {
                          const status = getPresenceStatus(u.lastSeenAt, u.lastActiveAt);
                          return (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: PRESENCE_COLOR[status], boxShadow: `0 0 4px ${PRESENCE_COLOR[status]}` }}
                              title={PRESENCE_LABEL[status]}
                            />
                          );
                        })()}
                        <p className={`text-[12px] font-sans truncate ${u.isDeleted ? 'text-white/30' : 'text-white'}`}>
                          {u.username || u.displayName || 'Unknown'}
                        </p>
                        {u.role === 'admin' && !u.isDeleted && (
                          <Shield size={10} className="text-purple-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-white/30 truncate">
                        {u.isDeleted ? <span className="text-white/15 italic">email released</span> : u.email}
                      </p>
                      {!u.isDeleted && (
                        <p className="text-[10px] font-bold" style={{ color: '#10b981' }}>
                          ${u.balance.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 items-end">
                    {u.isBanned && (
                      <div className="bg-red-500/20 text-red-400 p-1 rounded-md" title="Banned">
                        <Ban size={10} />
                      </div>
                    )}
                    {u.isDeleted && (
                      <div className="bg-gray-500/20 text-gray-500 p-1 rounded-md" title="Deleted">
                        <UserX size={10} />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/5 shrink-0">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="flex-1 flex items-center justify-center py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} />
          </button>
          
          <div className="flex-[2] flex items-center justify-center text-[10px] font-bold text-white/40 uppercase tracking-tighter">
            Page {page} / {totalPages}
          </div>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="flex-1 flex items-center justify-center py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

