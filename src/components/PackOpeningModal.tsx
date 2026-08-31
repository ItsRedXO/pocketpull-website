/**
 * PackOpeningModal — UI only.
 * All economy logic (card selection, balance deduction, inventory write) happens on backend.
 *
 * KEY GUARANTEE: The card is saved to the player's inventory by the backend BEFORE this modal
 * shows any result. Closing the modal, refreshing, or leaving the page will NOT lose the card.
 * The only action that removes a card is explicitly clicking "Sell".
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useBalance } from '../hooks/useBalance';
import { Pack, CardResult, Stage, RARITY_COLORS } from './PackOpening/types';
import { PackVisual } from './PackOpening/PackVisual';
import { PackActions } from './PackOpening/PackActions';
import { openPack, sellCard } from '../lib/api';
import { useSoundSetting } from '../hooks/useSoundSetting';
import { useTickSound } from '../hooks/useTickSound';

interface Props {
  pack: Pack | null;
  onClose: () => void;
  onBalanceUpdate?: (newBalance: number) => void;
}

export const PackOpeningModal: React.FC<Props> = ({ pack, onClose, onBalanceUpdate }) => {
  const { user, isAuthenticated } = useAuth();
  const { balance, matchedBalance, updateBalance, isLoading: balanceLoading } = useBalance(user?.id);
  const balanceRef = useRef(balance);
  const totalBalanceRef = useRef(balance + matchedBalance);
  useEffect(() => { balanceRef.current = balance; totalBalanceRef.current = balance + matchedBalance; }, [balance, matchedBalance]);
  const { enabled: soundEnabled } = useSoundSetting();
  const { startDecel, stop: stopTick } = useTickSound(soundEnabled);
  const qc = useQueryClient();

  const [stage, setStage] = useState<Stage>('idle');
  const [card, setCard] = useState<CardResult | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [inventoryId, setInventoryId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track whether a card was secured this session so we can invalidate on close
  const cardSecuredRef = useRef(false);

  // Stop tick sound on unmount
  useEffect(() => {
    return () => stopTick();
  }, [stopTick]);

  useEffect(() => {
    if (pack) {
      setStage('idle');
      setCard(null);
      setFlipped(false);
      setActionMsg(null);
      setError(null);
      setInventoryId(null);
      cardSecuredRef.current = false;
    }
  }, [pack?.id]);

  /**
   * handlePackClick — starts opening animation and calls backend immediately.
   * The backend saves the card to inventory BEFORE returning the result.
   */
  const handlePackClick = async () => {
    if (stage !== 'idle' || !pack || !user?.id) return;

    if (!isAuthenticated) {
      setError('Create an account or sign in to open packs.');
      window.dispatchEvent(new CustomEvent('pocketpull-open-auth', { detail: 'signup' }));
      return;
    }

    if (balanceLoading) return;

    if (pack.price > 0 && totalBalanceRef.current < pack.price) {
      setError(`Insufficient balance. You need ${pack.price.toFixed(2)} but have ${totalBalanceRef.current.toFixed(2)}.`);
      return;
    }

    // Start the reel tick sound SYNCHRONOUSLY before any await.
    // Uses decelerating schedule to simulate reel momentum loss over ~3s.
    startDecel(3000);

    setError(null);
    setSaving(true);
    setStage('opening');

    try {
      const result = await openPack(pack.id);

      // Card is now safely in inventory on the server.
      cardSecuredRef.current = true;

      const backendCard: CardResult = {
        name: result.card.name,
        emoji: result.card.emoji,
        rarity: result.card.rarity as any,
        value: result.card.value,
        imageUrl: result.card.imageUrl || undefined,
      };
      setCard(backendCard);
      setInventoryId(result.inventoryId);

      // Update balance display
      await updateBalance(result.newBalance);
      onBalanceUpdate?.(result.newBalance);

      // Invalidate inventory only (balance already set via updateBalance above)
      qc.invalidateQueries({ queryKey: ['inventory'] });

      // Reveal immediately — no artificial delay
      stopTick();
      setStage('reveal');
      setTimeout(() => setFlipped(true), 100);

    } catch (err: any) {
      console.error('openPack error:', err);
      setError(err.message || 'Failed to open pack. Please try again.');
      setStage('idle');
      stopTick();
    } finally {
      setSaving(false);
    }
  };

  /**
   * handleClose — safe to close at any point after a card is secured.
   * Card is already in inventory; closing is equivalent to "keep".
   * We re-invalidate queries on close to ensure fresh data everywhere.
   */
  const handleClose = () => {
    if (stage === 'opening' && saving) {
      // Backend call in progress — prevent closing to avoid UI confusion
      // (card hasn't been confirmed yet)
      return;
    }

    stopTick();

    // If a card was secured this session, ensure inventory is fresh
    if (cardSecuredRef.current) {
      qc.invalidateQueries({ queryKey: ['inventory'] });
    }

    onClose();
  };

  /**
   * handleSell — removes the already-owned card from inventory and credits the balance.
   */
  const handleSell = async () => {
    if (!inventoryId || saving || !user?.id) return;
    setSaving(true);

    // Backend is the single source of truth for balance
    const sellValue = card?.value ?? 0;
    setActionMsg(`Selling ${card?.name} for ${sellValue.toFixed(2)}...`);
    setTimeout(() => setStage('done'), 1500);

    try {
      const result = await sellCard(inventoryId);
      await updateBalance(result.newBalance);
      onBalanceUpdate?.(result.newBalance);
      setActionMsg(`Sold ${card?.name} for ${sellValue.toFixed(2)}!`);
    } catch (err: any) {
      console.error('sellCard error:', err);
      setError('Failed to sell card. It remains in your inventory.');
      setActionMsg(null);
    } finally {
      setSaving(false);
    }
  };

  const packColor = pack?.glowColor || pack?.color || '#00c8ff';
  const rarityColor = card ? (RARITY_COLORS[card.rarity] || packColor) : packColor;
  const isHighValue = card && ['secret', 'rainbow', 'ultra', 'god'].includes(card.rarity);

  return (
    <AnimatePresence>
      {pack && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)' }}
          onClick={handleClose}
        >
          <button
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            className="absolute top-4 right-4 p-3 rounded-xl text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-all z-10"
          >
            <X size={20} />
          </button>

          <div
            className="max-w-md w-full text-center space-y-6 relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Balance display */}
            {isAuthenticated && (
              <div className="text-[11px] text-white/30 font-display uppercase tracking-widest">
                Balance: <span className="text-green-400 font-bold">${balance.toFixed(2)}</span>
                {pack && <span className="ml-2 text-white/20">· Pack: {pack.price === 0 ? 'Free' : `$${pack.price.toFixed(2)}`}</span>}
              </div>
            )}

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40 mb-1">Opening</p>
              <h2 className="text-3xl font-display" style={{ color: rarityColor }}>{pack.name}</h2>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-red-400 text-sm"
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}
              >
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </motion.div>
            )}

            <PackVisual
              pack={pack}
              card={card}
              stage={stage}
              flipped={flipped}
              rarityColor={rarityColor}
              packColor={packColor}
              onPackClick={handlePackClick}
              error={error}
              isHighValue={!!isHighValue}
            />

            {/* Manual Reveal button if card is ready but not flipped yet */}
            {stage === 'opening' && card && !flipped && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => {
                  setStage('reveal');
                  setTimeout(() => setFlipped(true), 100);
                }}
                className="px-10 py-4 rounded-2xl font-display text-lg uppercase tracking-[0.2em] font-bold text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #00c8ff, #9b5cff)' }}
              >
                Reveal Card
              </motion.button>
            )}

            {saving && (
              <div className="text-white/40 text-sm animate-pulse tracking-widest uppercase">Processing…</div>
            )}

            <PackActions
              stage={stage}
              flipped={flipped}
              card={card}
              actionMsg={actionMsg}
              saving={saving}
              rarityColor={rarityColor}
              openAnotherButtonTextColor={pack.openAnotherButtonTextColor}
              onSell={handleSell}
              onClose={handleClose}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};