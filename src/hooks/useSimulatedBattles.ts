import { useState, useEffect } from 'react';
import { generateUsername, seededRandom, getDailySeed } from '../lib/simulation';
import type { BattleWithPlayers, BattlePlayer, BattleStatus } from '../pages/battles/battleTypes';
import { usePacks } from './usePacks';

/**
 * Hook to generate and manage simulated battles for the Pack Battles page.
 * Simulated battles fill up slowly and rotate automatically.
 */
export function useSimulatedBattles() {
  const { data: packs = [] } = usePacks();
  const [simulatedBattles, setSimulatedBattles] = useState<BattleWithPlayers[]>([]);
  const dailySeed = getDailySeed();

  // Initialize simulated battles
  useEffect(() => {
    if (packs.length === 0) return;

    const generateInitialBattles = () => {
      const battles: BattleWithPlayers[] = [];
      const hour = new Date().getHours();
      // Target count between 8 and 14 for visual density
      const count = 8 + (hour % 6);

      for (let i = 0; i < count; i++) {
        battles.push(createSimBattle(packs, dailySeed + "_init_" + i));
      }
      setSimulatedBattles(battles);
    };

    generateInitialBattles();
  }, [packs.length, dailySeed]);

  // Lifecycle management: slowly fill up and replace
  useEffect(() => {
    if (simulatedBattles.length === 0) return;

    const interval = setInterval(() => {
      setSimulatedBattles(prev => {
        // First, filter out battles that have been full for a while (or just replace them)
        const updated = prev.map(battle => {
          const isFull = battle.players.length >= battle.playerCount;
          
          if (isFull) {
            // If full, 40% chance to rotate it out for a fresh one
            if (Math.random() < 0.4) {
              return createSimBattle(packs, dailySeed + Date.now() + Math.random());
            }
            return battle;
          }

          // If not full, chance to add a player
          // Base chance + bonus for cheaper battles (they fill faster)
          const fillChance = 0.1 + (battle.totalCost < 50 ? 0.15 : 0.05);
          if (Math.random() < fillChance) {
            const nextPlayerIndex = battle.players.length;
            const newPlayer = createSimPlayer(battle.id, dailySeed + "_p_" + Date.now() + nextPlayerIndex, nextPlayerIndex === 0);
            const newPlayers = [...battle.players, newPlayer];
            const nowFull = newPlayers.length >= battle.playerCount;
            
            return {
              ...battle,
              players: newPlayers,
              status: (nowFull ? 'live' : 'waiting') as BattleStatus
            };
          }

          return battle;
        });

        return updated;
      });
    }, 8000); // Check every 8 seconds

    return () => clearInterval(interval);
  }, [packs, dailySeed, simulatedBattles.length > 0]);

  return simulatedBattles;
}

function createSimBattle(packs: any[], seed: string): BattleWithPlayers {
  const rng = seededRandom(seed);
  const hostName = generateUsername(seed + 'host');
  const playerCount = [2, 3, 4][Math.floor(rng() * 3)];
  const mode = ['standard', 'underdog', 'shared'][Math.floor(rng() * 3)];
  
  // Pick 1-5 packs
  const packCount = 1 + Math.floor(rng() * 5);
  const selectedPacks = [];
  let totalCost = 0;
  for (let i = 0; i < packCount; i++) {
    const pack = packs[Math.floor(rng() * packs.length)];
    if (pack) {
      selectedPacks.push({
        id: pack.id,
        name: pack.name,
        imageUrl: pack.imageUrl,
        price: Number(pack.price),
        borderColor: pack.borderColor,
        glowColor: pack.glowColor,
      });
      totalCost += Number(pack.price);
    }
  }

  // Start with 1 player (the host)
  const players: BattlePlayer[] = [
    createSimPlayer('sim_' + seed, seed + 'host', true)
  ];

  return {
    id: 'sim_' + seed,
    hostUserId: 'sim_u_' + hostName,
    hostUsername: hostName,
    hostAvatar: '',
    mode: mode as any,
    playerCount,
    isPublic: false, // Simulated battles are always private/locked
    status: 'waiting',
    packsJson: JSON.stringify(selectedPacks),
    totalCost,
    privateCode: '',
    createdAt: new Date().toISOString(),
    startedAt: null,
    endedAt: null,
    winnerUserId: null,
    winnerUsername: null,
    currentRound: 0,
    isSpinning: false,
    players,
    isSimulated: true
  };
}

function createSimPlayer(battleId: string, seed: string, isHost: boolean): BattlePlayer {
  const name = generateUsername(seed);
  return {
    id: 'sim_p_' + name + "_" + Math.random().toString(36).slice(2, 5),
    battleId: battleId,
    userId: 'sim_u_' + name,
    username: name,
    avatar: '',
    isAi: true,
    joinedAt: new Date().toISOString(),
    cardsJson: '[]',
    totalValue: 0,
    isWinner: false
  };
}
