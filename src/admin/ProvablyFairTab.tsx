import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Loader2, Key, Copy, AlertTriangle, CheckCircle, Clock, RefreshCw, History } from 'lucide-react';
import {
  fetchAdminSeedStatus,
  adminGenerateSeed,
  adminCompleteRotation,
  type AdminSeedStatus,
  type GenerateSeedResult,
  type CompleteRotationResult,
} from '../lib/api';

interface Props {
  showToast: (msg: string, ok?: boolean) => void;
}

export const ProvablyFairTab: React.FC<Props> = ({ showToast }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AdminSeedStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Phase 1 — generate
  const [generating, setGenerating] = useState(false);
  const [generatedSeed, setGeneratedSeed] = useState<string | null>(null);
  const [generatedHash, setGeneratedHash] = useState<string | null>(null);

  // Phase 2 — complete rotation
  const [oldSeedInput, setOldSeedInput] = useState('');
  const [completing, setCompleting] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminSeedStatus();
      setStatus(data);
      // Clear generated seed state if pending is gone
      if (!data.pending) {
        setGeneratedSeed(null);
        setGeneratedHash(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load seed status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result: GenerateSeedResult = await adminGenerateSeed();
      if (result.alreadyPending) {
        showToast('A pending seed already exists. Update BLINK_SERVER_SEED, then complete rotation.', true);
        setGeneratedSeed(null);
        setGeneratedHash(result.seedHash);
      } else {
        setGeneratedSeed(result.seed || null);
        setGeneratedHash(result.seedHash);
        showToast('New seed generated — copy it now!', true);
      }
      await fetchStatus();
    } catch (err: any) {
      showToast(err.message || 'Failed to generate seed', false);
    } finally {
      setGenerating(false);
    }
  };

  const handleComplete = async () => {
    const trimmed = oldSeedInput.trim();
    if (!trimmed) {
      showToast('Enter the current OLD server seed', false);
      return;
    }
    setCompleting(true);
    try {
      const result: CompleteRotationResult = await adminCompleteRotation(trimmed);
      showToast(result.message, true);
      setOldSeedInput('');
      setGeneratedSeed(null);
      setGeneratedHash(null);
      await fetchStatus();
    } catch (err: any) {
      showToast(err.message || 'Rotation failed', false);
    } finally {
      setCompleting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast('Copied to clipboard', true),
      () => showToast('Failed to copy', false),
    );
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
  const hasPending = !!status?.pending;
  const pastSeeds = status?.past || [];

  return (
    <div className="space-y-6">
      {/* ── Info banner ── */}
      <div className="p-4 rounded-xl border border-[#00c8ff]/20"
        style={{ background: 'rgba(0,200,255,0.05)' }}>
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="text-[#00c8ff] mt-0.5 shrink-0" />
          <div className="space-y-1 text-sm text-white/70 leading-relaxed">
            <p className="font-semibold text-white">Recommended: Rotate the server seed every 7 days.</p>
            <p>Rotating a server seed reveals the previous seed, allowing users to independently verify every pack opening completed during that rotation period. The active server seed is never revealed until it has been retired.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left column: status + generate ── */}
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
                No active server seed. Run <span className="font-mono">POST /admin/provably-fair/initialize</span> to set up the system.
              </p>
            </div>
          )}

          {/* Pending seed */}
          {hasPending && (
            <div className="p-4 rounded-xl border border-amber-500/20"
              style={{ background: 'rgba(245,158,11,0.06)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Pending Seed</span>
              </div>
              <div className="space-y-1.5">
                <div>
                  <span className="text-[10px] text-white/30">Hash (SHA-256)</span>
                  <p className="text-xs font-mono text-white/80 break-all mt-0.5">
                    {status!.pending!.seedHash}
                  </p>
                </div>
                <p className="text-[10px] text-amber-400/70">
                  Update BLINK_SERVER_SEED with this seed, then complete the rotation below.
                </p>
              </div>
            </div>
          )}

          {/* ── Generate button ── */}
          <button
            onClick={handleGenerate}
            disabled={generating || hasPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, rgba(0,200,255,0.15), rgba(155,92,255,0.15))',
              border: '1px solid rgba(0,200,255,0.25)',
              color: '#00c8ff',
            }}
          >
            {generating ? (
              <><Loader2 size={14} className="animate-spin" /> Generating...</>
            ) : hasPending ? (
              <><CheckCircle size={14} /> Seed Generated — Complete Rotation Below</>
            ) : (
              <><Key size={14} /> Generate New Seed</>
            )}
          </button>

          {/* ── Generated seed display (one-time) ── */}
          {generatedSeed && (
            <div className="p-4 rounded-xl border border-red-500/30 space-y-3"
              style={{ background: 'rgba(248,113,113,0.08)' }}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-400 leading-relaxed">
                  <strong>Copy this server seed into the BLINK_SERVER_SEED secret before completing the rotation.</strong> Once you leave this page, the new server seed cannot be viewed again.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-red-300 font-mono break-all bg-black/30 p-2 rounded-lg border border-red-500/20">
                  {generatedSeed}
                </code>
                <button
                  onClick={() => copyToClipboard(generatedSeed!)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors shrink-0"
                  title="Copy to clipboard"
                >
                  <Copy size={14} />
                </button>
              </div>
              <div>
                <span className="text-[10px] text-white/30">New Seed Hash</span>
                <p className="text-xs font-mono text-white/60 break-all mt-0.5">{generatedHash}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: complete rotation + history ── */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Complete Rotation</h3>

          {/* Complete rotation form */}
          <div className="p-4 rounded-xl border border-white/10 space-y-3"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-start gap-2">
              <RefreshCw size={14} className="text-white/50 mt-0.5 shrink-0" />
              <div className="text-xs text-white/50 space-y-1">
                <p>1. Paste the new seed into <strong className="text-white">BLINK_SERVER_SEED</strong> in Blink secrets</p>
                <p>2. Enter the <strong className="text-white">old</strong> server seed below to prove you know it</p>
                <p>3. The old seed will be revealed and the new seed becomes active</p>
              </div>
            </div>

            <input
              type="text"
              placeholder="Paste the current (OLD) server seed here..."
              value={oldSeedInput}
              onChange={e => setOldSeedInput(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#00c8ff]/40"
            />

            <button
              onClick={handleComplete}
              disabled={completing || !oldSeedInput.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #00c8ff, #9b5cff)',
                color: '#000',
              }}
            >
              {completing ? (
                <><Loader2 size={13} className="animate-spin" /> Completing...</>
              ) : (
                <><RefreshCw size={13} /> Complete Rotation</>
              )}
            </button>
          </div>

          {/* ── Past revealed seeds ── */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3 flex items-center gap-1.5">
              <History size={13} />
              Rotation History ({pastSeeds.length})
            </h3>
            {pastSeeds.length === 0 ? (
              <p className="text-xs text-white/20 py-4 text-center">No seeds have been rotated yet.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
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
    </div>
  );
};
