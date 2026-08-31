import { useMemo, useCallback, useEffect } from 'react';
import { MULTIPLIERS, TargetCard } from '../../pages/upgrader/constants';
import { UpgraderState, CARDS_PER_PAGE } from './useUpgraderState';
import { UpgraderData } from './useUpgraderData';

export const HOUSE_EDGE_FACTOR = 0.90;

export const useUpgraderCalculations = (state: UpgraderState, data: UpgraderData) => {
  const {
    inventory, allDbCards, invSearch, invRarityFilter,
    selectedCards, selectedTargets, multiplierIdx,
    useBalance, addedBalance, setAddedBalance,
    tgtSearch, tgtRarityFilter, tgtMinValue, tgtMaxValue,
    invPage, setInvPage, tgtPage, setTgtPage,
    error, setError
  } = state;

  const { stats, settingsData } = data;

  const upgraderSettings = useMemo(() => {
    // HARD ENFORCED MAX CHANCE CAPS (Prime Directive)
    // 1.2x = 70% max
    // 1.5x = 55% max
    // 2x = 35% max
    // 5x = 15% max
    // 10x = 8% max
    const map: Record<number, number> = { 
      1.2: 70, 
      1.5: 55, 
      2: 35, 
      3: 35,
      4: 35,
      5: 15, 
      6: 15,
      7: 15,
      8: 8,
      9: 8,
      10: 8 
    };
    if (settingsData) {
      settingsData.forEach(s => {
        const m = Number(s.multiplier);
        const mc = Number(s.maxChance);
        // Database settings can only LOWER the chance below hard caps
        if (map[m] !== undefined) {
          map[m] = Math.min(map[m], mc);
        } else {
          map[m] = mc;
        }
      });
    }
    return map;
  }, [settingsData]);

  const selectedCardTotal = selectedCards.reduce((s, c) => s + c.value, 0);
  const multiplier = MULTIPLIERS[multiplierIdx];
  const MAX_CHANCE = upgraderSettings[multiplier.value] || 75;

  const realBalance = useMemo(() => {
    if (!stats) return 0;
    return Math.max(0, stats.balance - (stats.matchedBalance || 0));
  }, [stats]);

  const maxAllowedBalance = useMemo(() => {
    if (selectedTargets.length === 0 || !stats) return realBalance;
    const totalTargetVal = selectedTargets.reduce((s, t) => s + t.value, 0);
    if (totalTargetVal <= 0) return realBalance;
    
    // How much balance can be added while keeping chance <= MAX_CHANCE
    // AddedBalance <= (TargetValue / Multiplier) - Input
    const neededForMax = (totalTargetVal / multiplier.value) - selectedCardTotal;
    return Math.min(realBalance, Math.max(0, neededForMax));
  }, [selectedTargets, selectedCardTotal, realBalance, multiplier.value]);

  useEffect(() => {
    if (addedBalance > maxAllowedBalance && maxAllowedBalance >= 0) {
      setAddedBalance(maxAllowedBalance);
    }
  }, [maxAllowedBalance, addedBalance, setAddedBalance]);

  const effectiveAddedBalance = useBalance ? addedBalance : 0;
  const totalUpgradeValue = selectedCardTotal + effectiveAddedBalance;

  const calculateChance = useCallback((currentInputVal: number, targetCards: TargetCard[]) => {
    if (currentInputVal < 0.1) return 0;
    const totalTargetVal = targetCards.reduce((s, t) => s + t.value, 0);
    if (totalTargetVal <= 0) return 0;

    const multVal = Number(multiplier.value);
    
    // Hard Caps Mapping — must match backend MAX_CHANCE_CHART exactly
    const HARD_CAP_MAP: Record<number, number> = {
      1.2: 70,
      1.5: 55,
      2: 35,
      3: 35,
      4: 35,
      5: 15,
      6: 15,
      7: 15,
      8: 8,
      9: 8,
      10: 8,
    };

    // Use current upgraderSettings but ensure it never exceeds the Hard Cap for defined tiers
    let multiplierMaxChance = upgraderSettings[multVal] || 75;
    if (HARD_CAP_MAP[multVal] !== undefined) {
      multiplierMaxChance = Math.min(multiplierMaxChance, HARD_CAP_MAP[multVal]);
    }

    /**
     * FORMULA (As requested):
     * baselineTargetValue = totalInputValue * selectedMultiplier
     * finalChance = multiplierMaxChance * (baselineTargetValue / selectedTargetCardValue)
     */
    const baselineTargetValue = currentInputVal * multVal;

    // RULE: Target value must be at least the baseline
    if (totalTargetVal < baselineTargetValue - 0.01) return 0;

    // Formula: Max Chance * (Baseline / Actual)
    const calculatedFinalChance = multiplierMaxChance * (baselineTargetValue / totalTargetVal);
    
    // HARD VALIDATION: NEVER EXCEED MULTIPLIER MAX CAP
    const displayedChance = Math.min(multiplierMaxChance, Math.max(0.1, calculatedFinalChance));
    
    return displayedChance;
  }, [upgraderSettings, multiplier.value]);

  const perTargetChance = useMemo(() => {
    if (selectedTargets.length === 0) return 0;
    const chance = calculateChance(totalUpgradeValue, selectedTargets);

    return chance;
  }, [calculateChance, totalUpgradeValue, selectedTargets, multiplier, upgraderSettings]);

  const targetValueThreshold = totalUpgradeValue * multiplier.value;

  const chanceForTarget = (targetCard: TargetCard): number => {
    if (selectedTargets.some(t => t.cardId === targetCard.cardId)) return perTargetChance;
    return calculateChance(totalUpgradeValue, [...selectedTargets, targetCard]);
  };

  useEffect(() => { setInvPage(1); }, [invSearch, invRarityFilter, setInvPage]);
  useEffect(() => { setTgtPage(1); }, [tgtSearch, tgtRarityFilter, tgtMinValue, tgtMaxValue, setTgtPage]);

  const filteredInventory = useMemo(() => {
    const filtered = inventory.filter(c =>
      c.cardName.toLowerCase().includes(invSearch.toLowerCase()) &&
      (invRarityFilter === 'all' || c.rarity === invRarityFilter)
    );
    return [...filtered].sort((a, b) => b.value - a.value);
  }, [inventory, invSearch, invRarityFilter]);

  const availableTargets = useMemo(() => {
    if (totalUpgradeValue < 0.1) return [...allDbCards].sort((a, b) => b.value - a.value);

    const fairPrice = totalUpgradeValue * multiplier.value;
    // The winnable floor logic should probably align with the new chance logic
    // Chance = Max Chance * (Baseline / Target)
    // Max Chance = Max Chance * (Baseline / Target) => Target = Baseline
    const minAllowedTarget = fairPrice;

    const targets = allDbCards
      .filter(c => {
        if (selectedTargets.some(t => t.cardId === c.cardId)) return true;
        if (c.value < minAllowedTarget - 0.01) return false;
        return true;
      })
      .sort((a, b) => a.value - b.value);

    return targets;
  }, [totalUpgradeValue, allDbCards, selectedTargets, multiplier.value]);

  const filteredTargets = useMemo(() => {
    const filtered = availableTargets.filter(c => {
      const minV = tgtMinValue ? parseFloat(tgtMinValue) : 0;
      const maxV = tgtMaxValue ? parseFloat(tgtMaxValue) : Infinity;
      return c.name.toLowerCase().includes(tgtSearch.toLowerCase()) &&
        (tgtRarityFilter === 'all' || c.rarity === tgtRarityFilter) &&
        c.value >= minV && c.value <= maxV;
    });
    
    if (totalUpgradeValue >= 0.5) {
      return [...filtered].sort((a, b) => a.value - b.value);
    }
    return [...filtered].sort((a, b) => b.value - a.value);
  }, [availableTargets, tgtSearch, tgtRarityFilter, tgtMinValue, tgtMaxValue, totalUpgradeValue]);

  const totalInvPages = Math.ceil(filteredInventory.length / CARDS_PER_PAGE);
  const totalTgtPages = Math.ceil(filteredTargets.length / CARDS_PER_PAGE);

  const paginatedInventory = useMemo(() => {
    const start = (invPage - 1) * CARDS_PER_PAGE;
    return filteredInventory.slice(start, start + CARDS_PER_PAGE);
  }, [filteredInventory, invPage]);

  const paginatedTargets = useMemo(() => {
    const start = (tgtPage - 1) * CARDS_PER_PAGE;
    return filteredTargets.slice(start, start + CARDS_PER_PAGE);
  }, [filteredTargets, tgtPage]);

  return {
    upgraderSettings,
    selectedCardTotal,
    multiplier,
    MAX_CHANCE,
    realBalance,
    maxAllowedBalance,
    effectiveAddedBalance,
    totalUpgradeValue,
    calculateChance,
    perTargetChance,
    targetValueThreshold,
    chanceForTarget,
    filteredInventory,
    availableTargets,
    filteredTargets,
    totalInvPages,
    totalTgtPages,
    paginatedInventory,
    paginatedTargets
  };
};

export type UpgraderCalculations = ReturnType<typeof useUpgraderCalculations>;