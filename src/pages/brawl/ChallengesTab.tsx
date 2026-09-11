import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Swords, Trophy, Sparkles, Trees, Coins, Clock, CheckCircle2, Gift, X } from 'lucide-react';
import { getBrawlChallenges, selectBrawlChallenge, claimBrawlChallenge, type ChallengeInstance, type ChallengeReward, type ChallengeType, type ChallengeClaimResult } from '../../lib/brawlApi';
import { typeColor } from './typeColors';
import { PokemonPortrait } from './PokemonPortrait';

const TYPE_ICON: Record<ChallengeType, React.FC<{ size?: number; className?: string }>> = {
  win_matches: Swords,
  win_tournament: Trophy,
  evolve_pokemon: Sparkles,
  open_safari: Trees,
  win_mono_type: Swords,
};

function challengeColor(c: ChallengeInstance): string {
  if (c.type === 'win_mono_type' && c.meta?.type) return typeColor(c.meta.type);
  return '#9b5cff';
}

function RewardBadge({ reward }: { reward: ChallengeReward }) {
  if (reward.kind === 'pokedollars') {
    return (
      <div className="flex items-center gap-1.5 text-[#facc15] text-sm font-bold">
        <Coins size={14} /> {reward.amount.toLocaleString()} pokedollars
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-[#00c8ff] text-sm font-bold">
      <Sparkles size={14} /> Guaranteed Pokemon (OVR {reward.overallMin}-{reward.overallMax})
    </div>
  );
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useCountdown(endsAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return 0;
  return Math.max(0, new Date(endsAt).getTime() - now);
}

/** Counts 0 -> target with an ease-out curve, used to make the pokedollar
 * reward feel like it's actually ticking up rather than just appearing. */
function useCountUp(target: number, active: boolean, duration = 1000): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) { setValue(0); return; }
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return value;
}

function ChallengeCard({ challenge, index, onChoose, choosing }: { challenge: ChallengeInstance; index: number; onChoose: () => void; choosing: boolean }) {
  const color = challengeColor(challenge);
  const Icon = TYPE_ICON[challenge.type];
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
      whileHover={{ y: -3 }}
      className="relative rounded-xl border p-4 flex flex-col gap-2 overflow-hidden"
      style={{ borderColor: `${color}45`, background: `linear-gradient(160deg, ${color}14 0%, rgba(255,255,255,0.02) 60%)` }}>
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-30" style={{ background: color }} />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}25`, color }}>
          <Icon size={15} />
        </div>
        <h4 className="font-display text-sm uppercase tracking-wider" style={{ color }}>{challenge.label}</h4>
      </div>
      <p className="text-[11px] text-white/50">{challenge.description}</p>
      <div className="mt-1"><RewardBadge reward={challenge.reward} /></div>
      <motion.button onClick={onChoose} disabled={choosing}
        whileHover={!choosing ? { scale: 1.03 } : undefined} whileTap={!choosing ? { scale: 0.96 } : undefined}
        className="mt-2 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
        style={{ background: `linear-gradient(90deg, ${color}, #00c8ff)`, color: '#000', opacity: choosing ? 0.6 : 1 }}>
        {choosing ? 'Locking In…' : 'Choose This Challenge'}
      </motion.button>
    </motion.div>
  );
}

function ActiveChallengeCard({ challenge, onClaim, claiming }: { challenge: ChallengeInstance & { progress: number }; onClaim: () => void; claiming: boolean }) {
  const color = challengeColor(challenge);
  const Icon = TYPE_ICON[challenge.type];
  const pct = Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
  const ready = challenge.progress >= challenge.target;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className="relative rounded-xl border p-5 flex flex-col gap-3 overflow-hidden max-w-lg mx-auto"
      style={{ borderColor: `${color}45`, background: `linear-gradient(160deg, ${color}16 0%, rgba(255,255,255,0.02) 60%)` }}>
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-30" style={{ background: color }} />
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}25`, color }}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">{ready ? 'Ready to Claim' : 'Locked In'}</span>
          <h4 className="font-display text-sm uppercase tracking-wider -mt-0.5" style={{ color }}>{challenge.label}</h4>
        </div>
      </div>
      <p className="text-[11px] text-white/50">{challenge.description}</p>
      <div>
        <div className="flex items-center justify-between text-[11px] text-white/50 mb-1">
          <span>Progress</span>
          <span className="font-bold text-white/70">{challenge.progress} / {challenge.target}</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }}
            className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${color}, #00c8ff)` }} />
        </div>
      </div>
      <RewardBadge reward={challenge.reward} />
      {ready && (
        <motion.button onClick={onClaim} disabled={claiming}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, scale: claiming ? 1 : [1, 1.03, 1] }}
          transition={{ scale: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } }}
          whileHover={!claiming ? { scale: 1.04 } : undefined} whileTap={!claiming ? { scale: 0.96 } : undefined}
          className="mt-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider"
          style={{ background: `linear-gradient(90deg, #4ade80, #00c8ff)`, color: '#000', opacity: claiming ? 0.7 : 1, boxShadow: '0 0 20px -4px rgba(74,222,128,0.6)' }}>
          <Gift size={14} /> {claiming ? 'Claiming…' : 'Claim Reward'}
        </motion.button>
      )}
    </motion.div>
  );
}

