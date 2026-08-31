import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Search, Clock, Info, Loader2, CheckCircle, Hash, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  fetchProvablyFairOpenings,
  fetchProvablyFairVerify,
  fetchProvablyFairSeedHistory,
  type ProvablyFairOpening,
  type ProvablyFairVerifyData,
  type SeedHistoryResult,
  fetchProvablyFairUpgrades,
  fetchProvablyFairVerifyUpgrade,
  type ProvablyFairUpgrade,
  type ProvablyFairVerifyUpgradeData,
} from '../lib/api';

type Tab = 'overview' | 'verify' | 'seeds' | 'how';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TABS: { id: Tab; label: string; icon: React.FC<{ size?: number }> }[] = [
  { id: 'overview', label: 'Overview', icon: ShieldCheck },
  { id: 'verify', label: 'Verify', icon: Search },
  { id: 'seeds', label: 'Seed History', icon: Clock },
  { id: 'how', label: 'How It Works', icon: Info },
];

const labelCx =
  'text-xs text-white/50 border border-white/10 rounded-lg px-3 py-1 font-mono break-all';

const valueCx = 'text-sm text-white font-mono break-all';

const fieldCx = 'flex flex-col gap-1';

/** Safe number formatter — returns "N/A" for null/undefined/NaN, otherwise toFixed. */
function safeNum(val: number | null | undefined, decimals: number): string {
  if (val === null || val === undefined || !isFinite(val)) return 'N/A';
  return val.toFixed(decimals);
}

