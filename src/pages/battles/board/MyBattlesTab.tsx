import React from 'react';
import { Swords, Eye, LogIn } from 'lucide-react';
import { BattleWithPlayers } from '../battleTypes';

interface MyBattlesTabProps {
  battles: BattleWithPlayers[];
  loading: boolean;
  currentUserId?: string;
  onWatch: (id: string) => void;
  onRejoin: (id: string) => void | Promise<void>;
}

export const MyBattlesTab: React.FC<MyBattlesTabProps> = ({
  battles,
  loading,
  currentUserId,
  onWatch,
  onRejoin,
}) => {
  if (!currentUserId) {
    return (
      <div className="text-center py-20">
        <Swords size={40} className="mx-auto mb-4 text-gray-700" />
        <p className="text-gray-500 text-sm">Sign in to see your battle history.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="glass-card h-20 animate-pulse rounded-xl" />)}
      </div>
    );
  }

  if (battles.length === 0) {
    return (
      <div className="text-center py-20">
        <Swords size={40} className="mx-auto mb-4 text-gray-700" />
        <p className="text-gray-500 text-sm">You haven't joined any battles yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {battles.map(b => {
        const isActive = ['waiting', 'starting', 'live'].includes(b.status);
        return (
          <div key={b.id} className="glass-card p-4 flex items-center justify-between group hover:border-white/20 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                <Swords size={20} className="text-white/40" />
              </div>
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-wider">{b.hostUsername}'s Battle</p>
                <p className="text-[10px] text-white/20 uppercase tracking-widest">{b.mode} · {b.playerCount} players · {b.status}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm font-display text-[#ffd700]">${b.totalCost.toFixed(2)}</p>
                <p className="text-[9px] text-white/20 uppercase tracking-widest">Entry</p>
              </div>
              <button
                onClick={() => { if (isActive) void onRejoin(b.id); else onWatch(b.id); }}
                className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 ${isActive
                  ? 'bg-[#00c8ff]/10 border-[#00c8ff]/25 text-[#00c8ff] hover:bg-[#00c8ff]/20'
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white'}`}
              >
                {isActive ? <><LogIn size={14} /> REJOIN</> : <><Eye size={14} /> VIEW</>}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
