/**
 * useUpgrader — UI state management only.
 * Win/loss outcome is determined SERVER-SIDE via /upgrader/spin.
 * The CircularMeter animation is driven by the backend-returned isWin flag.
 */
import { useUpgraderState } from './upgrader/useUpgraderState';
import { useUpgraderData } from './upgrader/useUpgraderData';
import { useUpgraderCalculations } from './upgrader/useUpgraderCalculations';
import { useUpgraderActions } from './upgrader/useUpgraderActions';

export const useUpgrader = () => {
  const state = useUpgraderState();
  const data = useUpgraderData(state);
  const calculations = useUpgraderCalculations(state, data);
  const actions = useUpgraderActions(state, data, calculations);

  return {
    ...state,
    ...data,
    ...calculations,
    ...actions,
  };
};
