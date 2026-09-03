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

export const BattleOpening: React.FC<Props> = ({ results, battleStep, mode, packs, packCardsMap = {} }) => {
  const currentRound = battleStep.type === 'spinning' || battleStep.type === 'settled' || battleStep.type === 'revealed'
    ? battleStep.round : 0;
  const isTeamBattle = results?.some(r => r.teamSide === 'left' || r.teamSide === 'right');

  const renderPlayer = (pr: PlayerBattleResult) => (
    <PlayerColumn
      key={pr.playerId}
      result={pr}
      battleStep={battleStep}
      mode={mode}
      currentPack={packs[currentRound]}
      packCards={packCardsMap[packs[currentRound]?.id] || []}
    />
  );

  if (isTeamBattle) {
    const left = results.filter(r => r.teamSide === 'left');
    const right = results.filter(r => r.teamSide === 'right');
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="rounded-2xl border border-[#00c8ff]/25 bg-[#00c8ff]/[0.03] p-3">
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="font-display text-lg uppercase tracking-widest text-[#00c8ff]">Team One</h3>
            <span className="text-[10px] uppercase tracking-widest text-white/35">{left.length} players</span>
          </div>
          <div className="grid grid-cols-1 gap-4">{left.map(renderPlayer)}</div>
        </section>
        <section className="rounded-2xl border border-[#9b5cff]/25 bg-[#9b5cff]/[0.03] p-3">
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="font-display text-lg uppercase tracking-widest text-[#9b5cff]">Team Two</h3>
            <span className="text-[10px] uppercase tracking-widest text-white/35">{right.length} players</span>
          </div>
          <div className="grid grid-cols-1 gap-4">{right.map(renderPlayer)}</div>
        </section>
      </div>
    );
  }

  return (
    <div className={`grid gap-6 ${(results?.length || 0) <= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
      {results?.map(renderPlayer)}
    </div>
  );
};
