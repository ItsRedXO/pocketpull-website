import React from 'react';
import { Trophy, Eye } from 'lucide-react';
import { BattleWithPlayers } from '../battleTypes';

interface DailyTabProps {
  battles: BattleWithPlayers[];
  loading: boolean;
  onWatch: (id: string) => void;
}

export const DailyTab: React.FC<DailyTabProps> = ({
  battles,
  loading,
  onWatch,
}) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="glass-card h-20 animate-pulse rounded-xl" />)}
      </div>
    );
  }

  if (battles.length === 0) {
    return (
      <div className="text-center py-20 bg-white/2 border border-dashed border-white/10 rounded-2xl">
        <Trophy size={40} className="mx-auto mb-4 text-gray-700" />
        <p className="text-gray-500 text-sm">No finished battles yet today. Be the first!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {battles.map((b, i) => (
        <div key={b.id} className="glass-card p-4 flex items-center justify-between group hover:border-white/20 transition-all relative overflow-hidden">
          {i === 0 && (
            <div className="absolute top-0 right-0 px-3 py-1 bg-[#ffd700] text-black text-[9px] font-bold uppercase tracking-widest rounded-bl-lg">
              Daily Record
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
              <Trophy size={20} className={i === 0 ? "text-[#ffd700]" : "text-white/20"} />
            </div>
            <div>
              <p className="text-sm font-bold text-white uppercase tracking-wider">{b.hostUsername}'s Battle</p>
              <p className="text-[10px] text-white/20 uppercase tracking-widest">{b.mode} · {b.playerCount} players</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-display text-[#ffd700]">${(b.totalCost * b.playerCount).toFixed(2)}</p>
              <p className="text-[9px] text-white/20 uppercase tracking-widest">Total Pot</p>
            </div>
            <button
              onClick={() => onWatch(b.id)}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-bold hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
            >
              <Eye size={14} /> REPLAY
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