function ClaimCelebration({ result, onClose }: { result: ChallengeClaimResult; onClose: () => void }) {
  const dollarTarget = result.reward.kind === 'pokedollars' ? result.reward.amount : 0;
  const counted = useCountUp(dollarTarget, result.reward.kind === 'pokedollars');
  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="rounded-2xl border border-[#4ade80]/30 p-6 max-w-sm w-full text-center relative overflow-hidden" style={{ background: '#0d0e14' }}>
        <button onClick={onClose} className="absolute top-3 right-3 text-white/40 hover:text-white z-10"><X size={16} /></button>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
          <CheckCircle2 size={26} />
        </motion.div>
        <h3 className="font-display text-lg uppercase tracking-widest text-white mb-1">Challenge Complete!</h3>
        <p className="text-white/40 text-xs mb-4">{result.label}</p>

        {result.reward.kind === 'pokedollars' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="flex items-center justify-center gap-2 text-[#facc15] font-display text-3xl">
            <Coins size={22} /> +{counted.toLocaleString()}
          </motion.div>
        ) : result.pokemon ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="flex flex-col items-center gap-1.5">
            <div className="w-20 h-20 rounded-lg overflow-hidden" style={{ background: '#0d0e14', boxShadow: '0 0 16px rgba(0,200,255,0.35)' }}>
              <PokemonPortrait artworkUrl={result.pokemon.artworkUrl} alt={result.pokemon.name} className="w-full h-full" />
            </div>
            <span className="text-sm font-bold text-white capitalize">{result.pokemon.name}</span>
            <span className="text-[11px] text-[#00c8ff] font-bold">OVR {result.pokemon.overallRating}</span>
          </motion.div>
        ) : null}

        <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          onClick={onClose} className="mt-6 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#4ade80] to-[#00c8ff] text-black font-bold text-sm uppercase tracking-wider">
          Nice!
        </motion.button>
      </motion.div>
    </div>
  );
}

export function ChallengesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['brawl-challenges'], queryFn: getBrawlChallenges, refetchInterval: 15_000 });
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<ChallengeClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remainingMs = useCountdown(data?.cooldownEndsAt || null);

  const handleChoose = async (challengeId: string) => {
    setError(null);
    setChoosingId(challengeId);
    try {
      await selectBrawlChallenge(challengeId);
      qc.invalidateQueries({ queryKey: ['brawl-challenges'] });
    } catch (e: any) {
      setError(e.message || 'Failed to lock in challenge');
    } finally {
      setChoosingId(null);
    }
  };

  const handleClaim = async () => {
    setError(null);
    setClaiming(true);
    try {
      const res = await claimBrawlChallenge();
      setClaimResult(res);
      qc.invalidateQueries({ queryKey: ['brawl-profile'] });
    } catch (e: any) {
      setError(e.message || 'Failed to claim reward');
    } finally {
      setClaiming(false);
    }
  };

  const handleCloseCelebration = () => {
    setClaimResult(null);
    qc.invalidateQueries({ queryKey: ['brawl-challenges'] });
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Target size={16} className="text-[#9b5cff]" />
        <h3 className="font-display text-sm uppercase tracking-widest text-white/70">Challenges</h3>
      </div>
      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

      {isLoading || !data ? (
        <div className="text-white/40 text-sm py-16 text-center">Loading challenges…</div>
      ) : data.status === 'select' ? (
        <>
          <p className="text-white/40 text-xs mb-4">Pick 1 of these 3 challenges. It's locked in until you complete and claim it — losses never set you back.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.offered.map((c, i) => (
              <ChallengeCard key={c.id} challenge={c} index={i} choosing={choosingId === c.id} onChoose={() => handleChoose(c.id)} />
            ))}
          </div>
        </>
      ) : data.status === 'active' && data.active ? (
        <ActiveChallengeCard challenge={data.active} onClaim={handleClaim} claiming={claiming} />
      ) : (
        <div className="max-w-md mx-auto text-center py-10">
          <AnimatePresence>
            {data.lastCompleted && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 justify-center text-[#4ade80] text-xs font-bold mb-5 px-3 py-2 rounded-lg bg-[#4ade80]/10 border border-[#4ade80]/25">
                <CheckCircle2 size={14} />
                Completed "{data.lastCompleted.label}" — earned{' '}
                {data.lastCompleted.reward.kind === 'pokedollars'
                  ? `${data.lastCompleted.reward.amount.toLocaleString()} pokedollars`
                  : data.lastCompleted.pokemon
                    ? `${data.lastCompleted.pokemon.name} (OVR ${data.lastCompleted.pokemon.overallRating})`
                    : 'a new Pokemon'}!
              </motion.div>
            )}
          </AnimatePresence>
          <Clock size={28} className="mx-auto text-white/20 mb-3" />
          <div className="text-white/70 font-display text-2xl tracking-wider">{formatCountdown(remainingMs)}</div>
          <p className="text-white/30 text-xs mt-2 uppercase tracking-widest">New challenges in</p>
        </div>
      )}

      <AnimatePresence>
        {claimResult && <ClaimCelebration result={claimResult} onClose={handleCloseCelebration} />}
      </AnimatePresence>
    </div>
  );
}
