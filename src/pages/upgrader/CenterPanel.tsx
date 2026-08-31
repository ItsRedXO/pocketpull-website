import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { MULTIPLIERS } from './constants';
import { CircularMeter } from './CircularMeter';

interface UserStats {
  balance: number;
  matchedBalance?: number;
}

interface CenterPanelProps {
  upgrading: boolean;
  spinning: boolean;
  outcome: 'win' | 'lose' | null;
  multiplierIdx: number;
  setMultiplierIdx: (i: number) => void;
  selectedCardTotal: number;
  effectiveAddedBalance: number;
  totalUpgradeValue: number;
  targetValue: number;
  perTargetChance: number;
  selectedTargetsCount: number;
  isAuthenticated: boolean;
  stats: UserStats | null;
  useBalance: boolean;
  setUseBalance: (updater: (v: boolean) => boolean) => void;
  addedBalance: number;
  setAddedBalance: (v: number) => void;
  maxAllowedBalance: number;
  error: string;
  validationMessage: string;
  canUpgrade: boolean;
  handleUpgrade: () => void;
  onSpinComplete: (isWin: boolean) => void;
  forcedOutcome: boolean | null;
}

// Rarity-style glow colors per multiplier tier
const MULTIPLIER_STYLES = [
  { glow: '#4ade80', ring: '#4ade80' },  // 1.2x — green (easy)
  { glow: '#60a5fa', ring: '#60a5fa' },  // 1.5x — blue
  { glow: '#a78bfa', ring: '#a78bfa' },  // 2x — purple
  { glow: '#f59e0b', ring: '#f59e0b' },  // 5x — amber
  { glow: '#f43f5e', ring: '#f43f5e' },  // 10x — red (hard)
];

