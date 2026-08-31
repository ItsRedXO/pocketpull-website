import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUpgrader } from '../hooks/useUpgrader';
import { MULTIPLIERS } from './upgrader/constants';

import { ResultOverlay } from './upgrader/ResultOverlay';
import { InventoryPanel } from './upgrader/InventoryPanel';
import { CenterPanel } from './upgrader/CenterPanel';
import { TargetPanel } from './upgrader/TargetPanel';

export const UpgraderPage: React.FC = () => {
  const {
    user, isAuthenticated, stats,
    inventory, invLoading, invSearch, setInvSearch, invRarityFilter, setInvRarityFilter,
    selectedCards, selectedTargets, multiplierIdx, setMultiplierIdx,
    useBalance, setUseBalance, addedBalance, setAddedBalance, maxAllowedBalance,
    tgtSearch, setTgtSearch, tgtRarityFilter, setTgtRarityFilter, tgtMinValue, setTgtMinValue, tgtMaxValue, setTgtMaxValue,
    upgrading, spinning, outcome, wonCards, error,
    selectedCardTotal, totalUpgradeValue, targetValueThreshold, perTargetChance,
    chanceForTarget, filteredInventory, filteredTargets,
    paginatedInventory, paginatedTargets,
    invPage, setInvPage, totalInvPages,
    tgtPage, setTgtPage, totalTgtPages,
    toggleCard, toggleTarget, canUpgrade, validationMessage, handleUpgrade, handleSpinComplete, handleReset,
    backendIsWin,
  } = useUpgrader();

  const multiplier = MULTIPLIERS[multiplierIdx];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="min-h-screen px-3 md:px-5 py-8"
      style={{ background: '#0a0b0f' }}
    >
      <AnimatePresence>
        {outcome && !upgrading && <ResultOverlay outcome={outcome} wonCards={wonCards} onReset={handleReset} />}
      </AnimatePresence>

      <div className="max-w-[1400px] mx-auto">
        <div className="text-center mb-6">
          <h1 className="font-display text-5xl md:text-6xl uppercase tracking-tighter"
            style={{ textShadow: '0 0 40px rgba(0,200,255,0.7), 0 0 80px rgba(0,200,255,0.3)' }}>
            UPGRADER
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Risk your cards for a chance at something better.</p>
        </div>

        {!isAuthenticated && (
          <div className="text-center py-16 rounded-2xl border border-white/5 mb-8"
            style={{ background: 'rgba(13,14,20,0.9)' }}>
            <div className="text-5xl mb-3">🔒</div>
            <h2 className="font-display text-2xl uppercase text-white mb-2">Sign In Required</h2>
            <p className="text-gray-400 text-sm">Log in to access the upgrader with your real inventory.</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[480px_1fr_480px] gap-6">
          <InventoryPanel
            inventory={inventory} loading={invLoading} isAuthenticated={isAuthenticated}
            search={invSearch} setSearch={setInvSearch}
            rarityFilter={invRarityFilter} setRarityFilter={setInvRarityFilter}
            selectedCards={selectedCards} toggleCard={toggleCard}
            invQuantityMap={{}} filteredInventory={filteredInventory}
            paginatedInventory={paginatedInventory}
            page={invPage} setPage={setInvPage} totalPages={totalInvPages}
            selectedCardTotal={selectedCardTotal}
          />

          <CenterPanel
            upgrading={upgrading} spinning={spinning} outcome={outcome}
            multiplierIdx={multiplierIdx} setMultiplierIdx={setMultiplierIdx}
            selectedCardTotal={selectedCardTotal} effectiveAddedBalance={useBalance ? addedBalance : 0}
            totalUpgradeValue={totalUpgradeValue} targetValue={targetValueThreshold}
            perTargetChance={perTargetChance} selectedTargetsCount={selectedTargets.length}
            isAuthenticated={isAuthenticated} stats={stats}
            useBalance={useBalance} setUseBalance={setUseBalance}
            addedBalance={addedBalance} setAddedBalance={setAddedBalance}
            maxAllowedBalance={maxAllowedBalance}
            error={error} validationMessage={validationMessage}
            canUpgrade={canUpgrade} handleUpgrade={handleUpgrade}
            onSpinComplete={handleSpinComplete}
            forcedOutcome={backendIsWin}
          />

          <TargetPanel
            filteredTargets={filteredTargets} totalUpgradeValue={totalUpgradeValue}
            targetValue={targetValueThreshold} multiplierLabel={multiplier.label}
            search={tgtSearch} setSearch={setTgtSearch}
            rarityFilter={tgtRarityFilter} setRarityFilter={setTgtRarityFilter}
            minValue={tgtMinValue} setMinValue={setTgtMinValue}
            maxValue={tgtMaxValue} setMaxValue={setTgtMaxValue}
            selectedTargets={selectedTargets} toggleTarget={toggleTarget}
            perTargetChance={perTargetChance} selectedCardsCount={selectedCards.length}
            chanceForTarget={chanceForTarget}
            paginatedTargets={paginatedTargets}
            page={tgtPage} setPage={setTgtPage} totalPages={totalTgtPages}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default UpgraderPage;