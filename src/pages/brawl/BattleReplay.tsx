import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, FastForward, X, Skull, Trophy, Coins, ArrowUp, ArrowDown } from 'lucide-react';
import type { BattleEvent, BrawlMatchResult, LeagueChangeResult } from '../../lib/brawlApi';
import { typeColor } from './typeColors';
import { LEAGUE_COLOR, LEAGUE_LABEL } from './leagueColors';

interface ActiveMon { name: string; artworkUrl: string | null; maxHp: number; currentHp: number; primaryType: string; secondaryType: string | null; }

function foldEvents(events: BattleEvent[]) {
  let user: ActiveMon | null = null;
  let opponent: ActiveMon | null = null;
  let koUser = 0, koOpponent = 0;
  const feed: string[] = [];
  let lastMove: Extract<BattleEvent, { type: 'move' }> | null = null;

  for (const ev of events) {
    if (ev.type === 'send_out') {
      const mon: ActiveMon = { name: ev.name, artworkUrl: ev.artworkUrl, maxHp: ev.maxHp, currentHp: ev.maxHp, primaryType: ev.primaryType, secondaryType: ev.secondaryType };
      if (ev.side === 'user') user = mon; else opponent = mon;
    } else if (ev.type === 'move') {
      lastMove = ev;
      const target = ev.side === 'user' ? opponent : user;
      if (target) target.currentHp = ev.defenderHpAfter;
    } else if (ev.type === 'faint') {
      feed.push(`${ev.name} fainted!`);
      if (ev.side === 'opponent') koUser++; else koOpponent++;
    }
  }
  return { user, opponent, koUser, koOpponent, feed, lastMove };
}

const EFFECTIVENESS_LABEL: Record<string, string> = { immune: 'No effect', 'not-very-effective': 'Not very effective', neutral: '', 'super-effective': 'Super effective!' };
const EFFECTIVENESS_COLOR: Record<string, string> = { immune: '#8892a4', 'not-very-effective': '#a8a878', neutral: '#ffffff', 'super-effective': '#f8d030' };

function HpBar({ current, max, side }: { current: number; max: number; side: 'user' | 'opponent' }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const color = pct > 50 ? '#4ade80' : pct > 20 ? '#facc15' : '#f87171';
  return (
    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
      <motion.div className="h-full rounded-full" animate={{ width: `${pct}%`, background: color }} transition={{ duration: 0.4 }}
        style={{ marginLeft: side === 'opponent' ? 'auto' : 0 }} />
    </div>
  );
}

function MonPanel({ mon, side }: { mon: ActiveMon | null; side: 'user' | 'opponent' }) {
  const accent = side === 'user' ? '#00c8ff' : '#f87171';
  return (
    <div className={`flex-1 flex flex-col items-center gap-2 ${side === 'opponent' ? 'items-end text-right' : 'items-start text-left'}`}>
      <div className="flex items-center gap-2" style={{ flexDirection: side === 'opponent' ? 'row-reverse' : 'row' }}>
        <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
        <span className="text-xs font-bold text-white capitalize">{mon?.name || '—'}</span>
      </div>
      <div className="w-full max-w-[160px]"><HpBar current={mon?.currentHp ?? 0} max={mon?.maxHp || 1} side={side} /></div>
      <div className="text-[10px] text-white/40">{mon ? `${Math.max(0, mon.currentHp)}/${mon.maxHp} HP` : ''}</div>
      <div className="w-24 h-24 rounded-xl overflow-hidden bg-black/20 flex items-center justify-center border" style={{ borderColor: `${accent}40` }}>
        {mon?.artworkUrl ? <img src={mon.artworkUrl} alt={mon.name} className="w-full h-full object-contain scale-150" style={{ objectPosition: 'top', transform: side === 'opponent' ? 'scaleX(-1) scale(1.5)' : 'scale(1.5)' }} /> : null}
      </div>
    </div>
  );
}

