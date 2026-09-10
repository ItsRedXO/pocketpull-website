import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, FastForward, X, Skull, Trophy, Coins, ArrowUp, ArrowDown } from 'lucide-react';
import type { ArenaFrame, ArenaObstacle, BrawlMatchResult, RatingChangeResult } from '../../lib/brawlApi';
import { typeColor } from './typeColors';

const EFFECTIVENESS_LABEL: Record<string, string> = { immune: 'No effect', 'not-very-effective': 'Not very effective', neutral: '', 'super-effective': 'Super effective!' };
const EFFECTIVENESS_COLOR: Record<string, string> = { immune: '#8892a4', 'not-very-effective': '#a8a878', neutral: '#ffffff', 'super-effective': '#f8d030' };
const BASE_TICK_MS = 180;
const SPEED_OPTIONS = [1, 2, 5, 10, 16] as const;

function PokemonIcon({ mon, tickSeconds }: { mon: ArenaFrame['pokemon'][number]; tickSeconds: number }) {
  const accent = mon.side === 'user' ? '#00c8ff' : '#f87171';
  const hpPct = Math.max(0, Math.min(100, (mon.hp / mon.maxHp) * 100));
  const hpColor = hpPct > 50 ? '#4ade80' : hpPct > 20 ? '#facc15' : '#f87171';
  return (
    <motion.div
      className="absolute flex flex-col items-center"
      style={{ transform: 'translate(-50%, -50%)' }}
      animate={{ left: `${mon.x}%`, top: `${mon.y}%`, opacity: mon.fainted ? 0.2 : 1 }}
      transition={{ duration: tickSeconds, ease: 'linear' }}
    >
      <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center" style={{ background: '#0006', border: `1.5px solid ${accent}`, filter: mon.fainted ? 'grayscale(1)' : undefined }}>
        {mon.artworkUrl ? <img src={mon.artworkUrl} alt={mon.name} className="w-full h-full object-contain scale-[2.2]" style={{ objectPosition: 'top' }} /> : null}
      </div>
      {!mon.fainted && (
        <div className="w-6 h-[3px] rounded-full bg-white/15 mt-0.5 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${hpPct}%`, background: hpColor }} />
        </div>
      )}
      <div className="text-[7px] font-bold uppercase tracking-wide mt-0.5 whitespace-nowrap" style={{ color: mon.fainted ? '#666' : accent }}>{mon.name}</div>
    </motion.div>
  );
}

