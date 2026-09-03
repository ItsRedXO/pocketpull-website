import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LEADERBOARD_QUERY_KEY } from '../useLeaderboard';
import { upgraderSpin } from '../../lib/api';
import { InventoryRow, TargetCard, MULTIPLIERS } from '../../pages/upgrader/constants';
import { UpgraderState } from './useUpgraderState';
import { UpgraderData } from './useUpgraderData';
import { UpgraderCalculations } from './useUpgraderCalculations';
import type { UserStats } from '../useAuth';

export const useUpgraderActions = (
  state: UpgraderState,
  data: UpgraderData,
  calculations: UpgraderCalculations
) => {
  const qc = useQueryClient();
  const {
    selectedCards, setSelectedCards,
    selectedTargets, setSelectedTargets,
    upgrading, setUpgrading,
    setSpinning, setOutcome,
    setWonCards, setError,
    setBackendIsWin, backendResultRef,
    useBalance, setUseBalance,
    addedBalance, setAddedBalance,
    setInventory,
    error,
    multiplierIdx,
    setTgtSearch, setTgtRarityFilter, setTgtMinValue, setTgtMaxValue, setTgtPage
  } = state;

  const { user, isAuthenticated, stats, updateBalance } = data;
  const { totalUpgradeValue, effectiveAddedBalance, multiplier } = calculations;

  const toggleCard = (card: InventoryRow) => {
    if (upgrading) return;
    setSelectedCards(prev => {
      const already = prev.some(c => c.id === card.id);
      let next;
      if (already) next = prev.filter(c => c.id !== card.id);
      else {
        if (prev.length >= 12) return prev;
        next = [...prev, card];
      }
      return next;
    });
    setOutcome(null);
    setError('');
  };

  const toggleTarget = (card: TargetCard) => {
    if (upgrading) return;
    setSelectedTargets(prev => {
      const already = prev.some(c => c.cardId === card.cardId);
      return already ? prev.filter(c => c.cardId !== card.cardId) : [...prev, card];
    });
  };

  useEffect(() => {
    if (selectedTargets.length > 0 && totalUpgradeValue > 0) {
      const totalTargetVal = selectedTargets.reduce((s, t) => s + t.value, 0);
      const baselineTarget = totalUpgradeValue * multiplier.value;
      if (totalTargetVal < baselineTarget - 0.01) {
        setError(`Target value (${totalTargetVal.toFixed(2)}) must be at least ${baselineTarget.toFixed(2)} for ${multiplier.label} multiplier.`);
      } else if (error && error.includes('must be at least')) setError('');
    }
  }, [totalUpgradeValue, selectedTargets, multiplier, error, setError]);

  useEffect(() => {
    if (selectedCards.length > 0) {
      setTgtSearch('');
      setTgtRarityFilter('all');
      setTgtMinValue('');
      setTgtMaxValue('');
      setTgtPage(1);
    }
  }, [selectedCards.length, useBalance, multiplierIdx, setTgtSearch, setTgtRarityFilter, setTgtMinValue, setTgtMaxValue, setTgtPage]);

  const canUpgrade = isAuthenticated && selectedCards.length > 0 && selectedTargets.length > 0 && totalUpgradeValue >= 0.5 && !upgrading;

  const validationMessage = !isAuthenticated
    ? 'Please sign in to use the upgrader.'
    : selectedCards.length === 0 ? 'Select at least one card from your inventory.'
    : selectedTargets.length === 0 ? 'Select at least one target card.'
    : totalUpgradeValue < 0.5 ? `Minimum upgrade value is $0.50 (current: $${totalUpgradeValue.toFixed(2)}).`
    : '';

  const handleUpgrade = async () => {
    if (!canUpgrade || !user?.id || !stats) return;
    setError('');
    if (stats.isBanned) {
      setError('Your account is currently banned. Please contact support.');
      return;
    }
    setUpgrading(true);
    setWonCards([]);
    try {
      const result = await upgraderSpin({
        inventoryIds: selectedCards.map(c => c.id),
        targetCardIds: selectedTargets.map(c => c.cardId),
        useBalance,
        addedBalance: effectiveAddedBalance,
        multiplier: multiplier.value,
      });
      backendResultRef.current = result;
      setBackendIsWin(result.isWin);
      setSpinning(true);
    } catch (err: any) {
      console.error('upgraderSpin error:', err);
      setError(err.message || 'Upgrade failed. Please try again.');
      setUpgrading(false);
    }
  };

  const handleSpinComplete = useCallback(async (isWin: boolean) => {
    setSpinning(false);
    setOutcome(isWin ? 'win' : 'lose');
    const result = backendResultRef.current;
    if (!result) { setUpgrading(false); return; }

    const cachedStats = qc.getQueryData<UserStats>(['user-stats', user?.id]);
    const cachedBal = cachedStats?.balance;
    if (cachedBal !== undefined && Math.abs(cachedBal - result.newBalance) > 0.5) {
      console.log('[Upgrader] Skipping stale balance update. Cached:', cachedBal, 'Spin result:', result.newBalance);
    } else {
      await updateBalance(result.newBalance);
    }

    if (result.removedCardIds?.length) {
      const removedSet = new Set(result.removedCardIds);
      setInventory(prev => prev.filter(c => !removedSet.has(c.id)));
      setSelectedCards(prev => prev.filter(c => !removedSet.has(c.id)));
    }

    if (result.wonCards?.length) {
      const mapped = result.wonCards.map((c: any) => ({
        cardId: c.cardId || c.id,
        name: c.name,
        emoji: c.emoji || '🃏',
        rarity: c.rarity,
        value: c.value,
        cardImageUrl: c.cardImageUrl || null,
      }));
      setWonCards(mapped);
      setInventory(prev => [
        ...result.wonCards.map((c: any) => ({
          id: c.id,
          cardId: c.cardId,
          cardName: c.name,
          rarity: c.rarity,
          value: c.value,
          emoji: c.emoji || '🃏',
          isFavorite: false,
          isLocked: false,
          cardImageUrl: c.cardImageUrl || null,
        } as InventoryRow)),
        ...prev,
      ]);
    }

    // The actual collection page uses ['inventory', userId]. Invalidate it so
    // navigating to My Collection cannot retain a stale pre-upgrade snapshot.
    await qc.invalidateQueries({ queryKey: ['inventory', user?.id] });
    qc.invalidateQueries({ queryKey: LEADERBOARD_QUERY_KEY });
    backendResultRef.current = null;
    setBackendIsWin(null);
    setUpgrading(false);
  }, [user?.id, updateBalance, qc, setSpinning, setOutcome, setUpgrading, setWonCards, setInventory, setSelectedCards, setBackendIsWin, backendResultRef]);

  const handleReset = () => {
    setOutcome(null); setWonCards([]); setSelectedCards([]); setSelectedTargets([]);
    setUseBalance(false); setAddedBalance(0); setError('');
    setBackendIsWin(null);
  };

  return { toggleCard, toggleTarget, canUpgrade, validationMessage, handleUpgrade, handleSpinComplete, handleReset };
};