export function BattleReplay({ matches, tierLabel, status, reward, league, onClose }: { matches: BrawlMatchResult[]; tierLabel: string; status: 'won' | 'eliminated'; reward: number; league: LeagueChangeResult; onClose: () => void }) {
  const [matchIndex, setMatchIndex] = useState(0);
  const [eventIndex, setEventIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);

  const match = matches[matchIndex];
  const visibleEvents = useMemo(() => match.log.slice(0, eventIndex + 1), [match, eventIndex]);
  const state = useMemo(() => foldEvents(visibleEvents), [visibleEvents]);
  const atMatchEnd = eventIndex >= match.log.length - 1;

  useEffect(() => {
    if (!playing || atMatchEnd) return;
    const t = setTimeout(() => setEventIndex(i => Math.min(match.log.length - 1, i + 1)), 900);
    return () => clearTimeout(t);
  }, [playing, atMatchEnd, match.log.length, eventIndex]);

  const handleSkip = () => setEventIndex(match.log.length - 1);
  const handleNextMatch = () => {
    if (matchIndex < matches.length - 1) { setMatchIndex(i => i + 1); setEventIndex(0); setPlaying(true); }
    else setFinished(true);
  };

  const lastMove = state.lastMove;

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-3xl rounded-2xl border border-white/10 overflow-hidden" style={{ background: '#0d0e14' }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <div className="text-xs font-bold uppercase tracking-widest text-white/60">{tierLabel} — Match {matchIndex + 1}/{matches.length}</div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        {!finished ? (
          <div className="relative p-6 min-h-[340px]" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(155,92,255,0.08) 0%, transparent 60%)' }}>
            {/* kill feed, top-right */}
            <div className="absolute top-3 right-3 flex flex-col gap-1 items-end max-w-[45%]">
              <AnimatePresence>
                {state.feed.slice(-4).map((f, i) => (
                  <motion.div key={f + i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-black/50 text-white/70">
                    <Skull size={10} className="text-red-400" /> {f}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="flex items-start justify-between gap-4 mt-6">
              <MonPanel mon={state.user} side="user" />
              <div className="flex flex-col items-center justify-center gap-2 px-2 pt-4">
                <div className="text-[10px] uppercase tracking-widest text-white/30">KOs</div>
                <div className="text-sm font-bold text-white">{state.koUser} — {state.koOpponent}</div>
                <AnimatePresence mode="wait">
                  {lastMove && (
                    <motion.div key={visibleEvents.length} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className="mt-2 w-14 h-14 rounded-full flex items-center justify-center text-[9px] font-bold text-center uppercase"
                      style={{ background: `${typeColor(lastMove.moveType)}25`, border: `2px solid ${typeColor(lastMove.moveType)}`, color: typeColor(lastMove.moveType) }}>
                      {lastMove.moveType}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <MonPanel mon={state.opponent} side="opponent" />
            </div>

            {/* move info box, bottom-right */}
            <div className="absolute bottom-3 right-3 max-w-[70%] sm:max-w-[260px] rounded-lg border border-white/10 bg-black/60 px-3 py-2">
              {lastMove ? (
                <>
                  <div className="text-[11px] text-white"><span className="font-bold capitalize">{lastMove.attacker}</span> used <span className="font-bold">{lastMove.move}</span></div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold" style={{ background: `${typeColor(lastMove.moveType)}30`, color: typeColor(lastMove.moveType) }}>{lastMove.moveType}</span>
                    <span className="text-[10px] text-white/50">{lastMove.damage} dmg</span>
                    {EFFECTIVENESS_LABEL[lastMove.effectiveness] && <span className="text-[10px] font-bold" style={{ color: EFFECTIVENESS_COLOR[lastMove.effectiveness] }}>{EFFECTIVENESS_LABEL[lastMove.effectiveness]}</span>}
                  </div>
                </>
              ) : <div className="text-[11px] text-white/30">Battle starting…</div>}
            </div>

            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <button onClick={() => setPlaying(p => !p)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
                {playing ? <Pause size={13} /> : <Play size={13} />}
              </button>
              {!atMatchEnd ? (
                <button onClick={handleSkip} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white"><FastForward size={13} /></button>
              ) : (
                <button onClick={handleNextMatch} className="px-3 h-8 rounded-full bg-[#00c8ff] text-black text-[11px] font-bold uppercase">
                  {matchIndex < matches.length - 1 ? 'Next Match' : 'See Result'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            {status === 'won' ? <Trophy size={40} className="text-[#facc15] mx-auto mb-3" /> : <Skull size={40} className="text-white/30 mx-auto mb-3" />}
            <h3 className="font-display text-2xl uppercase tracking-widest text-white mb-1">{status === 'won' ? 'Victory' : 'Eliminated'}</h3>
            <p className="text-white/40 text-xs mb-4">{tierLabel} — {matches.filter(m => m.result === 'win').length}/{matches.length} matches won</p>
            <div className="flex items-center justify-center gap-2 flex-wrap mb-5">
              {reward > 0 && (
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#facc15]/10 border border-[#facc15]/30 text-[#facc15] font-bold text-sm">
                  <Coins size={14} /> +{reward} pokedollars
                </div>
              )}
              <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold" style={{ background: `${LEAGUE_COLOR[league.newLeague]}15`, border: `1px solid ${LEAGUE_COLOR[league.newLeague]}40`, color: LEAGUE_COLOR[league.newLeague] }}>
                {league.newRating >= league.previousRating ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                {league.newRating - league.previousRating >= 0 ? '+' : ''}{league.newRating - league.previousRating} rating
              </div>
            </div>
            {(league.promoted || league.demoted) && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 px-4 py-2 rounded-xl inline-block"
                style={{ background: `${LEAGUE_COLOR[league.newLeague]}15`, border: `1px solid ${LEAGUE_COLOR[league.newLeague]}50` }}>
                <div className="text-[11px] uppercase tracking-widest text-white/40">{league.promoted ? 'Promoted!' : 'Demoted'}</div>
                <div className="text-sm font-bold" style={{ color: LEAGUE_COLOR[league.newLeague] }}>{LEAGUE_LABEL[league.previousLeague]} → {LEAGUE_LABEL[league.newLeague]} League</div>
              </motion.div>
            )}
            <div><button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black font-bold text-sm uppercase tracking-wider">Continue</button></div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
