import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Loader2, AlertTriangle, Clock, RefreshCw, History, Zap } from 'lucide-react';
import {
  fetchAdminSeedStatus,
  adminRotateNow,
  type AdminSeedStatus,
} from '../lib/api';

interface Props {
  showToast: (msg: string, ok?: boolean) => void;
}

export const ProvablyFairTab: React.FC<Props> = ({ showToast }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AdminSeedStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminSeedStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load seed status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleRotateNow = async () => {
    setRotating(true);
    try {
      const result = await adminRotateNow();
      showToast(result.message, true);
      await fetchStatus();
    } catch (err: any) {
      showToast(err.message || 'Rotation failed', false);
    } finally {
      setRotating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-white/30" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center space-y-3">
        <AlertTriangle size={32} className="text-red-400 mx-auto" />
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={fetchStatus} className="text-xs text-[#00c8ff] hover:underline">Retry</button>
      </div>
    );
  }

  const hasActive = !!status?.active;
  const pastSeeds = status?.past || [];

  return (
    <div className="space-y-6">
      {/* ── Info banner ── */}
      <div className="p-4 rounded-xl border border-[#00c8ff]/20"
        style={{ background: 'rgba(0,200,255,0.05)' }}>
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="text-[#00c8ff] mt-0.5 shrink-0" />
          <div className="space-y-1 text-sm text-white/70 leading-relaxed">
            <p className="font-semibold text-white">Server seed rotates automatically every night at midnight Pacific.</p>
            <p>Rotating reveals the previous seed so anyone can independently verify every pack opening and upgrade completed during that period, then activates a fresh seed. No manual steps needed — but you can force an immediate rotation below anytime.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left column: status + rotate now ── */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Seed Status</h3>

          {/* Active seed */}
          {hasActive && (
            <div className="p-4 rounded-xl border border-green-500/20"
              style={{ background: 'rgba(16,185,129,0.05)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-green-400">Active Seed</span>
              </div>
              <div className="space-y-1.5">
                <div>
                  <span className="text-[10px] text-white/30">Hash (SHA-256)</span>
                  <p className="text-xs font-mono text-white/80 break-all mt-0.5">
                    {status!.active!.seedHash}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-white/30" />
                  <span className="text-[10px] text-white/40">
                    Active since {new Date(status!.active!.periodStart).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!hasActive && (
            <div className="p-4 rounded-xl border border-amber-500/20"
              style={{ background: 'rgba(245,158,11,0.06)' }}>
              <p className="text-sm text-amber-400">
                No active server seed yet. One will be created automatically the next time a pack is opened, or rotate now to create one immediately.
              </p>
            </div>
          )}

          {/* Next automatic rotation */}
          {status?.nextRotationAt && (
            <div className="p-4 rounded-xl border border-white/10 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <Zap size={16} className="text-[#9b5cff] shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">Next automatic rotation</p>
                <p className="text-[11px] text-white/50">{new Date(status.nextRotationAt).toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* ── Rotate now button ── */}
          <button
            onClick={handleRotateNow}
            disabled={rotating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #00c8ff, #9b5cff)',
              color: '#000',
            }}
          >
            {rotating ? (
              <><Loader2 size={14} className="animate-spin" /> Rotating...</>
            ) : (
              <><RefreshCw size={14} /> Rotate Now</>
            )}
          </button>
          <p className="text-[10px] text-white/25 text-center">Optional — reveals the current seed and activates a new one immediately, resetting the nightly schedule.</p>
        </div>

        {/* ── Right column: history ── */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
            <History size={13} />
            Rotation History ({pastSeeds.length})
          </h3>
          {pastSeeds.length === 0 ? (
            <p className="text-xs text-white/20 py-4 text-center">No seeds have been rotated yet.</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">
              {pastSeeds.map((seed, i) => (
                <div key={seed.id || i} className="p-3 rounded-lg border border-white/5"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/30">Hash</span>
                      <span className="text-[9px] text-green-400 font-bold uppercase">
                        Revealed {seed.revealedAt ? new Date(seed.revealedAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-white/60 break-all">{seed.seedHash}</p>
                    <p className="text-[10px] font-mono text-green-400/70 break-all">
                      {seed.revealedSeed}
                    </p>
                    <div className="flex gap-3 text-[10px] text-white/30">
                      <span>From: {new Date(seed.periodStart).toLocaleDateString()}</span>
                      {seed.periodEnd && (
                        <span>To: {new Date(seed.periodEnd).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
