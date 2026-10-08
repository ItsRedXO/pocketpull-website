import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Clock, Coins, Trophy, Swords, X, Check, Zap, Users } from 'lucide-react';
import {
  getBrawlConfig, getBrawlProfile, playBrawlBattle, setup3v3Battle, play3v3Battle,
  type BrawlBattlePlayResult, type BrawlProfile, type TeamPreviewMon,
} from '../../lib/brawlApi';
import { BattleReplay } from './BattleReplay';

const TIER_COLORS = ['#8892a4', '#6890f0', '#9b5cff', '#f97316', '#facc15'];

const WIN_COUNTER_FIELD: Partial<Record<string, keyof BrawlProfile>> = {
  local_tournament: 'local_tournament_wins',
  state_tournament: 'state_tournament_wins',
  regional_tournament: 'regional_tournament_wins',
  elite_four: 'elite_four_wins',
};

function useCooldownLabel(cooldownEndsAt: string | null) {
  const [, setTick] = useState(0);
  React.useEffect(() => { if (!cooldownEndsAt) return; const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t); }, [cooldownEndsAt]);
  if (!cooldownEndsAt) return null;
  const remainingMs = new Date(cooldownEndsAt).getTime() - Date.now();
  if (remainingMs <= 0) return null;
  const mins = Math.floor(remainingMs / 60000), secs = Math.floor((remainingMs % 60000) / 1000);
  return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m ${secs}s`;
}

function TierRow({ index, color, config, status, wins, onPlay, playing }: { index: number; color: string; config: any; status: { unlocked: boolean; cooldownEndsAt: string | null } | undefined; wins: number | null; onPlay: () => void; playing: boolean }) {
  const cooldownLabel = useCooldownLabel(status?.cooldownEndsAt || null);
  const locked = !status?.unlocked;
  const onCooldown = !!cooldownLabel;
  const disabled = locked || onCooldown || playing;

  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} className="relative flex gap-4">
      <div className="relative z-10 shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-display text-base font-black"
        style={{
          background: locked ? `${color}22` : color,
          border: `2px solid ${locked ? `${color}80` : color}`,
          color: locked ? color : '#fff',
          boxShadow: locked ? 'none' : `0 0 14px ${color}90`,
        }}>
        {locked ? <Lock size={15} /> : index}
      </div>

      <motion.div whileHover={!locked ? { y: -2 } : undefined}
        className="flex-1 rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5"
        style={{ borderColor: locked ? 'rgba(255,255,255,0.06)' : `${color}35`, background: locked ? 'rgba(255,255,255,0.015)' : `linear-gradient(120deg, ${color}12 0%, rgba(255,255,255,0.02) 70%)`, opacity: locked ? 0.65 : 1 }}>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-sm uppercase tracking-wider text-white">
            {config.label}
            {!!wins && <span className="ml-2 normal-case tracking-normal font-sans text-[11px] font-normal text-[#facc15]">Wins: {wins}</span>}
          </h3>
          <p className="text-[11px] text-white/40 mt-1">{config.description}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/50 mt-1">
            <span>{config.matches} match{config.matches > 1 ? 'es' : ''}</span>
            <span>Entry: {config.entryCost > 0 ? `${config.entryCost} pokedollars` : 'Free'}</span>
            {config.cooldownMs > 0 && <span>Cooldown: {config.cooldownMs >= 3600000 ? `${config.cooldownMs / 3600000}h` : `${config.cooldownMs / 60000}m`}</span>}
            {config.strategyLevel > 0 && <span>Scouted team comps</span>}
          </div>
          {locked && config.unlockAfter ? (
            <p className="text-[10px] text-white/30 mt-1">Unlocks after {config.unlockAfter.count} {config.unlockAfter.counter.replace(/_/g, ' ')}</p>
          ) : (
            <div className="flex items-center gap-1.5 text-[#facc15] text-xs font-bold mt-1.5">
              <Coins size={13} />
              Prize: {config.totalReward ?? config.winReward} pokedollars
            </div>
          )}
        </div>
        <motion.button onClick={onPlay} disabled={disabled} whileHover={!disabled ? { scale: 1.04 } : undefined} whileTap={!disabled ? { scale: 0.96 } : undefined}
          className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
          style={disabled ? { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' } : { background: `linear-gradient(90deg, ${color}, #00c8ff)`, color: '#000' }}>
          {onCooldown ? <><Clock size={13} /> {cooldownLabel}</> : <><Swords size={13} /> Battle</>}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── Mode Select Modal ─────────────────────────────────────────────────────

function ModeSelectModal({ tierId, tierColor, onSelect, onClose }: {
  tierId: string; tierColor: string; onSelect: (mode: '6v6' | '3v3') => void; onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 p-6"
        style={{ background: '#0d0e14' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-base uppercase tracking-widest text-white">Select Battle Mode</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <motion.button
            whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={() => onSelect('6v6')}
            className="w-full rounded-xl border p-4 text-left flex items-start gap-3 transition-colors"
            style={{ borderColor: `${tierColor}40`, background: `${tierColor}12` }}
          >
            <div className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tierColor}25` }}>
              <Users size={16} style={{ color: tierColor }} />
            </div>
            <div>
              <p className="font-display text-sm text-white uppercase tracking-wide">Standard 6v6</p>
              <p className="text-[11px] text-white/40 mt-0.5">Full team battle. All 6 Pokemon fight together.</p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={() => onSelect('3v3')}
            className="w-full rounded-xl border p-4 text-left flex items-start gap-3 transition-colors"
            style={{ borderColor: 'rgba(250,204,21,0.35)', background: 'rgba(250,204,21,0.07)' }}
          >
            <div className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(250,204,21,0.15)' }}>
              <Zap size={16} className="text-[#facc15]" />
            </div>
            <div>
              <p className="font-display text-sm text-white uppercase tracking-wide">3v3 Draft <span className="text-[#facc15] text-[10px] ml-1 normal-case tracking-normal font-sans">NEW</span></p>
              <p className="text-[11px] text-white/40 mt-0.5">Standard 3v3 draft format.</p>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Team Pick Phase ───────────────────────────────────────────────────────

const PICK_TIME = 15;

function TeamPickPhase({ userTeam, opponentTeam, opponentSpeciesIds, onConfirm, onClose }: {
  userTeam: TeamPreviewMon[]; opponentTeam: TeamPreviewMon[]; opponentSpeciesIds: number[];
  tierId: string; onConfirm: (pickedIds: number[], opponentIds: number[]) => void; onClose: () => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(PICK_TIME);
  const [revealing, setRevealing] = useState(false);
  const confirmedRef = useRef(false);
  const pickedRef = useRef<number[]>([]);
  useEffect(() => { pickedRef.current = picked; }, [picked]);

  const startReveal = (ids: number[]) => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    const remaining = userTeam.map(m => m.speciesId).filter(id => !ids.includes(id));
    const needed = 3 - ids.length;
    const finalPick = [...ids, ...remaining.slice(0, needed)];
    setRevealing(true);
    setTimeout(() => onConfirm(finalPick, opponentSpeciesIds), 1800);
  };

  useEffect(() => {
    if (revealing) return;
    if (secondsLeft <= 0) { startReveal(pickedRef.current); return; }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, revealing]);

  const toggle = (id: number) => {
    if (revealing) return;
    setPicked(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const timerPct = (secondsLeft / PICK_TIME) * 100;
  const timerColor = secondsLeft > 8 ? '#00c8ff' : secondsLeft > 4 ? '#facc15' : '#f87171';

  // First 3 of opponentSpeciesIds = game 1 picks, revealed on lock-in
  const game1Opponents = opponentSpeciesIds.slice(0, 3)
    .map(id => opponentTeam.find(m => m.speciesId === id))
    .filter(Boolean) as TeamPreviewMon[];

  // Y positions for 6-mon columns — keep bottom away from the timer bar
  const colY = (i: number, n: number) => 10 + i * (75 / Math.max(n - 1, 1));
  // Y positions for 3 center slots (spread evenly)
  const slotY = (i: number) => 15 + i * 35;

  const PokCircle = ({ mon, accent, scale = 1.5, mirrored = false, faded = false }: {
    mon: TeamPreviewMon; accent: string; scale?: number; mirrored?: boolean; faded?: boolean;
  }) => (
    <div className="flex flex-col items-center gap-0.5" style={{ opacity: faded ? 0.4 : 1, transition: 'opacity 0.2s' }}>
      <div className="relative w-11 h-11 rounded-full overflow-hidden flex items-center justify-center"
        style={{ background: '#0009', border: `2px solid ${accent}`, boxShadow: `0 0 10px ${accent}60` }}>
        {mon.artworkUrl
          ? <img src={mon.artworkUrl} alt={mon.name} className="w-full h-full object-contain"
              style={{ objectPosition: 'top', transform: `scaleX(${mirrored ? -scale : scale}) scaleY(${scale})` }} />
          : <div className="w-7 h-7 rounded-full" style={{ background: `${accent}30` }} />}
      </div>
      <div className="text-[8px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: accent }}>{mon.name}</div>
    </div>
  );

  return (
    // ── Same outer structure as BattleReplay ──
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl rounded-2xl border border-white/10 flex flex-col"
        style={{ background: '#0d0e14', maxHeight: 'calc(100dvh - 24px)' }}
      >
        {/* Header — identical to BattleReplay */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 shrink-0">
          <div className="text-xs font-bold uppercase tracking-widest text-white/60">3v3 Draft — Trainer 1/1</div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={16} /></button>
        </div>

        {/* Content — same padding/overflow as BattleReplay */}
        <div className="relative p-4 overflow-y-auto">

          {/* Round info row — same as BattleReplay */}
          <div className="flex items-center justify-center gap-3 mb-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-white/30">Game 1/3</span>
            <span className="text-sm font-bold tabular-nums">
              <span className="text-[#00c8ff]">0</span>
              <span className="text-white/25 mx-0.5">–</span>
              <span className="text-[#f87171]">0</span>
            </span>
            <span className="text-[9px] uppercase tracking-widest text-white/30">first to 2 wins</span>
          </div>

          {/* KO/timer row — same layout as KO counter row in BattleReplay */}
          <div className="flex items-center justify-center gap-4 mb-2">
            <span className="text-[10px] uppercase tracking-widest text-white/30">Picks</span>
            <AnimatePresence mode="wait">
              <motion.span key={picked.length} className="text-sm font-bold text-[#00c8ff]"
                initial={{ scale: 1.6, opacity: 0.7 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.2 }}>
                {picked.length}
              </motion.span>
            </AnimatePresence>
            <span className="text-white/20 text-sm">/</span>
            <span className="text-sm font-bold text-white/40">3</span>
            <span className="text-white/15 text-sm mx-1">|</span>
            <motion.span
              key={secondsLeft}
              initial={{ scale: 1.3 }} animate={{ scale: 1 }}
              className="text-sm font-bold tabular-nums"
              style={{ color: timerColor }}
            >{secondsLeft}s</motion.span>
          </div>

          {/* ── Arena div — identical size/style to BattleReplay Arena ── */}
          <div className="relative w-full h-[340px] sm:h-[400px] rounded-xl overflow-hidden border"
            style={{
              background: 'radial-gradient(130% 110% at 50% 0%, rgba(150,90,220,0.18) 0%, rgba(20,11,32,0.94) 55%, rgba(8,4,16,0.98) 100%)',
              borderColor: 'rgba(165,106,255,0.3)',
              boxShadow: 'inset 0 0 60px rgba(165,106,255,0.12)',
            }}>

            {/* Center divider — same as Arena */}
            <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: 'rgba(165,106,255,0.2)' }} />

            {/* ── USER PORTRAIT COLUMN (x=12%, same as PokemonIcon user side) — clickable ── */}
            {userTeam.map((mon, i) => {
              const pickOrder = picked.indexOf(mon.speciesId);
              const isPicked = pickOrder >= 0;
              const y = colY(i, userTeam.length);
              return (
                <div
                  key={mon.speciesId}
                  className="absolute"
                  style={{ left: '12%', top: `${y}%`, transform: 'translate(-50%, -50%)', zIndex: Math.round(y * 10) }}
                >
                <motion.div
                  className="cursor-pointer select-none"
                  whileHover={!revealing ? { scale: 1.08 } : undefined}
                  whileTap={!revealing ? { scale: 0.92 } : undefined}
                  onClick={() => toggle(mon.speciesId)}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="relative w-11 h-11 rounded-full overflow-hidden flex items-center justify-center"
                      style={{
                        background: '#0009',
                        border: `2px solid ${isPicked ? '#facc15' : '#00c8ff'}`,
                        boxShadow: `0 0 10px ${isPicked ? '#facc1560' : '#00c8ff60'}`,
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}>
                      {mon.artworkUrl
                        ? <img src={mon.artworkUrl} alt={mon.name} className="w-full h-full object-contain"
                            style={{ objectPosition: 'top', transform: 'scaleX(1.5) scaleY(1.5)' }} />
                        : <div className="w-7 h-7 rounded-full" style={{ background: 'rgba(0,200,255,0.2)' }} />}
                      {isPicked && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center font-black"
                          style={{ background: '#facc15', color: '#000', fontSize: 8, zIndex: 10 }}>
                          {pickOrder + 1}
                        </motion.div>
                      )}
                    </div>
                    <div className="text-[8px] font-bold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: isPicked ? '#facc15' : '#00c8ff', transition: 'color 0.15s' }}>
                      {mon.name}
                    </div>
                  </div>
                </motion.div>
                </div>
              );
            })}

            {/* ── PICK SLOTS (x=35%) — fill as user picks, like battle sprites ── */}
            {[0, 1, 2].map(i => {
              const pickedId = picked[i];
              const mon = pickedId ? userTeam.find(m => m.speciesId === pickedId) : undefined;
              const y = slotY(i);
              return (
                <div key={i} className="absolute" style={{ left: '35%', top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
                  <AnimatePresence mode="wait">
                    {mon ? (
                      <motion.div key={mon.speciesId} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 22 }}>
                        <PokCircle mon={mon} accent="#00c8ff" />
                      </motion.div>
                    ) : (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-11 h-11 rounded-full flex items-center justify-center"
                            style={{ border: '2px dashed rgba(0,200,255,0.25)', background: 'rgba(0,200,255,0.04)' }}>
                            <span className="font-black" style={{ fontSize: 14, color: 'rgba(0,200,255,0.2)' }}>{i + 1}</span>
                          </div>
                          <div className="text-[8px] text-white/15 uppercase tracking-wide">empty</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* ── VS — dead center ── */}
            <motion.div
              className="absolute font-display text-5xl text-white"
              style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', textShadow: '0 0 30px rgba(255,255,255,0.7)', zIndex: 20 }}
              initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }} transition={{ delay: 0.2, duration: 0.45 }}
            >VS</motion.div>

            {/* ── MYSTERY CIRCLES (x=65%) — flip to reveal opponent's game1 picks ── */}
            {[0, 1, 2].map(i => {
              const revealMon = game1Opponents[i];
              const y = slotY(i);
              return (
                <div key={i} className="absolute" style={{ left: '65%', top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
                  <div style={{ perspective: 300 }}>
                    <motion.div
                      animate={{ rotateY: revealing ? 180 : 0 }}
                      transition={{ duration: 0.42, delay: revealing ? i * 0.16 : 0, ease: 'easeInOut' }}
                      style={{ transformStyle: 'preserve-3d', position: 'relative', width: 44, height: 44 + 20 }}
                    >
                      {/* Front: mystery ? */}
                      <div className="absolute inset-0 flex flex-col items-center gap-0.5"
                        style={{ backfaceVisibility: 'hidden' }}>
                        <div className="w-11 h-11 rounded-full flex items-center justify-center"
                          style={{ border: '2px dashed rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.04)' }}>
                          <span className="font-black" style={{ fontSize: 16, color: 'rgba(248,113,113,0.4)' }}>?</span>
                        </div>
                        <div className="text-[8px] text-white/15 uppercase tracking-wide">hidden</div>
                      </div>
                      {/* Back: revealed Pokemon */}
                      <div className="absolute inset-0 flex flex-col items-center gap-0.5"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                        {revealMon ? (
                          <PokCircle mon={revealMon} accent="#f87171" mirrored />
                        ) : (
                          <div className="w-11 h-11 rounded-full" style={{ background: 'rgba(248,113,113,0.1)', border: '2px solid rgba(248,113,113,0.4)' }} />
                        )}
                      </div>
                    </motion.div>
                  </div>
                </div>
              );
            })}

            {/* ── OPPONENT PORTRAIT COLUMN (x=88%, same as PokemonIcon opponent side) ── */}
            {opponentTeam.map((mon, i) => {
              const y = colY(i, opponentTeam.length);
              return (
                <div key={mon.speciesId} className="absolute"
                  style={{ left: '88%', top: `${y}%`, transform: 'translate(-50%, -50%)', zIndex: Math.round(y * 10) }}>
                  <PokCircle mon={mon} accent="#f87171" mirrored />
                </div>
              );
            })}

            {/* Timer bar inside arena at bottom */}
            <div className="absolute bottom-2 left-3 right-3 h-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <motion.div className="h-full rounded-full" style={{ background: timerColor }}
                animate={{ width: `${timerPct}%` }} transition={{ duration: 0.9, ease: 'linear' }} />
            </div>
          </div>

          {/* Footer controls — same position as BattleReplay speed controls row */}
          <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
            <p className="text-[11px] text-white/40">
              {revealing ? 'Revealing picks…' : picked.length === 0 ? 'Tap your team to pick' : `${picked.length}/3 selected`}
            </p>
            <motion.button
              whileHover={!revealing && picked.length > 0 ? { scale: 1.04 } : undefined}
              whileTap={!revealing && picked.length > 0 ? { scale: 0.96 } : undefined}
              onClick={() => startReveal(pickedRef.current)}
              disabled={picked.length === 0 || revealing}
              className="flex items-center gap-1.5 px-4 h-10 min-w-[110px] rounded-full text-[12px] font-bold uppercase tracking-wider"
              style={picked.length === 0 || revealing
                ? { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }
                : { background: 'linear-gradient(90deg, #00c8ff, #9b5cff)', color: '#000' }}
            >
              <Check size={13} /> Lock In
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main PlayTab ──────────────────────────────────────────────────────────

export function PlayTab() {
  const qc = useQueryClient();
  const { data: config } = useQuery({ queryKey: ['brawl-config'], queryFn: getBrawlConfig, staleTime: 60_000 });
  const { data: profile } = useQuery({ queryKey: ['brawl-profile'], queryFn: getBrawlProfile });
  const [playingTier, setPlayingTier] = useState<string | null>(null);
  const [result, setResult] = useState<BrawlBattlePlayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mode select state
  const [modeSelectTier, setModeSelectTier] = useState<string | null>(null);
  // Team pick state
  type PickSetup = { tierId: string; userTeam: TeamPreviewMon[]; opponentTeam: TeamPreviewMon[]; opponentSpeciesIds: number[] };
  const [pickSetup, setPickSetup] = useState<PickSetup | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);

  const handleBattleClick = (tierId: string) => {
    setError(null);
    setModeSelectTier(tierId);
  };

  const handleModeSelect = async (mode: '6v6' | '3v3') => {
    const tierId = modeSelectTier!;
    setModeSelectTier(null);
    if (mode === '6v6') {
      await run6v6(tierId);
    } else {
      setLoadingSetup(true);
      setPlayingTier(tierId);
      try {
        const setup = await setup3v3Battle(tierId);
        setPickSetup({ tierId, ...setup });
      } catch (e: any) {
        setError(e.message || 'Failed to load team preview');
        setPlayingTier(null);
      } finally {
        setLoadingSetup(false);
      }
    }
  };

  const run6v6 = async (tierId: string) => {
    setPlayingTier(tierId);
    try {
      const res = await playBrawlBattle(tierId);
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Battle failed to start');
      setPlayingTier(null);
    }
  };

  const handleTeamPick = async (pickedIds: number[], opponentIds: number[]) => {
    const tierId = pickSetup!.tierId;
    setPickSetup(null);
    // playingTier is already set
    try {
      const res = await play3v3Battle(tierId, pickedIds, opponentIds);
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Battle failed to start');
      setPlayingTier(null);
    }
  };

  const handleCloseReplay = () => {
    setResult(null);
    setPlayingTier(null);
    qc.invalidateQueries({ queryKey: ['brawl-profile'] });
    qc.invalidateQueries({ queryKey: ['brawl-challenges'] });
  };

  if (!config || !profile) return <div className="text-white/40 text-sm py-16 text-center">Loading tiers…</div>;

  const order = ['local_battle', 'local_tournament', 'state_tournament', 'regional_tournament', 'elite_four'];
  const modeSelectColor = modeSelectTier ? TIER_COLORS[order.indexOf(modeSelectTier)] : '#6890f0';

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Trophy size={16} className="text-[#9b5cff]" /><h3 className="font-display text-sm uppercase tracking-widest text-white/70">Battle Tiers</h3>
      </div>
      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
      {loadingSetup && <p className="text-white/40 text-xs mb-3">Loading team preview…</p>}
      <div className="relative">
        <div className="absolute left-5 top-5 bottom-5 w-px" style={{ background: 'linear-gradient(180deg, rgba(136,146,164,0.3), rgba(250,204,21,0.3))' }} />
        <div className="space-y-3">
          {order.map((id, i) => {
            const winField = WIN_COUNTER_FIELD[id];
            const wins = winField ? Number(profile.profile[winField] || 0) : null;
            return (
              <TierRow key={id} index={i + 1} color={TIER_COLORS[i]} config={config.battleTiers[id]} status={profile.tierStatus[id]} wins={wins} playing={playingTier === id} onPlay={() => handleBattleClick(id)} />
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {modeSelectTier && (
          <ModeSelectModal
            tierId={modeSelectTier}
            tierColor={modeSelectColor}
            onSelect={handleModeSelect}
            onClose={() => setModeSelectTier(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pickSetup && (
          <TeamPickPhase
            userTeam={pickSetup.userTeam}
            opponentTeam={pickSetup.opponentTeam}
            opponentSpeciesIds={pickSetup.opponentSpeciesIds}
            tierId={pickSetup.tierId}
            onConfirm={handleTeamPick}
            onClose={() => { setPickSetup(null); setPlayingTier(null); }}
          />
        )}
      </AnimatePresence>

      {result && (
        <BattleReplay matches={result.matches} tierLabel={config.battleTiers[result.tier]?.label || result.tier} status={result.status} reward={result.reward} onClose={handleCloseReplay} />
      )}
    </div>
  );
}
