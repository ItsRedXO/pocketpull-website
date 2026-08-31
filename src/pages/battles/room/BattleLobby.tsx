import React from 'react';
import { motion } from 'framer-motion';
import { Users, Timer, Bot, Trash2 } from 'lucide-react';
import type { Battle, BattlePlayer } from '../battleTypes';
import { MODE_INFO } from '../battleUtils';
import { getUserColor } from '../../../lib/utils';

interface Props {
  battle: Battle;
  players: BattlePlayer[];
  isHost: boolean;
  isPlayer?: boolean;
  aiCountdown: number | null;
  aiTimerFinished: boolean;
  addingAI: boolean;
  onAddAI: (name?: string) => void;
  onCancel: () => void;
  cancelling?: boolean;
}

export const BattleLobby: React.FC<Props> = ({
  battle,
  players,
  isHost,
  isPlayer = false,
  aiCountdown,
  aiTimerFinished,
  addingAI,
  onAddAI,
  onCancel,
  cancelling = false,
}) => {
  const [showAiSelector, setShowAiSelector] = React.useState(false);
  const safeMode = battle?.mode || 'standard';
  const modeInfo = MODE_INFO[safeMode] || MODE_INFO.standard;
  const battlePacks = (() => {
    try {
      return JSON.parse(battle.packsJson || '[]') as any[];
    } catch {
      return [];
    }
  })();
  const GLOBAL_MAX = 4;
  const effectiveMax = Math.min(battle.playerCount, GLOBAL_MAX);
  const isTeamBattle = battle.teamMode === true || (battle as any).teamMode === 1;
  // Bot capacity is always the global four-player cap; the configured battle
  // size still controls when the battle starts.
  const configuredOpenSlots = effectiveMax - (players?.length || 0);
  const openSlots = Math.min(GLOBAL_MAX - (players?.length || 0), configuredOpenSlots);
  const canAddBot = isPlayer && aiTimerFinished && openSlots > 0 && !addingAI;
  const botNames = ['Jack', 'Dale', 'Emily'];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Player slots */}
        <div className="glass-card p-5">
          <h3 className="font-display text-lg uppercase mb-4 flex items-center gap-2">
            <Users size={16} className="text-[#00c8ff]" /> {isTeamBattle ? 'Teams' : 'Players'}
            <span className="text-gray-500 text-sm ml-1 font-normal normal-case">
              {(players?.length || 0)}/{effectiveMax}
            </span>
          </h3>
          <div className="space-y-2">
            {isTeamBattle ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['left', 'right'] as const).map(side => {
                  const sidePlayers = players.filter(p => p.teamSide === side);
                  return (
                    <div key={side} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#00c8ff]">{side} Team <span className="text-white/30">{sidePlayers.length}/2</span></p>
                      <div className="space-y-2">
                        {sidePlayers.map(p => (
                          <div key={p.id} className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
                            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-xs font-bold" style={{ backgroundColor: getUserColor(p.username), color: 'white' }}>
                              {p.avatar?.startsWith('http') ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : p.isAi ? <Bot size={13} /> : p.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate text-xs font-bold">{p.username}</span>
                            {p.userId === battle.hostUserId && <span className="ml-auto text-[9px] font-bold text-[#ffd700]">HOST</span>}
                          </div>
                        ))}
                        {sidePlayers.length < 2 && <p className="py-2 text-center text-[10px] text-white/30">Open slot</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              Array.from({ length: Math.max(battle.playerCount, players?.length || 0) }).map((_, i) => {
                const p = players?.[i];
                return p ? (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden"
                      style={{ 
                        backgroundColor: (p.isAi || !p.avatar?.startsWith('http')) ? getUserColor(p.username) : 'transparent',
                        color: 'white'
                      }}
                    >
                      {p.avatar?.startsWith('http') ? (
                        <img src={p.avatar} alt="A" className="w-full h-full object-cover" />
                      ) : (
                        p.isAi ? <Bot size={16} /> : p.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{p.username}</p>
                      {p.isAi && (
                        <span className="text-[10px] text-[#9b5cff] font-bold">AI OPPONENT</span>
                      )}
                      {p.userId === battle.hostUserId && !p.isAi && (
                        <span className="text-[10px] text-[#ffd700] font-bold ml-1">HOST</span>
                      )}
                    </div>
                    <span className="ml-auto text-green-400 text-xs font-bold">READY</span>
                  </motion.div>
                ) : (
                  <div
                    key={i}
                    className="flex flex-col gap-2 p-3 rounded-xl bg-white/3 border-2 border-dashed border-white/8"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full border-2 border-dashed border-white/15 flex items-center justify-center">
                        <span className="text-gray-600">+</span>
                      </div>
                      <span className="text-gray-600 text-sm">Waiting for player...</span>
                    </div>
                    
                    {canAddBot && !showAiSelector && (
                      <motion.button
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => setShowAiSelector(true)}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#9b5cff]/10 border border-[#9b5cff]/20 text-[#9b5cff] text-[10px] font-bold hover:bg-[#9b5cff]/20 transition-all"
                      >
                        <Bot size={12} /> Add Bot Opponent
                      </motion.button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Battle info */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="font-display text-lg uppercase">Battle Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Mode</span>
              <span className="font-bold" style={{ color: modeInfo.color }}>
                {modeInfo.icon} {modeInfo.label}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cost/player</span>
              <span className="font-bold text-[#ffd700]">${battle.totalCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Packs</span>
              <span className="font-bold">
                {(battlePacks?.length || 0)} pack{(battlePacks?.length || 0) !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Private code */}
          {!battle.isPublic && battle.privateCode && isHost && (
            <div className="p-3 rounded-xl bg-[#9b5cff]/10 border border-[#9b5cff]/20">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Invite Code</p>
              <p className="font-display text-2xl tracking-widest text-[#9b5cff]">
                {battle.privateCode}
              </p>
            </div>
          )}

          {/* AI countdown */}
          {isPlayer && openSlots > 0 && aiCountdown !== null && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8">
              <Timer size={14} className="text-gray-500" />
              <span className="text-sm text-gray-400">
                AI joining enabled in <strong className="text-white">{aiCountdown}s</strong>
              </span>
            </div>
          )}

          {/* Add Bot button (also near waiting area as backup) */}
          {canAddBot && !showAiSelector && (
            <button
              onClick={() => setShowAiSelector(true)}
              disabled={!canAddBot}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#9b5cff]/15 border border-[#9b5cff]/25 text-[#9b5cff] text-xs font-bold hover:bg-[#9b5cff]/25 transition-all disabled:opacity-50"
            >
              <Bot size={14} /> {addingAI ? 'Adding...' : 'Add Bot Opponent'}
            </button>
          )}

          {/* AI Selector */}
          {showAiSelector && canAddBot && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Choose Your Opponent</p>
              <div className="grid grid-cols-3 gap-2">
                {botNames.map(name => (
                  <button
                    key={name}
                    disabled={!canAddBot}
                    onClick={() => { if (canAddBot) onAddAI(name); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 hover:border-[#9b5cff]/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#9b5cff]/20 flex items-center justify-center text-[#9b5cff] group-hover:scale-110 transition-transform">
                      {name.charAt(0)}
                    </div>
                    <span className="text-[10px] font-bold text-white">{name}</span>
                    <span className="text-[9px] font-bold text-amber-400/80 tracking-tight">51.02%</span>
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setShowAiSelector(false)}
                className="w-full text-[10px] text-gray-500 hover:text-white transition-colors py-1"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Cancel Battle */}
          {isHost && (players?.length || 0) === 1 && (
            <div className="pt-2">
              <button
                onClick={onCancel}
                disabled={cancelling}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                <Trash2 size={14} /> {cancelling ? 'Cancelling...' : 'Cancel & Refund Battle'}
              </button>
              <p className="text-[10px] text-gray-600 text-center mt-2 px-4">
                You can only cancel this battle before anyone else joins. Cancelling will fully refund your entry cost.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
