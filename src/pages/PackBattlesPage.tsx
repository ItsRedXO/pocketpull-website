import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth, useUserStats } from '../hooks/useAuth';
import { LiveBattleBoard } from './battles/LiveBattleBoard';
import { CreateBattlePage } from './battles/CreateBattlePage';
import { BattleRoom } from './battles/BattleRoom';
import { joinBattle } from '../lib/api';

type View = 'board' | 'create' | 'room' | 'watch';

export const PackBattlesPage: React.FC = () => {
  const { user } = useAuth();
  const { stats, updateBalance } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const [view, setView] = useState<View>('board');
  const [activeBattleId, setActiveBattleId] = useState<string | null>(null);
  const [watchOnly, setWatchOnly] = useState(false);

  const handleCreated = useCallback((battleId: string) => {
    setActiveBattleId(battleId);
    setWatchOnly(false);
    setView('room');
  }, []);

  const handleJoin = useCallback(async (battleId: string, teamSide?: 'left' | 'right') => {
    if (!user) return;
    if (stats?.isBanned) {
      alert('Your account is currently banned. Please contact support.');
      return;
    }

    try {
      // Call backend — server validates balance, joins battle, deducts cost
      const result = await joinBattle(battleId, teamSide);
      if (result.success) {
        // Refresh balance if it changed
        if (!result.alreadyJoined && result.newBalance !== undefined) {
          updateBalance(result.newBalance);
        }
        setActiveBattleId(battleId);
        setWatchOnly(false);
        setView('room');
      } else {
        alert(result.message || 'Failed to join battle. Please try again.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to join battle. Please try again.');
    }
  }, [user, stats, updateBalance]);

  const handleWatch = useCallback((battleId: string) => {
    setActiveBattleId(battleId);
    setWatchOnly(true);
    setView('watch');
  }, []);

  const handleBack = useCallback(() => {
    setActiveBattleId(null);
    setWatchOnly(false);
    setView('board');
  }, []);

  return (
    <AnimatePresence mode="wait">
      {view === 'board' && (
        <motion.div
          key="board"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          <LiveBattleBoard
            onCreateBattle={() => {
              if (!user) {
                alert('Please sign in to create battles.');
                return;
              }
              if (stats?.isBanned) {
                alert('Your account is currently banned. Please contact support.');
                return;
              }
              setView('create');
            }}
            onJoinBattle={handleJoin}
            onWatchBattle={handleWatch}
          />
        </motion.div>
      )}

      {view === 'create' && (
        <motion.div
          key="create"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          <CreateBattlePage
            onCreated={handleCreated}
            onBack={handleBack}
          />
        </motion.div>
      )}

      {(view === 'room' || view === 'watch') && activeBattleId && (
        <motion.div
          key={`room-${activeBattleId}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          <BattleRoom
            battleId={activeBattleId}
            onBack={handleBack}
            watchOnly={watchOnly}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