export const ProvablyFairModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  // Seed history (public, no auth needed)
  const [seedHistory, setSeedHistory] = useState<SeedHistoryResult | null>(null);
  const [seedsLoading, setSeedsLoading] = useState(false);

  // Verify tab — Pack Openings
  const [openings, setOpenings] = useState<ProvablyFairOpening[]>([]);
  const [openingsLoading, setOpeningsLoading] = useState(false);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [verifyData, setVerifyData] = useState<ProvablyFairVerifyData | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Verify tab — Upgrader Spins
  const [verifyMode, setVerifyMode] = useState<'packs' | 'upgrader'>('packs');
  const [upgradeSpins, setUpgradeSpins] = useState<ProvablyFairUpgrade[]>([]);
  const [upgradesLoading, setUpgradesLoading] = useState(false);
  const [selectedSpinId, setSelectedSpinId] = useState<string | null>(null);
  const [upgradeVerifyData, setUpgradeVerifyData] = useState<ProvablyFairVerifyUpgradeData | null>(null);
  const [upgradeVerifyLoading, setUpgradeVerifyLoading] = useState(false);
  const [upgradeVerifyError, setUpgradeVerifyError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setTab('overview');
      setVerifyMode('packs');
      setSelectedOpeningId(null);
      setVerifyData(null);
      setVerifyError(null);
      setSelectedSpinId(null);
      setUpgradeVerifyData(null);
      setUpgradeVerifyError(null);
    }
  }, [isOpen]);

  // Load seed history (public)
  useEffect(() => {
    if (!isOpen) return;
    setSeedsLoading(true);
    fetchProvablyFairSeedHistory()
      .then(setSeedHistory)
      .catch(() => {})
      .finally(() => setSeedsLoading(false));
  }, [isOpen]);

  // Load openings when verify tab selected + packs mode
  useEffect(() => {
    if (tab !== 'verify' || !user || verifyMode !== 'packs') return;
    setOpeningsLoading(true);
    fetchProvablyFairOpenings()
      .then(data => setOpenings(data.openings))
      .catch(() => {})
      .finally(() => setOpeningsLoading(false));
  }, [tab, user, verifyMode]);

  // Load upgrade spins when verify tab selected + upgrader mode
  useEffect(() => {
    if (tab !== 'verify' || !user || verifyMode !== 'upgrader') return;
    setUpgradesLoading(true);
    fetchProvablyFairUpgrades()
      .then(data => setUpgradeSpins(data.spins))
      .catch(() => {})
      .finally(() => setUpgradesLoading(false));
  }, [tab, user, verifyMode]);

  // Verify selected opening
  const handleVerify = async (openingId: string) => {
    setSelectedOpeningId(openingId);
    setVerifyData(null);
    setVerifyError(null);
    setVerifyLoading(true);
    try {
      const data = await fetchProvablyFairVerify(openingId);
      setVerifyData(data);
    } catch (err: any) {
      setVerifyError(err.message || 'Failed to verify opening');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Verify selected upgrade spin
  const handleVerifyUpgrade = async (spinId: string) => {
    setSelectedSpinId(spinId);
    setUpgradeVerifyData(null);
    setUpgradeVerifyError(null);
    setUpgradeVerifyLoading(true);
    try {
      const data = await fetchProvablyFairVerifyUpgrade(spinId);
      setUpgradeVerifyData(data);
    } catch (err: any) {
      setUpgradeVerifyError(err.message || 'Failed to verify upgrader spin');
    } finally {
      setUpgradeVerifyLoading(false);
    }
  };

  if (!isOpen) return null;

  const isLoggedIn = !!user && !authLoading;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-[#0d0e14] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <ShieldCheck size={22} className="text-[#00c8ff]" />
              <h2 className="text-xl font-display text-white uppercase tracking-tight">Provably Fair</h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/5 bg-white/[0.01]">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                  tab === id
                    ? 'text-[#00c8ff] border-b-2 border-[#00c8ff] bg-white/[0.03]'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {tab === 'overview' && <OverviewTab seedHistory={seedHistory} seedsLoading={seedsLoading} />}
            {tab === 'verify' && (
              <VerifyTab
                isLoggedIn={isLoggedIn}
                verifyMode={verifyMode}
                setVerifyMode={setVerifyMode}
                openings={openings}
                openingsLoading={openingsLoading}
                selectedOpeningId={selectedOpeningId}
                verifyData={verifyData}
                verifyLoading={verifyLoading}
                verifyError={verifyError}
                onVerify={handleVerify}
                onBackFromDetail={() => { setSelectedOpeningId(null); setVerifyData(null); setVerifyError(null); }}
                upgradeSpins={upgradeSpins}
                upgradesLoading={upgradesLoading}
                selectedSpinId={selectedSpinId}
                upgradeVerifyData={upgradeVerifyData}
                upgradeVerifyLoading={upgradeVerifyLoading}
                upgradeVerifyError={upgradeVerifyError}
                onVerifyUpgrade={handleVerifyUpgrade}
                onBackUpgradeDetail={() => { setSelectedSpinId(null); setUpgradeVerifyData(null); setUpgradeVerifyError(null); }}
              />
            )}
            {tab === 'seeds' && <SeedsTab seedHistory={seedHistory} seedsLoading={seedsLoading} />}
            {tab === 'how' && <HowTab />}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// ── Overview Tab ────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ seedHistory: SeedHistoryResult | null; seedsLoading: boolean }> = ({
  seedHistory,
  seedsLoading,
}) => (
  <div className="space-y-3 text-gray-400 text-sm leading-relaxed">
    <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/5">
      <Hash size={16} className="text-[#00c8ff] mt-0.5 shrink-0" />
      <div className="space-y-2">
        <p>
          Every pack opening uses a cryptographic system with three components:
        </p>
        <ul className="space-y-1 pl-4 list-disc text-white/70">
          <li><strong className="text-white">Server Seed</strong> — generated by the server, kept secret until rotated</li>
          <li><strong className="text-white">Client Seed</strong> — randomly generated for each opening</li>
          <li><strong className="text-white">Nonce</strong> — a counter that increments with every opening</li>
        </ul>
      </div>
    </div>

    <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/5">
      <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
      <div>
        <p>Pack odds are published as a content hash <strong className="text-white">before</strong> any packs are opened. This means the odds can't be changed retroactively — the hash proves the odds snapshot was captured at a specific point in time.</p>
      </div>
    </div>

    <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/5">
      <Clock size={16} className="text-amber-400 mt-0.5 shrink-0" />
      <div>
        <p>
          The <strong className="text-white">active</strong> server seed remains secret. When it is rotated, the previous seed is publicly revealed so anyone can verify past openings. The current active seed hash is:
        </p>
        {seedsLoading ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
            <Loader2 size={12} className="animate-spin" /> Loading...
          </div>
        ) : seedHistory?.active ? (
          <div className="mt-3 p-3 rounded-lg bg-[#00c8ff]/5 border border-[#00c8ff]/15">
            <p className={labelCx}>{seedHistory.active.seedHash}</p>
            <p className="text-[10px] text-white/30 mt-1">
              Active since {new Date(seedHistory.active.activeSince).toLocaleDateString()}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-amber-400/70">
            No active provably fair seed found. Ask the admin to initialize the system.
          </p>
        )}
      </div>
    </div>

    <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/5">
      <ShieldCheck size={16} className="text-[#00c8ff] mt-0.5 shrink-0" />
      <div>
        <p>Admins <strong className="text-white">cannot</strong> change the result of an individual pack opening after it begins. Once the server seed, client seed, and nonce are set, the outcome is mathematically predetermined by HMAC-SHA256.</p>
      </div>
    </div>
  </div>
);

