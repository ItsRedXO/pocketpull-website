import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Copy, ArrowLeft, Swords, DollarSign } from 'lucide-react';
import { blink } from '../../lib/blink';
import { useAuth, useUserStats } from '../../hooks/useAuth';
import { usePacks, type PackCatalog } from '../../hooks/usePacks';
import { PackSelectorModal } from './PackSelectorModal';
import { SelectedPackCard } from './create/SelectedPackCard';
import { PlayerCountSelector } from './create/PlayerCountSelector';
import type { BattleMode } from './battleTypes';
import { uid, generatePrivateCode, MODE_INFO } from './battleUtils';
import { createBattle as createBattleAPI } from '../../lib/api';

interface SelectedPack extends PackCatalog {
  uniqueKey: string;
}

interface Props {
  onCreated: (battleId: string) => void;
  onBack: () => void;
}

export const CreateBattlePage: React.FC<Props> = ({ onCreated, onBack }) => {
  const { user } = useAuth();
  const { stats, updateBalance } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const [selectedPacks, setSelectedPacks] = useState<SelectedPack[]>([]);
  const [mode, setMode] = useState<BattleMode>('standard');
  const [playerCount, setPlayerCount] = useState(2);
  const [isPublic, setIsPublic] = useState(true);
  const [showPackSelector, setShowPackSelector] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // teamBattle = true means the 2v2 visual layout (still 4 players total)
  const [teamBattle, setTeamBattle] = useState(false);

  const totalCost = selectedPacks.reduce((sum, p) => sum + p.price, 0);

  // When Shared mode is active, 2v2 (teamBattle) is not available — reset to 1v1
  useEffect(() => {
    if (mode === 'shared' && teamBattle) {
      setTeamBattle(false);
      setPlayerCount(2);
    }
  }, [mode, teamBattle]);

  const addPack = useCallback((pack: PackCatalog) => {
    setSelectedPacks(prev => [...prev, { ...pack, uniqueKey: uid() }]);
    setShowPackSelector(false);
  }, []);

  const removePack = useCallback((uniqueKey: string) => {
    setSelectedPacks(prev => prev.filter(p => p.uniqueKey !== uniqueKey));
  }, []);

  const duplicatePack = useCallback((pack: SelectedPack) => {
    setSelectedPacks(prev => [...prev, { ...pack, uniqueKey: uid() }]);
  }, []);

  const handleCreate = async () => {
    if (!user) { setError('Please sign in to create a battle.'); return; }
    if (selectedPacks.length === 0) { setError('Add at least one pack to the battle.'); return; }
    if (totalCost > (stats?.balance ?? 0)) { setError(`Insufficient balance. Need $${totalCost.toFixed(2)}, have $${(stats?.balance ?? 0).toFixed(2)}.`); return; }

    setCreating(true);
    setError('');
    try {
      // Call backend — server fetches authoritative pack prices, deducts balance
      const result = await createBattleAPI({
        selectedPackIds: selectedPacks.map(p => p.id),
        mode,
        playerCount,
        isPublic,
        teamMode: teamBattle,
      });

      // Update local balance from backend-authoritative value
      await updateBalance(result.newBalance);

      if (result.privateCode) setCreatedCode(result.privateCode);
      onCreated(result.battleId);
    } catch (err: any) {
      setError(err?.message || 'Failed to create battle. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const copyCode = () => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/6 hover:bg-white/12 flex items-center justify-center transition-colors">
            <ArrowLeft size={18} className="text-gray-400" />
          </button>
          <div>
            <h1 className="font-display text-4xl uppercase tracking-tight"
              style={{ textShadow: '0 0 30px rgba(255,215,0,0.4)' }}>
              CREATE <span className="text-[#ffd700]">BATTLE</span>
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Select packs, choose your mode, and fight.</p>
          </div>

        </div>

        {/* Selected packs row */}
        <div className="mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Selected Packs ({selectedPacks.length})</div>
          <div className="flex gap-3 flex-wrap items-stretch">
            <AnimatePresence>
              {selectedPacks.map((pack) => (
                <SelectedPackCard
                  key={pack.uniqueKey}
                  pack={pack}
                  onRemove={() => removePack(pack.uniqueKey)}
                  onDuplicate={() => duplicatePack(pack)}
                />
              ))}
            </AnimatePresence>

            {/* Add pack button */}
            <motion.button
              whileHover={{ scale: 1.04, borderColor: 'rgba(255,215,0,0.4)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowPackSelector(true)}
              className="flex flex-col items-center justify-center gap-2 w-36 rounded-xl border-2 border-dashed border-white/15 p-4 transition-all hover:bg-white/4 cursor-pointer"
              style={{ minHeight: '148px' }}
            >
              <div className="w-10 h-10 rounded-full border-2 border-dashed border-[#ffd700]/30 flex items-center justify-center">
                <Plus size={18} className="text-[#ffd700]/60" />
              </div>
              <span className="text-[11px] text-gray-600 uppercase font-bold tracking-wider text-center">Add Pack</span>
            </motion.button>
          </div>
        </div>

        {/* Live cost display */}
        {selectedPacks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6 px-5 py-3 rounded-xl border"
            style={{
              background: 'rgba(255,215,0,0.06)',
              borderColor: 'rgba(255,215,0,0.2)',
            }}
          >
            <DollarSign size={16} className="text-[#ffd700]" />
            <span className="text-sm text-gray-400">Total cost per player:</span>
            <span className="font-display text-xl text-[#ffd700]">${totalCost.toFixed(2)}</span>
            <span className="text-gray-600 text-xs ml-auto">
              {selectedPacks.length} pack{selectedPacks.length !== 1 ? 's' : ''}
              {user && stats && totalCost > stats.balance && (
                <span className="text-red-400 ml-2">• Insufficient balance</span>
              )}
            </span>
          </motion.div>
        )}

        {/* Controls row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Battle Mode */}
          <div className="glass-card p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Battle Mode</p>
            <div className="space-y-2">
              {(Object.entries(MODE_INFO) as [BattleMode, typeof MODE_INFO[string]][]).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left"
                  style={{
                    background: mode === key ? info.color + '18' : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${mode === key ? info.color + '50' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <span className="text-lg leading-none">{info.icon}</span>
                  <div>
                    <p className="font-bold text-sm" style={{ color: mode === key ? info.color : '#d1d5db' }}>{info.label}</p>
                    <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{info.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Player Count — visual icon selector */}
          <div className="glass-card p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Players</p>
            <PlayerCountSelector
              isSharedMode={mode === 'shared'}
              selectedId={
                playerCount === 2 ? '1v1' :
                playerCount === 3 ? '3ffa' :
                teamBattle ? '2v2' : '4ffa'
              }
              onSelect={(id) => {
                setTeamBattle(id === '2v2');
                setPlayerCount(id === '1v1' ? 2 : id === '3ffa' ? 3 : 4);
              }}
            />
          </div>

          {/* Visibility */}
          <div className="glass-card p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Visibility</p>
            <div className="space-y-2">
              {[
                { value: true, icon: '🌐', label: 'Public', desc: 'Visible on live battle board' },
                { value: false, icon: '🔒', label: 'Private', desc: 'Invite-only with code' },
              ].map(v => (
                <button
                  key={String(v.value)}
                  onClick={() => setIsPublic(v.value)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left"
                  style={{
                    background: isPublic === v.value ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${isPublic === v.value ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <span className="text-lg leading-none">{v.icon}</span>
                  <div>
                    <p className="font-bold text-sm" style={{ color: isPublic === v.value ? '#ffd700' : '#d1d5db' }}>{v.label}</p>
                    <p className="text-[11px] text-gray-500">{v.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create button */}
        <div className="flex items-center justify-between gap-4">
          <div>
            {!user && <p className="text-yellow-400 text-sm">Sign in to create battles</p>}
          </div>
          <motion.button
            whileHover={!creating && selectedPacks.length > 0 ? { scale: 1.04 } : {}}
            whileTap={!creating && selectedPacks.length > 0 ? { scale: 0.97 } : {}}
            onClick={handleCreate}
            disabled={creating || selectedPacks.length === 0 || !user}
            className="flex items-center gap-3 px-8 py-4 rounded-xl font-display text-xl uppercase text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shimmer-btn"
            style={{
              background: selectedPacks.length > 0
                ? 'linear-gradient(135deg, #ffd700, #e6a800)'
                : 'rgba(255,255,255,0.08)',
              color: selectedPacks.length > 0 ? '#000' : '#666',
              boxShadow: selectedPacks.length > 0 ? '0 0 30px -5px rgba(255,215,0,0.5)' : 'none',
            }}
          >
            <Swords size={20} />
            {creating ? 'Creating...' : `Create Battle · $${totalCost.toFixed(2)}`}
          </motion.button>
        </div>
      </div>

      {/* Pack Selector Modal */}
      <AnimatePresence>
        {showPackSelector && (
          <PackSelectorModal
            onSelect={addPack}
            onClose={() => setShowPackSelector(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
