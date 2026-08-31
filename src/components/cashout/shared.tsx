import React from 'react';

// ─── Rarity color map ─────────────────────────────────────────────────────────
export const RARITY_COLOR: Record<string, string> = {
  common: '#8892a4', uncommon: '#10b981', rare: '#00c8ff',
  ultra: '#9b5cff', secret: '#ffd700', god: '#ff00ff',
};
export const rarityColor = (r: string) => RARITY_COLOR[r?.toLowerCase()] ?? '#8892a4';

// ─── Label ────────────────────────────────────────────────────────────────────
export const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">{children}</p>
);

// ─── FieldInput ───────────────────────────────────────────────────────────────
export const FieldInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { error?: string }> = ({ error, ...props }) => (
  <div>
    <input
      {...props}
      className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none transition-all"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid ${error ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)'}`,
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'rgba(0,200,255,0.45)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,200,255,0.07)';
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = error ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
    {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
  </div>
);

// ─── StepDot ──────────────────────────────────────────────────────────────────
export const StepDot: React.FC<{ active: boolean; done: boolean; num: number }> = ({ active, done, num }) => (
  <div
    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
    style={{
      background: done ? '#10b981' : active ? 'rgba(155,92,255,0.25)' : 'rgba(255,255,255,0.05)',
      border: `1.5px solid ${done ? '#10b981' : active ? '#9b5cff' : 'rgba(255,255,255,0.1)'}`,
      color: done ? '#fff' : active ? '#9b5cff' : '#4b5563',
    }}
  >
    {done ? '✓' : num}
  </div>
);

// ─── ErrorBanner ──────────────────────────────────────────────────────────────
export const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div
    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
    style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}
  >
    <span className="text-xs text-red-400">{message}</span>
  </div>
);
