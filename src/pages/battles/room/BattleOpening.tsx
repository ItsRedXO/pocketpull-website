import React from 'react';
import type { PlayerBattleResult, BattleStep } from '../battleTypes';
import { PlayerColumn } from './PlayerColumn';

interface Props {
  results: PlayerBattleResult[];
  battleStep: BattleStep;
  mode: string;
  packs: any[];
  packCardsMap?: Record<string, any[]>;
}

export const BattleOpening: React.FC<Props> = ({
  results,
  battleStep,
  mode,
  packs,
  packCardsMap = {},
}) => {
  const currentRound =
    battleStep.type === 'spinning' || battleStep.type === 'settled' || battleStep.type === 'revealed'
      ? battleStep.round
      : 0;

  return (
    <div
      className={`grid gap-6 ${
        (results?.length || 0) <= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
      }`}
    >
      {results?.map((pr) => (
        <PlayerColumn
          key={pr.playerId}
          result={pr}
          battleStep={battleStep}
          mode={mode}
          currentPack={packs[currentRound]}
          packCards={packCardsMap[packs[currentRound]?.id] || []}
        />
      ))}
    </div>
  );
};
