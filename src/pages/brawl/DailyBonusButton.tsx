import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift } from 'lucide-react';
import { claimBrawlDailyBonus, type DailyBonusStatus } from '../../lib/brawlApi';

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Once-per-24h pokedollar bonus, shown as a pill next to Global Rating. Ticks
 * its own countdown client-side so it flips to claimable the moment the
 * cooldown ends without waiting on a refetch; the server is still the real
 * gate (see POST /brawl/daily-bonus/claim), this is just presentation. */
export function DailyBonusButton({ dailyBonus }: { dailyBonus?: DailyBonusStatus }) {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);

  const nextClaimAt = dailyBonus?.nextClaimAt ? new Date(dailyBonus.nextClaimAt).getTime() : null;
  const remainingMs = nextClaimAt ? nextClaimAt - now : 0;
  const claimable = !!dailyBonus && (dailyBonus.claimable || remainingMs <= 0);

  useEffect(() => {
    if (!nextClaimAt || remainingMs <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [nextClaimAt, remainingMs]);

  const mutation = useMutation({
    mutationFn: claimBrawlDailyBonus,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['brawl-profile'] });
      setMessage(`+${res.amount} pokedollars claimed!`);
      setTimeout(() => setMessage(null), 2500);
    },
    onError: (e: any) => {
      qc.invalidateQueries({ queryKey: ['brawl-profile'] });
      setMessage(e.message || 'Daily bonus already claimed');
      setTimeout(() => setMessage(null), 2500);
    },
  });

  if (!dailyBonus) return null;

  return (
    <div className="relative">
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={claimable ? { opacity: 1, scale: [1, 1.045, 1] } : { opacity: 1, scale: 1 }}
        transition={claimable ? { scale: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } } : { duration: 0.2 }}
        disabled={!claimable || mutation.isPending}
        onClick={() => claimable && !mutation.isPending && mutation.mutate()}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
          claimable
            ? 'bg-[#4ade80]/10 border-[#4ade80]/30 text-[#4ade80] hover:bg-[#4ade80]/20 cursor-pointer'
            : 'bg-white/5 border-white/10 text-white/40 cursor-default'
        }`}
        style={claimable ? { boxShadow: '0 0 16px -4px rgba(74,222,128,0.6)' } : undefined}
      >
        <Gift size={13} />
        {mutation.isPending ? 'Claiming…' : claimable ? `Claim +${dailyBonus.amount}` : `Bonus in ${formatCountdown(remainingMs)}`}
      </motion.button>
      <AnimatePresence>
        {message && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute top-full mt-1.5 right-0 whitespace-nowrap px-2.5 py-1 rounded-lg bg-black/85 border border-white/10 text-[11px] text-white z-50">
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
