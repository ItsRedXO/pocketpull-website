import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { X, Trophy, ShoppingBag, Award, Target } from 'lucide-react';
import { getBrawlTrainer } from '../../lib/brawlApi';
import { typeColor } from './typeColors';

export function TrainerDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ['brawl-trainer', userId], queryFn: () => getBrawlTrainer(userId) });
  const trainer = data?.trainer;
  const games = (trainer?.wins ?? 0) + (trainer?.losses ?? 0);
  const winPct = games > 0 ? Math.round(((trainer?.wins ?? 0) / games) * 100) : 0;
  const initials = (trainer?.username || 'T').trim().slice(0, 1).toUpperCase();

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-2xl border border-white/10 overflow-hidden" style={{ background: '#0d0e14' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <div className="text-xs font-bold uppercase tracking-widest text-white/60">Trainer Profile</div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        {isLoading ? (
          <div className="text-white/40 text-sm py-16 text-center">Loading…</div>
        ) : isError || !trainer ? (
          <div className="text-white/40 text-sm py-16 text-center">Couldn't load this trainer.</div>
        ) : (
          <div className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#00c8ff]/40 bg-[#1b1d2a] text-lg font-bold text-[#00c8ff]">
                {trainer.avatarUrl ? <img src={trainer.avatarUrl} alt={trainer.username || 'Trainer'} className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /> : initials}
              </span>
              <div className="min-w-0">
                <div className="text-lg font-bold text-white truncate">{trainer.username || 'Trainer'}</div>
                <div className="flex items-center gap-1.5 text-[#9b5cff] text-xs font-bold"><Trophy size={12} /> {trainer.leagueRating} rating</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-center">
                <div className="text-lg font-bold text-white">{winPct}%</div>
                <div className="text-[10px] uppercase tracking-wider text-white/30">Win Rate</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-center">
                <div className="text-lg font-bold text-green-400">{trainer.wins}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/30">Wins</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-center">
                <div className="text-lg font-bold text-red-400">{trainer.losses}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/30">Losses</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-center flex flex-col items-center gap-1">
                <Award size={14} className="text-[#9b5cff]" />
                <div className="text-lg font-bold text-white">{trainer.regionalTournamentWins}</div>
                <div className="text-[9px] uppercase tracking-wider text-white/30 leading-tight">Regional Wins</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-center flex flex-col items-center gap-1">
                <Trophy size={14} className="text-[#facc15]" />
                <div className="text-lg font-bold text-white">{trainer.eliteFourWins}</div>
                <div className="text-[9px] uppercase tracking-wider text-white/30 leading-tight">Elite Four Wins</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-center flex flex-col items-center gap-1">
                <Target size={14} className="text-white/30" />
                <div className="text-lg font-bold text-white/50">{trainer.challengesCompleted}</div>
                <div className="text-[9px] uppercase tracking-wider text-white/30 leading-tight">Challenges (soon)</div>
              </div>
            </div>

            <div className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Active Team</div>
            {trainer.team.length === 0 ? (
              <p className="text-white/30 text-xs mb-6">No active team set.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
                {trainer.team.map(mon => (
                  <div key={mon.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 flex flex-col items-center">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/20 flex items-center justify-center">
                      {mon.artwork_url ? <img src={mon.artwork_url} alt={mon.name} className="w-full h-full object-contain scale-150" style={{ objectPosition: 'top' }} /> : null}
                    </div>
                    <div className="text-[10px] font-bold text-white capitalize mt-1 truncate w-full text-center">{mon.name}</div>
                    <span className="text-[7px] px-1.5 py-0.5 rounded-full uppercase font-bold mt-1" style={{ background: `${typeColor(mon.primary_type)}30`, color: typeColor(mon.primary_type) }}>{mon.primary_type}</span>
                    <div className="text-[9px] text-[#00c8ff] font-bold mt-1">OVR {mon.overall_rating}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Items</div>
            <div className="flex items-center gap-2 text-white/30 text-xs rounded-xl border border-dashed border-white/10 px-3 py-3">
              <ShoppingBag size={14} /> Coming soon
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