// ── Verify Tab ──────────────────────────────────────────────────────────

const VerifyTab: React.FC<{
  isLoggedIn: boolean;
  verifyMode: 'packs' | 'upgrader';
  setVerifyMode: (m: 'packs' | 'upgrader') => void;
  openings: ProvablyFairOpening[];
  openingsLoading: boolean;
  selectedOpeningId: string | null;
  verifyData: ProvablyFairVerifyData | null;
  verifyLoading: boolean;
  verifyError: string | null;
  onVerify: (id: string) => void;
  onBackFromDetail: () => void;
  upgradeSpins: ProvablyFairUpgrade[];
  upgradesLoading: boolean;
  selectedSpinId: string | null;
  upgradeVerifyData: ProvablyFairVerifyUpgradeData | null;
  upgradeVerifyLoading: boolean;
  upgradeVerifyError: string | null;
  onVerifyUpgrade: (id: string) => void;
  onBackUpgradeDetail: () => void;
}> = ({
  isLoggedIn,
  verifyMode,
  setVerifyMode,
  openings,
  openingsLoading,
  selectedOpeningId,
  verifyData,
  verifyLoading,
  verifyError,
  onVerify,
  onBackFromDetail,
  upgradeSpins,
  upgradesLoading,
  selectedSpinId,
  upgradeVerifyData,
  upgradeVerifyLoading,
  upgradeVerifyError,
  onVerifyUpgrade,
  onBackUpgradeDetail,
}) => {
  if (!isLoggedIn) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 text-sm">Sign in to verify your past activity.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      {!verifyData && !upgradeVerifyData && (
        <div className="flex rounded-lg bg-white/[0.03] border border-white/5 p-0.5">
          {(['packs', 'upgrader'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => {
                setVerifyMode(mode);
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                verifyMode === mode
                  ? 'bg-[#00c8ff]/15 text-[#00c8ff]'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {mode === 'packs' ? 'Pack Openings' : 'Upgrader Spins'}
            </button>
          ))}
        </div>
      )}

      {/* ── Packs Mode ── */}
      {verifyMode === 'packs' && (
        <>
          {/* Opening list */}
          {!verifyData && (
            <div>
              <p className="text-xs text-white/50 mb-3 uppercase tracking-wider">Select an opening to verify</p>
              {openingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-white/40" />
                </div>
              ) : openings.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No provably fair pack openings found. Open some packs first!
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {openings.map(op => (
                    <button
                      key={op.id}
                      onClick={() => onVerify(op.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${
                        selectedOpeningId === op.id
                          ? 'border-[#00c8ff]/40 bg-[#00c8ff]/5'
                          : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm text-white font-medium">{op.cardName}</p>
                          <p className="text-xs text-white/40">{op.packName} · {op.rarity}</p>
                        </div>
                        <span className="text-xs text-white/30">
                          {new Date(op.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {verifyLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[#00c8ff]" />
            </div>
          )}

          {verifyError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {verifyError}
            </div>
          )}

          {verifyData && !verifyLoading && (
            <div className="space-y-3">
              <button
                onClick={onBackFromDetail}
                className="text-xs text-[#00c8ff] hover:text-[#00c8ff]/70 transition-colors"
              >
                ← Back to list
              </button>
              <PackVerifyDetail data={verifyData} />
            </div>
          )}
        </>
      )}

      {/* ── Upgrader Mode ── */}
      {verifyMode === 'upgrader' && (
        <>
          {/* Spin list */}
          {!upgradeVerifyData && (
            <div>
              <p className="text-xs text-white/50 mb-3 uppercase tracking-wider">Select an upgrader spin to verify</p>
              {upgradesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-white/40" />
                </div>
              ) : upgradeSpins.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No provably fair upgrader spins found. Use the upgrader first!
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {upgradeSpins.map(spin => (
                    <button
                      key={spin.id}
                      onClick={() => onVerifyUpgrade(spin.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${
                        selectedSpinId === spin.id
                          ? 'border-[#00c8ff]/40 bg-[#00c8ff]/5'
                          : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${spin.isWin ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                              {spin.isWin ? 'WIN' : 'LOSS'}
                            </span>
                            <span className="text-xs text-white/50">{spin.multiplier}x</span>
                          </div>
                          <p className="text-sm text-white font-medium mt-1">
                            ${safeNum(spin.totalInputValue, 2)} → {spin.isWin ? `${safeNum(spin.totalTargetValue, 2)}` : 'Consolation'}
                          </p>
                          <p className="text-xs text-white/30">{safeNum(spin.winChance, 1)}% chance</p>
                        </div>
                        <span className="text-xs text-white/30">
                          {new Date(spin.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {upgradeVerifyLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[#00c8ff]" />
            </div>
          )}

          {upgradeVerifyError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {upgradeVerifyError}
            </div>
          )}

          {upgradeVerifyData && !upgradeVerifyLoading && (
            <div className="space-y-3">
              <button
                onClick={onBackUpgradeDetail}
                className="text-xs text-[#00c8ff] hover:text-[#00c8ff]/70 transition-colors"
              >
                ← Back to list
              </button>
              <UpgraderVerifyDetail data={upgradeVerifyData} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Pack Verify Detail ───────────────────────────────────────────────────

const PackVerifyDetail: React.FC<{ data: ProvablyFairVerifyData }> = ({ data }) => (
  <>
    {data.isRevealed ? (
      <div className={`p-3 rounded-xl text-sm font-bold ${
        data.verified
          ? 'bg-green-500/10 border border-green-500/30 text-green-400'
          : 'bg-red-500/10 border border-red-500/30 text-red-400'
      }`}>
        {data.verified ? '✓ Verified — roll value matches' : '✗ Verification failed — roll value mismatch'}
      </div>
    ) : (
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
        This opening can be verified once the current server seed has been rotated.
      </div>
    )}

    <div className={fieldCx}>
      <span className="text-xs text-white/40">Pack</span>
      <span className={valueCx}>{data.packName}</span>
    </div>
    <div className={fieldCx}>
      <span className="text-xs text-white/40">Card Received</span>
      <span className={valueCx}>{data.cardName} <span className="text-white/50">({data.rarity})</span></span>
    </div>
    <div className={fieldCx}>
      <span className="text-xs text-white/40">Roll Value</span>
      <span className={valueCx}>{safeNum(data.rollValue, 4)}</span>
    </div>
    {data.recomputedRoll !== undefined && data.recomputedRoll !== null && (
      <div className={fieldCx}>
        <span className="text-xs text-white/40">Recomputed Roll</span>
        <span className={`text-sm font-mono break-all ${data.verified ? 'text-green-400' : 'text-red-400'}`}>
          {safeNum(data.recomputedRoll, 4)}
        </span>
      </div>
    )}
    <div className={fieldCx}>
      <span className="text-xs text-white/40">Client Seed</span>
      <span className={valueCx}>{data.clientSeed}</span>
    </div>
    <div className={fieldCx}>
      <span className="text-xs text-white/40">Nonce</span>
      <span className={valueCx}>{data.nonce}</span>
    </div>
    <div className={fieldCx}>
      <span className="text-xs text-white/40">Server Seed Hash</span>
      <span className={labelCx}>{data.serverSeedHash}</span>
    </div>
    {data.revealedSeed && (
      <div className={fieldCx}>
        <span className="text-xs text-white/40">Revealed Server Seed</span>
        <span className={`text-sm font-mono break-all ${data.verified ? 'text-green-400' : 'text-red-400'}`}>
          {data.revealedSeed}
        </span>
      </div>
    )}
    <div className={fieldCx}>
      <span className="text-xs text-white/40">Odds Version Hash</span>
      <span className={labelCx}>{data.oddsVersionHash}</span>
    </div>
    <div className={fieldCx}>
      <span className="text-xs text-white/40">Opening Timestamp</span>
      <span className={valueCx}>{new Date(data.createdAt).toLocaleString()}</span>
    </div>
  </>
);

// ── Upgrader Verify Detail ───────────────────────────────────────────────

const UpgraderVerifyDetail: React.FC<{ data: ProvablyFairVerifyUpgradeData }> = ({ data }) => {
  if (data.isLegacy) {
    return (
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm space-y-2">
        <p className="font-bold">Legacy Spin — Not Verifiable</p>
        <p>{data.message || 'This spin predates the provably fair system.'}</p>
        <div className="flex items-center gap-3 text-xs text-white/30 pt-1">
          <span>{data.multiplier}x multiplier</span>
          <span>${safeNum(data.totalInputValue, 2)} input</span>
          <span>{data.isWin ? 'WIN' : 'LOSS'}</span>
        </div>
        <p className="text-[10px] text-white/20">{new Date(data.createdAt).toLocaleString()}</p>
      </div>
    );
  }

  return (
    <>
      {/* Status badge */}
      {data.isRevealed ? (
        <div className={`p-3 rounded-xl text-sm font-bold ${
          data.verified
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {data.verified ? '✓ Verified — roll value matches' : '✗ Verification failed — roll value mismatch'}
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          This spin can be verified once the current server seed has been rotated.
        </div>
      )}

      {/* Outcome */}
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${data.isWin ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
          {data.isWin ? 'WIN' : 'LOSS'}
        </span>
        <span className="text-sm text-white">{data.multiplier}x multiplier</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={fieldCx}>
          <span className="text-xs text-white/40">Input Value</span>
          <span className={valueCx}>${safeNum(data.totalInputValue, 2)}</span>
        </div>
        <div className={fieldCx}>
          <span className="text-xs text-white/40">Balance Used</span>
          <span className={valueCx}>${safeNum(data.balanceUsed, 2)}</span>
        </div>
        <div className={fieldCx}>
          <span className="text-xs text-white/40">Baseline Target</span>
          <span className={valueCx}>${safeNum(data.baselineTargetValue, 2)}</span>
        </div>
        <div className={fieldCx}>
          <span className="text-xs text-white/40">Actual Target</span>
          <span className={valueCx}>${safeNum(data.totalTargetValue, 2)}</span>
        </div>
        <div className={fieldCx}>
          <span className="text-xs text-white/40">Win Chance</span>
          <span className={valueCx}>{safeNum(data.winChance, 2)}%</span>
        </div>
      </div>

      <div className={fieldCx}>
        <span className="text-xs text-white/40">Roll Value</span>
        <span className={valueCx}>{safeNum(data.rollValue, 4)}</span>
      </div>
      {data.recomputedRoll !== undefined && data.recomputedRoll !== null && (
        <div className={fieldCx}>
          <span className="text-xs text-white/40">Recomputed Roll</span>
          <span className={`text-sm font-mono break-all ${data.verified ? 'text-green-400' : 'text-red-400'}`}>
            {safeNum(data.recomputedRoll, 4)}
          </span>
        </div>
      )}
      <div className={fieldCx}>
        <span className="text-xs text-white/40">Client Seed</span>
        <span className={valueCx}>{data.clientSeed}</span>
      </div>
      <div className={fieldCx}>
        <span className="text-xs text-white/40">Nonce</span>
        <span className={valueCx}>{data.nonce}</span>
      </div>
      <div className={fieldCx}>
        <span className="text-xs text-white/40">Server Seed Hash</span>
        <span className={labelCx}>{data.serverSeedHash}</span>
      </div>
      {data.revealedSeed && (
        <div className={fieldCx}>
          <span className="text-xs text-white/40">Revealed Server Seed</span>
          <span className={`text-sm font-mono break-all ${data.verified ? 'text-green-400' : 'text-red-400'}`}>
            {data.revealedSeed}
          </span>
        </div>
      )}
      <div className={fieldCx}>
        <span className="text-xs text-white/40">Odds Version Hash</span>
        <span className={labelCx}>{data.oddsVersionHash}</span>
      </div>
      <div className={fieldCx}>
        <span className="text-xs text-white/40">Spin Timestamp</span>
        <span className={valueCx}>{new Date(data.createdAt).toLocaleString()}</span>
      </div>
    </>
  );
};

// ── Seed History Tab ────────────────────────────────────────────────────

const SeedsTab: React.FC<{ seedHistory: SeedHistoryResult | null; seedsLoading: boolean }> = ({
  seedHistory,
  seedsLoading,
}) => {
  if (seedsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-white/40" />
      </div>
    );
  }

  if (!seedHistory) {
    return <p className="text-sm text-gray-500 py-4 text-center">Unable to load seed history.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Active seed */}
      {seedHistory.active ? (
        <div className="p-4 rounded-xl bg-[#00c8ff]/5 border border-[#00c8ff]/15 space-y-2">
          <p className="text-xs text-[#00c8ff] uppercase tracking-wider font-bold">Active Seed</p>
          <div className={fieldCx}>
            <span className="text-xs text-white/40">Seed Hash (SHA-256)</span>
            <span className={labelCx}>{seedHistory.active.seedHash}</span>
          </div>
          <p className="text-xs text-white/30">
            Active since {new Date(seedHistory.active.activeSince).toLocaleDateString()}
          </p>
          <p className="text-xs text-amber-400/70">
            This seed is currently active and not yet revealed. It will be revealed after the next rotation.
          </p>
        </div>
      ) : (
        <p className="text-sm text-amber-400/70 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
          No active provably fair seed. The system may not be initialized yet.
        </p>
      )}

      {/* Past seeds */}
      {seedHistory.past.length > 0 && (
        <div>
          <p className="text-xs text-white/50 mb-3 uppercase tracking-wider">
            Revealed Seeds ({seedHistory.past.length})
          </p>
          <div className="space-y-3">
            {seedHistory.past.map((seed, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                <div className={fieldCx}>
                  <span className="text-xs text-white/40">Seed Hash</span>
                  <span className={labelCx}>{seed.seedHash}</span>
                </div>
                <div className={fieldCx}>
                  <span className="text-xs text-white/40">Revealed Seed</span>
                  <span className="text-sm text-green-400 font-mono break-all">{seed.revealedSeed}</span>
                </div>
                <div className="flex gap-4 text-xs text-white/30">
                  <span>Active: {new Date(seed.periodStart).toLocaleDateString()} – {seed.periodEnd ? new Date(seed.periodEnd).toLocaleDateString() : 'Present'}</span>
                  {seed.revealedAt && (
                    <span>Revealed: {new Date(seed.revealedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {seedHistory.past.length === 0 && seedHistory.active && (
        <p className="text-sm text-gray-500 py-2 text-center">
          No seeds have been rotated yet. Past seeds appear here once revealed.
        </p>
      )}
    </div>
  );
};

// ── How It Works Tab ────────────────────────────────────────────────────

const HowTab: React.FC = () => (
  <div className="space-y-5">
    <p className="text-sm text-gray-400">
      Every pack opening is determined by a cryptographic algorithm that can be independently verified by anyone.
      Here's how it works:
    </p>

    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-white/10" />

      {[
        {
          step: '1',
          title: 'Server Seed + Client Seed + Nonce',
          desc: 'The server generates a random secret seed. For each opening, a unique client seed and nonce (counter) are combined with the server seed.',
        },
        {
          step: '2',
          title: 'HMAC-SHA256 → Roll Value',
          desc: 'The three components are fed into HMAC-SHA256, producing a deterministic roll value between 0.0000 and 99.9999. The same inputs always produce the same output.',
        },
        {
          step: '3',
          title: 'Roll → Card Selection',
          desc: 'The roll is compared against the published pack odds (cumulative rarity probabilities). The card whose probability range contains the roll is selected.',
        },
        {
          step: '4',
          title: 'Card Awarded',
          desc: 'The selected card is added to your inventory. All verification data (seeds, nonce, roll, odds hash) are saved and can be checked later.',
        },
        {
          step: '5',
          title: 'Verify Anytime',
          desc: 'Once the server seed is rotated and revealed, you can recompute the roll yourself using the Verify Opening tab and confirm the outcome was fair.',
        },
      ].map(({ step, title, desc }) => (
        <div key={step} className="relative pl-12 pb-5 last:pb-0">
          <div className="absolute left-1.5 w-7 h-7 rounded-full bg-[#0d0e14] border-2 border-[#00c8ff]/40 flex items-center justify-center">
            <span className="text-xs font-bold text-[#00c8ff]">{step}</span>
          </div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
        </div>
      ))}
    </div>

    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
      <p className="text-xs text-white/50 leading-relaxed">
        <strong className="text-white">Formula:</strong>{' '}
        <span className="font-mono text-white/70">
          roll = HMAC-SHA256(serverSeed, clientSeed + ":" + nonce) → first 8 hex chars → uint32 mod 1,000,000 ÷ 10,000
        </span>
      </p>
    </div>
  </div>
);

export default ProvablyFairModal;
