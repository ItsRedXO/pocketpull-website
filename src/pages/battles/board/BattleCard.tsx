import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Play, Users, Swords, Lock, Trash2, Loader2 } from 'lucide-react';
import { BattleWithPlayers } from '../battleTypes';
import { MODE_INFO } from '../battleUtils';
import { adminCancelBattle } from '../../../lib/api';
import { getUserColor } from '../../../lib/utils';

interface BattleCardProps {
  battle: BattleWithPlayers;
  index: number;
  currentUserId?: string;
  isAdmin?: boolean;
  onJoin: (teamSide?: 'left' | 'right') => void | Promise<void>;
  onWatch: () => void;
  onRefresh?: () => void;
}

export const BattleCard: React.FC<BattleCardProps> = ({ 
  battle, 
  index, 
  currentUserId, 
  isAdmin, 
  onJoin, 
  onWatch,
  onRefresh 
}) => {
  const [cancelling, setCancelling] = useState(false);
  const [joining, setJoining] = useState(false);
  const [teamChoiceOpen, setTeamChoiceOpen] = useState(false);
  const isTeamBattle = battle.teamMode === true || (battle as any).teamMode === 1;
  const leftPlayers = battle.players.filter(p => p.teamSide === 'left').length;
  const rightPlayers = battle.players.filter(p => p.teamSide === 'right').length;
  const isJoined = battle.players.some(p => p.userId === currentUserId);
  const isFull = isTeamBattle
    ? leftPlayers >= 2 && rightPlayers >= 2
    : battle.players.length >= battle.playerCount;
  const isWaiting = battle.status === 'waiting';
  const isLive = battle.status === 'live';
  const isSimulated = battle.isSimulated === true;
  
  let packs: any[] = [];
  try { packs = JSON.parse(battle.packsJson || '[]'); } catch (e) { console.error('json error', e); }
  
  const handleAdminCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('ADMIN: Are you sure you want to cancel this battle and REFUND all players?')) return;
    
    setCancelling(true);
    try {
      await adminCancelBattle(battle.id);
      onRefresh?.();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const mode = MODE_INFO[battle.mode] || MODE_INFO.standard;

  const handleJoin = async (e: React.MouseEvent, teamSide?: 'left' | 'right') => {
    e.stopPropagation();
    if (joining || isJoined || isFull) return;
    if (isTeamBattle && !teamSide) {
      setTeamChoiceOpen(true);
      return;
    }
    setJoining(true);
    try {
      await onJoin(teamSide);
      setTeamChoiceOpen(false);
    } finally {
      // Keep the button locked until the lobby refresh reflects the new player.
      // This prevents rapid clicks from issuing duplicate requests.
      setJoining(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className={`glass-card overflow-hidden group transition-all flex flex-col ${isSimulated ? 'opacity-60 border-white/5 grayscale-[0.3]' : 'hover:border-white/20'}`}
    >
      {/* Header: Mode & Cost */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
            {mode.icon}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold uppercase text-white/40 tracking-wider leading-none">{mode.label}</p>
              {isSimulated ? (
                <span className="text-[8px] font-bold px-1 rounded-sm bg-white/5 text-white/40 border border-white/10 flex items-center gap-1">
                  <Lock size={8} /> PRIVATE
                </span>
              ) : (
                <>
                  {battle.status === 'waiting' && (
                    <span className={`text-[8px] font-bold px-1 rounded-sm border ${isFull ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                      {isFull ? 'FULL' : 'WAITING'}
                    </span>
                  )}
                  {battle.status === 'live' && (
                    <span className="text-[8px] font-bold px-1 rounded-sm bg-green-500/10 text-green-400 border border-green-500/20 animate-pulse">
                      LIVE
                    </span>
                  )}
                </>
              )}
            </div>
            <p className="text-[10px] text-white/20 mt-0.5">{battle.playerCount} Players</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-display text-[#ffd700]">${battle.totalCost.toFixed(2)}</p>
          <p className="text-[9px] text-white/20 uppercase tracking-widest">Entry</p>
        </div>
      </div>

      {/* Body: Packs Preview */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {packs.map((p: any, i: number) => (
            <div key={i} className="w-10 h-12 rounded-lg bg-white/5 flex flex-col items-center justify-center shrink-0 border border-white/5 overflow-hidden">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-8 h-8 object-contain" />
              ) : (
                <span className="text-base leading-none">{p.emoji || '📦'}</span>
              )}
              <span className="text-[8px] text-white/20 mt-0.5">x1</span>
            </div>
          ))}
          {packs.length === 0 && <span className="text-[10px] text-white/10 italic">No packs selected</span>}
        </div>

        {/* Players Slot */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {Array.from({ length: battle.playerCount }).map((_, i) => {
              const p = battle.players[i];
              const isSimulatedUser = p && (p.isAi || isSimulated || !p.avatar?.startsWith('http'));
              
              return (
                <div 
                  key={i} 
                  className={`w-8 h-8 rounded-full border-2 border-[#0d0e14] flex items-center justify-center text-[10px] font-bold overflow-hidden ${p ? (isSimulatedUser ? '' : 'bg-white/10 text-white') : 'bg-white/5 text-white/20 border-dashed border-white/10'}`}
                  style={isSimulatedUser ? { backgroundColor: getUserColor(p.username), color: 'white' } : {}}
                >
                  {p ? (
                    isSimulatedUser ? (
                      p.username.charAt(0).toUpperCase()
                    ) : (
                      p.avatar ? <img src={p.avatar} alt="A" className="w-full h-full rounded-full object-cover" /> : p.username.charAt(0).toUpperCase()
                    )
                  ) : '?'}
                </div>
              );
            })}
          </div>
          <span className="text-[10px] text-white/30 font-medium">
            {battle.players.length}/{battle.playerCount} Slots
          </span>
        </div>
      </div>

      {teamChoiceOpen && isTeamBattle && !isJoined && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-2">
          {(['left', 'right'] as const).map(side => {
            const count = side === 'left' ? leftPlayers : rightPlayers;
            const full = count >= 2;
            return <button key={side} onClick={(e) => handleJoin(e, side)} disabled={full || joining}
              className="rounded-lg border border-white/10 bg-white/5 py-2 text-[10px] font-bold uppercase text-white/70 disabled:opacity-30">
              {side} Team <span className="text-white/40">{count}/2</span>
            </button>;
          })}
        </div>
      )}

      {/* Footer: Actions */}
      <div className="p-3 bg-white/2 mt-auto border-t border-white/5">
        {isSimulated ? (
          <div className="w-full py-2 rounded-lg bg-white/5 border border-white/5 text-white/20 text-[10px] font-bold flex items-center justify-center gap-2 uppercase tracking-widest">
            <Lock size={12} /> PRIVATE BATTLE
          </div>
        ) : isLive ? (
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={handleAdminCancel}
                disabled={cancelling}
                className="flex-none p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50"
                title="Admin Cleanup: Cancel & Refund"
              >
                {cancelling ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            )}
            <button
              onClick={onWatch}
              className="flex-1 py-2 rounded-lg bg-[#00c8ff]/10 border border-[#00c8ff]/20 text-[#00c8ff] text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#00c8ff]/20 transition-all"
            >
              <Eye size={14} /> WATCH LIVE
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={handleAdminCancel}
                disabled={cancelling}
                className="flex-none p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50"
                title="Admin Cleanup: Cancel & Refund"
              >
                {cancelling ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            )}
            <button
              onClick={onWatch}
              className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white transition-all"
            >
              <Eye size={14} /> VIEW
            </button>
            {!isJoined && !isFull && (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="flex-[2] py-2 rounded-lg bg-[#ffd700] text-black text-xs font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[#ffd700]/10 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {joining ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                {joining ? 'JOINING...' : 'JOIN BATTLE'}
              </button>
            )}
            {isJoined && (
              <button
                onClick={() => onJoin()}
                className="flex-[2] py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold flex items-center justify-center gap-2 hover:bg-green-500/30 transition-all"
              >
                <Users size={14} /> RE-JOIN
              </button>
            )}
            {isFull && !isJoined && (
              <div className="flex-[2] py-2 rounded-lg bg-white/5 border border-white/5 text-white/20 text-xs font-bold flex items-center justify-center uppercase tracking-wider">
                Full
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const EmptyState: React.FC<{ onCreateBattle: () => void; message?: string }> = ({ onCreateBattle, message }) => (
  <div className="text-center py-20 bg-white/2 border border-dashed border-white/10 rounded-2xl">
    <div className="inline-flex p-4 rounded-full bg-white/5 mb-4">
      <Swords size={32} className="text-white/20" />
    </div>
    <h3 className="text-white/80 font-display text-lg uppercase tracking-wider">{message || 'No battles found'}</h3>
    <p className="text-white/30 text-sm mt-1 max-w-xs mx-auto mb-6">Create your own battle and invite others to join the pull!</p>
    <button
      onClick={onCreateBattle}
      className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all text-xs font-bold uppercase tracking-widest"
    >
      Create First Battle
    </button>
  </div>
);
