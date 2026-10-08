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

  // First 3 of opponentSpeciesIds = game 1 picks, revealed when locking in
  const game1Opponents = opponentSpeciesIds.slice(0, 3)
    .map(id => opponentTeam.find(m => m.speciesId === id))
    .filter(Boolean) as TeamPreviewMon[];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-3"
      style={{ background: 'rgba(10,11,18,0.97)' }}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="w-full max-w-4xl rounded-2xl border border-white/10 flex flex-col"
        style={{ background: '#0d0e14', maxHeight: 'calc(100dvh - 24px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-xs uppercase tracking-widest text-white/80">3v3 Draft</span>
            <span className="text-[9px] text-white/30 tracking-wider">— Team Preview</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-white/30 uppercase tracking-widest hidden sm:block">Pick 3 to send first</span>
            <motion.span
              key={secondsLeft}
              initial={{ scale: 1.3 }} animate={{ scale: 1 }}
              className="text-sm font-mono font-bold tabular-nums"
              style={{ color: timerColor }}
            >{secondsLeft}s</motion.span>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-0.5"><X size={15} /></button>
          </div>
        </div>

        {/* Timer bar */}
        <div className="relative h-0.5 shrink-0" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <motion.div
            className="absolute left-0 top-0 h-full"
            style={{ background: timerColor }}
            animate={{ width: `${timerPct}%` }}
            transition={{ duration: 0.9, ease: 'linear' }}
          />
        </div>

        {/* Main VS layout — same flex structure as BattleReplay VS intro */}
        <div className="relative flex-1 overflow-hidden flex items-center gap-2 sm:gap-4 px-2 sm:px-3"
          style={{ background: 'radial-gradient(130% 110% at 50% 50%, rgba(104,144,240,0.12) 0%, rgba(13,14,20,0.98) 65%)', minHeight: 260 }}>

          {/* Subtle center divider */}
          <div className="absolute inset-y-6 left-1/2 w-px pointer-events-none" style={{ background: 'rgba(255,255,255,0.06)' }} />

          {/* ── USER PORTRAIT GRID (2-col, same as VS intro) — clickable ── */}
          <div className="grid grid-cols-2 gap-x-1.5 gap-y-2 flex-1 justify-items-center content-center py-3">
            {userTeam.map(mon => {
              const pickOrder = picked.indexOf(mon.speciesId);
              const isPicked = pickOrder >= 0;
              return (
                <motion.div
                  key={mon.speciesId}
                  whileHover={!revealing ? { scale: 1.08 } : undefined}
                  whileTap={!revealing ? { scale: 0.92 } : undefined}
                  onClick={() => toggle(mon.speciesId)}
                  className="relative flex flex-col items-center gap-0.5 cursor-pointer select-none"
                >
                  <div className="relative w-9 h-9 rounded-md flex items-center justify-center"
                    style={{
                      border: `2px solid ${isPicked ? '#00c8ff' : 'rgba(0,200,255,0.3)'}`,
                      background: isPicked ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.04)',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}>
                    {mon.artworkUrl
                      ? <img src={mon.artworkUrl} alt={mon.name} className="w-7 h-7 object-contain" style={{ imageRendering: 'pixelated', objectPosition: 'top' }} />
                      : <div className="w-6 h-6 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />}
                    {isPicked && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center font-black"
                        style={{ background: '#00c8ff', color: '#000', fontSize: 7 }}>
                        {pickOrder + 1}
                      </motion.div>
                    )}
                  </div>
                  <span className="text-[7px] font-bold text-[#00c8ff] uppercase tracking-tight leading-none truncate max-w-[40px] text-center">{mon.name}</span>
                </motion.div>
              );
            })}
          </div>

          {/* ── PICK SLOTS (3) — fills as user picks, positioned near VS ── */}
          <div className="flex flex-col gap-2 shrink-0">
            {[0, 1, 2].map(i => {
              const pickedId = picked[i];
              const mon = pickedId ? userTeam.find(m => m.speciesId === pickedId) : undefined;
              return (
                <div key={i} className="w-10 h-10 rounded-md flex items-center justify-center"
                  style={{
                    border: `2px ${mon ? 'solid' : 'dashed'} ${mon ? '#00c8ff' : 'rgba(0,200,255,0.22)'}`,
                    background: mon ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.02)',
                  }}>
                  <AnimatePresence mode="wait">
                    {mon ? (
                      <motion.div key={mon.speciesId} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 22 }}>
                        {mon.artworkUrl
                          ? <img src={mon.artworkUrl} alt={mon.name} className="w-8 h-8 object-contain" style={{ imageRendering: 'pixelated' }} />
                          : <div className="w-7 h-7 rounded" style={{ background: 'rgba(0,200,255,0.2)' }} />}
                      </motion.div>
                    ) : (
                      <motion.span key="empty" className="font-black" style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)' }}>{i + 1}</motion.span>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* ── VS ── */}
          <motion.div
            className="font-display text-3xl sm:text-4xl text-white shrink-0"
            style={{ textShadow: '0 0 24px rgba(255,255,255,0.55)' }}
            initial={{ scale: 0 }} animate={{ scale: [0, 1.35, 1] }} transition={{ delay: 0.15, duration: 0.4 }}
          >VS</motion.div>

          {/* ── MYSTERY SQUARES (3) — face-down, flip to reveal on lock-in ── */}
          <div className="flex flex-col gap-2 shrink-0">
            {[0, 1, 2].map(i => {
              const revealMon = game1Opponents[i];
              return (
                <div key={i} className="w-10 h-10 shrink-0" style={{ perspective: 240 }}>
                  <motion.div
                    animate={{ rotateY: revealing ? 180 : 0 }}
                    transition={{ duration: 0.42, delay: revealing ? i * 0.16 : 0, ease: 'easeInOut' }}
                    style={{ transformStyle: 'preserve-3d', width: '100%', height: '100%', position: 'relative' }}
                  >
                    {/* Front: mystery ? */}
                    <div className="absolute inset-0 rounded-md flex items-center justify-center"
                      style={{ border: '2px dashed rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.04)', backfaceVisibility: 'hidden' }}>
                      <span className="font-black" style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>?</span>
                    </div>
                    {/* Back: revealed Pokemon */}
                    <div className="absolute inset-0 rounded-md flex items-center justify-center"
                      style={{ border: '2px solid rgba(248,113,113,0.65)', background: 'rgba(248,113,113,0.1)', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                      {revealMon?.artworkUrl
                        ? <img src={revealMon.artworkUrl} alt={revealMon.name} className="w-8 h-8 object-contain" style={{ imageRendering: 'pixelated' }} />
                        : <div className="w-7 h-7 rounded" style={{ background: 'rgba(248,113,113,0.15)' }} />}
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>

          {/* ── OPPONENT PORTRAIT GRID (2-col, same as VS intro) — display only ── */}
          <div className="grid grid-cols-2 gap-x-1.5 gap-y-2 flex-1 justify-items-center content-center py-3">
            {opponentTeam.map(mon => (
              <div key={mon.speciesId} className="flex flex-col items-center gap-0.5">
                <div className="w-9 h-9 rounded-md flex items-center justify-center"
                  style={{ border: '2px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.06)' }}>
                  {mon.artworkUrl
                    ? <img src={mon.artworkUrl} alt={mon.name} className="w-7 h-7 object-contain" style={{ imageRendering: 'pixelated', objectPosition: 'top' }} />
                    : <div className="w-6 h-6 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />}
                </div>
                <span className="text-[7px] font-bold text-[#f87171] uppercase tracking-tight leading-none truncate max-w-[40px] text-center">{mon.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-white/5 shrink-0">
          <p className="flex-1 text-[11px] text-white/40">
            {revealing ? 'Revealing picks…' : picked.length === 0 ? 'Tap your Pokemon to pick them' : `${picked.length}/3 selected`}
          </p>
          <motion.button
            whileHover={!revealing && picked.length > 0 ? { scale: 1.04 } : undefined}
            whileTap={!revealing && picked.length > 0 ? { scale: 0.96 } : undefined}
            onClick={() => startReveal(pickedRef.current)}
            disabled={picked.length === 0 || revealing}
            className="flex items-center gap-1.5 px-5 h-9 rounded-lg text-xs font-bold uppercase tracking-wider shrink-0"
            style={picked.length === 0 || revealing
              ? { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }
              : { background: 'linear-gradient(90deg, #00c8ff, #9b5cff)', color: '#000' }}
          >
            <Check size={13} /> Lock In
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
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