function Arena({ frame, obstacles, tickSeconds }: { frame: ArenaFrame; obstacles: ArenaObstacle[]; tickSeconds: number }) {
  return (
    <div className="relative w-full h-[340px] sm:h-[400px] rounded-xl overflow-hidden border border-white/10"
      style={{ background: 'linear-gradient(90deg, rgba(0,200,255,0.10) 0%, rgba(10,11,15,0.4) 48%, rgba(10,11,15,0.4) 52%, rgba(248,113,113,0.10) 100%)' }}>
      <div className="absolute inset-y-0 left-1/2 w-px bg-white/5" />
      {obstacles.map((o, i) => (
        <div key={i} className="absolute rounded-sm" style={{
          left: `${o.x1}%`, top: `${o.y1}%`, width: `${o.x2 - o.x1}%`, height: `${o.y2 - o.y1}%`,
          background: 'repeating-linear-gradient(135deg, #3a3f4d, #3a3f4d 4px, #2a2e38 4px, #2a2e38 8px)',
          border: '1px solid rgba(255,255,255,0.12)', boxShadow: 'inset 0 0 8px rgba(0,0,0,0.5)',
        }} />
      ))}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <AnimatePresence>
          {frame.attacks.map(a => (
            <motion.line key={`${frame.tick}-${a.attackerId}-${a.defenderId}`} x1={a.fromX} y1={a.fromY} x2={a.toX} y2={a.toY}
              initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.45 }}
              stroke={typeColor(a.moveType)} strokeWidth={0.8} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
        </AnimatePresence>
      </svg>
      <AnimatePresence>
        {frame.attacks.map(a => (
          <motion.div key={`burst-${frame.tick}-${a.attackerId}-${a.defenderId}`}
            className="absolute w-4 h-4 rounded-full pointer-events-none" style={{ left: `${a.toX}%`, top: `${a.toY}%`, transform: 'translate(-50%,-50%)', background: typeColor(a.moveType) }}
            initial={{ opacity: 0.9, scale: 0.3 }} animate={{ opacity: 0, scale: 1.8 }} transition={{ duration: 0.45 }} />
        ))}
      </AnimatePresence>
      {frame.pokemon.map(mon => <PokemonIcon key={mon.id} mon={mon} tickSeconds={tickSeconds} />)}
    </div>
  );
}

export function BattleReplay({ matches, tierLabel, status, reward, rating, onClose }: { matches: BrawlMatchResult[]; tierLabel: string; status: 'won' | 'eliminated'; reward: number; rating: RatingChangeResult; onClose: () => void }) {
  const [matchIndex, setMatchIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const [speed, setSpeed] = useState<typeof SPEED_OPTIONS[number]>(1);

  const match = matches[matchIndex];
  const frames = match.frames;
  const currentFrame = frames[frameIndex];
  const atMatchEnd = frameIndex >= frames.length - 1;
  const tickDelayMs = Math.max(16, BASE_TICK_MS / speed);

  const feed = useMemo(() => frames.slice(0, frameIndex + 1).flatMap(f => f.faints.map(ft => `${ft.name} fainted!`)), [frames, frameIndex]);
  const lastAttack = useMemo(() => {
    for (let i = frameIndex; i >= 0; i--) { const a = frames[i].attacks; if (a.length) return a[a.length - 1]; }
    return null;
  }, [frames, frameIndex]);

  useEffect(() => {
    if (!playing || atMatchEnd) return;
    const t = setTimeout(() => setFrameIndex(i => Math.min(frames.length - 1, i + 1)), tickDelayMs);
    return () => clearTimeout(t);
  }, [playing, atMatchEnd, frames.length, frameIndex, tickDelayMs]);

  const handleSkip = () => setFrameIndex(frames.length - 1);
  const handleNextMatch = () => {
    if (matchIndex < matches.length - 1) { setMatchIndex(i => i + 1); setFrameIndex(0); setPlaying(true); }
    else setFinished(true);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl rounded-2xl border border-white/10 overflow-hidden" style={{ background: '#0d0e14' }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <div className="text-xs font-bold uppercase tracking-widest text-white/60">{tierLabel} — Match {matchIndex + 1}/{matches.length}</div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        {!finished ? (
          <div className="relative p-4">
            <div className="flex items-center justify-center gap-4 mb-2">
              <span className="text-[10px] uppercase tracking-widest text-white/30">KOs</span>
              <span className="text-sm font-bold text-[#00c8ff]">{currentFrame.koUser}</span>
              <span className="text-white/20 text-sm">—</span>
              <span className="text-sm font-bold text-[#f87171]">{currentFrame.koOpponent}</span>
            </div>

            <div className="relative">
              <Arena frame={currentFrame} obstacles={match.obstacles} tickSeconds={tickDelayMs / 1000} />

              {/* kill feed, top-right */}
              <div className="absolute top-3 right-3 flex flex-col gap-1 items-end max-w-[45%]">
                <AnimatePresence>
                  {feed.slice(-4).map((f, i) => (
                    <motion.div key={f + i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-black/60 text-white/70">
                      <Skull size={10} className="text-red-400" /> {f}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* move info box, bottom-right */}
              <div className="absolute bottom-3 right-3 max-w-[70%] sm:max-w-[260px] rounded-lg border border-white/10 bg-black/70 px-3 py-2">
                {lastAttack ? (
                  <>
                    <div className="text-[11px] text-white">used <span className="font-bold">{lastAttack.move}</span></div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold" style={{ background: `${typeColor(lastAttack.moveType)}30`, color: typeColor(lastAttack.moveType) }}>{lastAttack.moveType}</span>
                      <span className="text-[10px] text-white/50">{lastAttack.damage} dmg</span>
                      {EFFECTIVENESS_LABEL[lastAttack.effectiveness] && <span className="text-[10px] font-bold" style={{ color: EFFECTIVENESS_COLOR[lastAttack.effectiveness] }}>{EFFECTIVENESS_LABEL[lastAttack.effectiveness]}</span>}
                    </div>
                  </>
                ) : <div className="text-[11px] text-white/30">Battle starting…</div>}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button onClick={() => setPlaying(p => !p)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
                  {playing ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <div className="flex items-center bg-white/10 rounded-full p-0.5">
                  {SPEED_OPTIONS.map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      className={`px-2 h-7 rounded-full text-[10px] font-bold ${speed === s ? 'bg-[#00c8ff] text-black' : 'text-white/50 hover:text-white'}`}>
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
              {!atMatchEnd ? (
                <button onClick={handleSkip} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0"><FastForward size={13} /></button>
              ) : (
                <button onClick={handleNextMatch} className="px-3 h-8 rounded-full bg-[#00c8ff] text-black text-[11px] font-bold uppercase shrink-0">
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
              <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 border border-white/15 text-white/80 font-bold text-sm">
                {rating.newRating >= rating.previousRating ? <ArrowUp size={14} className="text-green-400" /> : <ArrowDown size={14} className="text-red-400" />}
                {rating.newRating - rating.previousRating >= 0 ? '+' : ''}{rating.newRating - rating.previousRating} rating
              </div>
            </div>
            <div><button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-black font-bold text-sm uppercase tracking-wider">Continue</button></div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
