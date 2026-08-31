import { useState, useRef } from 'react';
import { InventoryRow, TargetCard } from '../../pages/upgrader/constants';

export const CARDS_PER_PAGE = 12;

export const useUpgraderState = () => {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [invLoading, setInvLoading] = useState(true);
  const [allDbCards, setAllDbCards] = useState<TargetCard[]>([]);
  const [invSearch, setInvSearch] = useState('');
  const [invRarityFilter, setInvRarityFilter] = useState('all');

  const [selectedCards, setSelectedCards] = useState<InventoryRow[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<TargetCard[]>([]);
  const [multiplierIdx, setMultiplierIdx] = useState(0);

  const [useBalance, setUseBalance] = useState(false);
  const [addedBalance, setAddedBalance] = useState(0);

  const [tgtSearch, setTgtSearch] = useState('');
  const [tgtRarityFilter, setTgtRarityFilter] = useState('all');
  const [tgtMinValue, setTgtMinValue] = useState('');
  const [tgtMaxValue, setTgtMaxValue] = useState('');

  const [invPage, setInvPage] = useState(1);
  const [tgtPage, setTgtPage] = useState(1);

  const [upgrading, setUpgrading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [outcome, setOutcome] = useState<'win' | 'lose' | null>(null);
  const [wonCards, setWonCards] = useState<TargetCard[]>([]);
  const [error, setError] = useState('');

  const [backendIsWin, setBackendIsWin] = useState<boolean | null>(null);
  const backendResultRef = useRef<any>(null);

  return {
    inventory, setInventory,
    invLoading, setInvLoading,
    allDbCards, setAllDbCards,
    invSearch, setInvSearch,
    invRarityFilter, setInvRarityFilter,
    selectedCards, setSelectedCards,
    selectedTargets, setSelectedTargets,
    multiplierIdx, setMultiplierIdx,
    useBalance, setUseBalance,
    addedBalance, setAddedBalance,
    tgtSearch, setTgtSearch,
    tgtRarityFilter, setTgtRarityFilter,
    tgtMinValue, setTgtMinValue,
    tgtMaxValue, setTgtMaxValue,
    invPage, setInvPage,
    tgtPage, setTgtPage,
    upgrading, setUpgrading,
    spinning, setSpinning,
    outcome, setOutcome,
    wonCards, setWonCards,
    error, setError,
    backendIsWin, setBackendIsWin,
    backendResultRef
  };
};

export type UpgraderState = ReturnType<typeof useUpgraderState>;