export function CenterPanel({
  upgrading,
  spinning,
  outcome,
  multiplierIdx,
  setMultiplierIdx,
  selectedCardTotal,
  effectiveAddedBalance,
  totalUpgradeValue,
  targetValue,
  perTargetChance,
  selectedTargetsCount,
  isAuthenticated,
  stats,
  useBalance,
  setUseBalance,
  addedBalance,
  setAddedBalance,
  maxAllowedBalance,
  error,
  validationMessage,
  canUpgrade,
  handleUpgrade,
  onSpinComplete,
  forcedOutcome,
}: CenterPanelProps) {

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-2xl border border-white/5 p-5 flex flex-col items-center gap-0"
        style={{ background: 'rgba(13,14,20,0.95)' }}
      >

        {/* ── Circular Meter ── */}
        <div className="w-full flex justify-center mb-[-25px] relative z-20">
          <CircularMeter
            percent={parseFloat(perTargetChance.toFixed(1))}
            upgrading={upgrading}
            spinning={spinning}
            outcome={outcome}
            onSpinComplete={onSpinComplete}
            forcedOutcome={forcedOutcome}
          />
        </div>

        {/* ── Select Multiplier ── */}
        <div className={`w-full relative z-10 ${upgrading ? 'opacity-40 pointer-events-none' : ''}`}>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest text-center mb-3">
            Select Multiplier
          </p>
          <div className="grid grid-cols-5 gap-2">
            {MULTIPLIERS.map((m, i) => {
              const style = MULTIPLIER_STYLES[i];
              const isActive = multiplierIdx === i;
              return (
                <motion.button
                  key={m.label}
                  onClick={() => setMultiplierIdx(i)}
                  disabled={upgrading}
                  whileHover={!upgrading ? { scale: 1.05 } : {}}
                  whileTap={!upgrading ? { scale: 0.95 } : {}}
                  className="relative flex flex-col items-center justify-center py-3 rounded-xl font-display font-bold text-sm uppercase tracking-wider transition-all duration-200 disabled:cursor-not-allowed overflow-hidden"
                  style={
                    isActive
                      ? {
                          background: `${style.glow}20`,
                          border: `1.5px solid ${style.ring}`,
                          color: style.glow,
                          boxShadow: `0 0 18px -4px ${style.glow}80, inset 0 0 16px -8px ${style.glow}30`,
                        }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          border: '1.5px solid rgba(255,255,255,0.08)',
                          color: '#6b7280',
                        }
                  }
                >
                  {/* Active glow shimmer */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 opacity-20 pointer-events-none"
                      style={{
                        background: `radial-gradient(ellipse at center, ${style.glow}60 0%, transparent 70%)`,
                      }}
                      animate={{ opacity: [0.15, 0.3, 0.15] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    />
                  )}
                  <span className="relative z-10">{m.label}</span>
                  {isActive && (
                    <span className="relative z-10 text-[8px] font-sans normal-case tracking-normal opacity-60 mt-0.5">
                      active
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Add Wallet Balance toggle ── */}
        {isAuthenticated && stats && stats.balance > 0 && (
          <div
            className={`w-full mt-4 rounded-xl p-3 border border-white/5 transition-opacity ${upgrading ? 'opacity-40 pointer-events-none' : ''}`}
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-300">Add Wallet Balance</span>
              <button
                onClick={() => { setUseBalance(v => !v); if (useBalance) setAddedBalance(0); }}
                className="w-10 h-5 rounded-full transition-all relative"
                style={{ background: useBalance ? '#00c8ff' : 'rgba(255,255,255,0.1)' }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ left: useBalance ? '22px' : '2px' }}
                />
              </button>
            </div>
            {useBalance && (
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
                  <span>$0.00</span>
                  <span>Max: ${maxAllowedBalance.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={maxAllowedBalance}
                  step={0.01}
                  value={addedBalance}
                  onChange={e => setAddedBalance(parseFloat(e.target.value))}
                  className="w-full accent-[#00c8ff]"
                />
                <p className="text-center text-xs text-green-400 font-bold mt-1.5">
                  ${addedBalance.toFixed(2)} added
                </p>
                {stats && (stats.matchedBalance || 0) > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5 text-center space-y-1">
                    <p className="text-[10px] text-white/30">
                      Available for Upgrade: <span className="text-green-400 font-bold">${Math.max(0, stats.balance - (stats.matchedBalance || 0)).toFixed(2)}</span> (Real Balance)
                    </p>
                    <p className="text-[10px] text-white/20">
                      Unavailable for Upgrade: <span className="text-blue-400/60 font-bold">${(stats.matchedBalance || 0).toFixed(2)}</span> (Matched Balance)
                    </p>
                    <p className="text-[9px] text-white/15 italic">Matched first deposit funds cannot be used in the Upgrader.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Error / Validation ── */}
        {error && (
          <p className="text-red-400 text-xs text-center">{error}</p>
        )}
        {!upgrading && validationMessage && !error && (
          <p className="text-xs text-gray-500 text-center">{validationMessage}</p>
        )}

        {/* ── UPGRADE BUTTON ── */}
        <motion.button
          onClick={handleUpgrade}
          disabled={!canUpgrade || upgrading}
          whileHover={canUpgrade && !upgrading ? { scale: 1.03 } : {}}
          whileTap={canUpgrade && !upgrading ? { scale: 0.97 } : {}}
          className="w-full mt-6 py-4 rounded-2xl font-display text-xl uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
          style={{
            background: canUpgrade && !upgrading
              ? 'linear-gradient(135deg, #00c8ff, #0080a0)'
              : 'rgba(255,255,255,0.08)',
            color: canUpgrade && !upgrading ? '#000' : '#6b7280',
            boxShadow: canUpgrade && !upgrading
              ? '0 0 40px -8px rgba(0,200,255,0.8), 0 0 80px -20px rgba(0,200,255,0.4)'
              : 'none',
          }}
        >
          {upgrading ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
                className="block w-5 h-5 border-2 border-black/30 border-t-black rounded-full"
              />
              {spinning ? 'Spinning...' : 'Preparing...'}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Zap size={18} /> UPGRADE
            </span>
          )}
        </motion.button>
      </div>
    </div>
  );
}
