import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { blink, INVENTORY_CHANNEL, INVENTORY_UPDATED_EVENT } from '../lib/blink';
import { useAuth, useUserStats } from '../hooks/useAuth';
import { MarketPanel } from './exchanger/MarketPanel';
import { ExchangerHeader } from './exchanger/ExchangerHeader';
import { InventoryPanel } from './exchanger/InventoryPanel';
import { ExchangeSummary } from './exchanger/ExchangeSummary';
import { ExchangeSuccessOverlay } from './exchanger/ExchangeSuccessOverlay';
import {
  type InventoryCard, type MarketCard, type SortOption,
} from './exchanger/exchangerTypes';
import { uid } from './battles/battleUtils';
import { useAllCards } from '../hooks/usePacks';
import { exchangeTrade, type ExchangeResult } from '../lib/api';

const MAX_OFFER   = 12; // max cards player can offer
const MAX_RECEIVE = 3;  // max cards player can request
const PAGE_SIZE   = 12;

// ─── Main Page ────────────────────────────────────────────────────────────────
export const ExchangerPage: React.FC = () => {
  const { user } = useAuth();
  const { stats, updateBalance } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const { data: allCards = [], isLoading: marketLoading } = useAllCards();

  // Map allCards to MarketCard type
  const marketCards: MarketCard[] = useMemo(() => {
    return allCards.map((c: any) => ({
      id: c.id,
      name: c.cardName,
      emoji: '🎴',
      rarity: c.rarity,
      value: Number(c.estimatedValue) || 0,
      category: c.rarity === 'common' ? 'Common' : c.rarity === 'uncommon' ? 'Uncommon' : 'Rare', // Simple mapping
      imageUrl: c.cardImageUrl,
      packName: c.packName
    }));
  }, [allCards]);

  // ── Inventory state
  const [inventory, setInventory] = useState<InventoryCard[]>([]);
  const [invLoading, setInvLoading] = useState(true);
  const [invSearch, setInvSearch] = useState('');
  const [invSort, setInvSort] = useState<SortOption>('highest');
  const [invCategory, setInvCategory] = useState('all');
  const [invPage, setInvPage] = useState(0);

  // ── Selection state
  const [offerIds, setOfferIds] = useState<Set<string>>(new Set());
  const [receiveCards, setReceiveCards] = useState<Set<string>>(new Set());

  // ── Exchange state
  const [exchanging, setExchanging] = useState(false);
  const [exchangeError, setExchangeError] = useState('');
  const [exchangeSuccess, setExchangeSuccess] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [wonCards, setWonCards] = useState<ExchangeResult['addedCards']>([]);

  // ── Load real inventory ───────────────────────────────────────────────────
  const loadInventory = useCallback(async () => {
    if (!user?.id) { setInvLoading(false); return; }
    try {
      const rows = await blink.db.inventory.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 200,
      }) as any[];
      const cards = rows.map((r: any) => ({
        id: r.id,
        cardId: r.cardId || r.card_id || '',
        cardName: r.cardName || r.card_name || 'Unknown Card',
        rarity: r.rarity || 'common',
        value: Number(r.value) || 0,
        emoji: r.emoji || '🃏',
        isFavorite: Number(r.isFavorite ?? r.is_favorite) > 0,
        isLocked: Number(r.isLocked ?? r.is_locked) > 0,
        createdAt: r.createdAt || r.created_at || '',
        cardImageUrl: r.cardImageUrl || r.card_image_url || null,
      })).filter((c: any) => !c.isLocked);
      
      setInventory(cards);
    } catch (e) {
      console.error('loadInventory error', e);
    } finally {
      setInvLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  // Realtime subscription for inventory updates
  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;

    const sub = async () => {
      try {
        const unsubscribe = await blink.realtime.subscribe(`${INVENTORY_CHANNEL}-${user.id}`, (msg) => {
          if (!mounted) return;

          if (msg.event === INVENTORY_UPDATED_EVENT) {
            const data = msg.data as any;
            if (data.type === 'remove') {
              setInventory(prev => prev.filter(c => c.id !== data.cardId));
              setOfferIds(prev => {
                if (!prev.has(data.cardId)) return prev;
                const next = new Set(prev);
                next.delete(data.cardId);
                return next;
              });
            } else if (data.type === 'remove_many') {
              const ids = new Set(data.cardIds);
              setInventory(prev => prev.filter(c => !ids.has(c.id)));
              setOfferIds(prev => {
                const next = new Set(prev);
                let changed = false;
                for (const id of data.cardIds) {
                  if (next.has(id)) {
                    next.delete(id);
                    changed = true;
                  }
                }
                return changed ? next : prev;
              });
            } else if (data.type === 'add') {
              setInventory(prev => {
                if (prev.some(c => c.id === data.card.id)) return prev;
                if (data.card.isLocked) return prev;
                return [data.card, ...prev];
              });
            } else if (data.type === 'reload') {
              loadInventory();
            } else {
              loadInventory();
            }
          }
        });
        return unsubscribe;
      } catch (err) {
        console.error('Realtime sub error', err);
      }
    };

    const promise = sub();
    return () => {
      mounted = false;
      promise.then(unsub => unsub?.());
    };
  }, [user?.id, loadInventory]);

  // ── Derived values ────────────────────────────────────────────────────────
  const offerCards = useMemo(
    () => inventory.filter(c => offerIds.has(c.id)),
    [inventory, offerIds],
  );
  const offerTotal = useMemo(
    () => offerCards.reduce((s, c) => s + c.value, 0),
    [offerCards],
  );

  // Reset page when filters change
  useEffect(() => setInvPage(0), [invSearch, invSort, invCategory]);

  // ── Toggle offer card (locked cards are unselectable) ────────────────────
  const toggleOffer = useCallback((card: InventoryCard) => {
    if (card.isLocked) return; // locked cards cannot be offered
    setOfferIds(prev => {
      const next = new Set(prev);
      if (next.has(card.id)) { next.delete(card.id); }
      else if (next.size < MAX_OFFER) { next.add(card.id); }
      return next;
    });
    setExchangeError('');
  }, []);

  // ── Toggle market card ────────────────────────────────────────────────────
  const toggleReceive = useCallback((card: MarketCard) => {
    setReceiveCards(prev => {
      const next = new Set(prev);
      if (next.has(card.id)) { next.delete(card.id); }
      else if (next.size < MAX_RECEIVE) { next.add(card.id); }
      return next;
    });
    setExchangeError('');
  }, []);

  // ── Exchange handler ──────────────────────────────────────────────────────
  const handleExchange = async () => {
    if (!user || offerCards.length === 0 || receiveCards.size === 0) return;
    
    if (!isValueValid) {
      setExchangeError('Receive value cannot exceed trade-in value.');
      return;
    }

    if (stats?.isBanned) {
      setExchangeError('Your account is currently banned. Please contact support.');
      return;
    }

    setExchanging(true);
    setExchangeError('');
    try {
      const selectedMarket = marketCards.filter(c => receiveCards.has(c.id));

      // Call backend — server validates ownership, value, and commits all changes
      const result = await exchangeTrade({
        offerInventoryIds: offerCards.map(c => c.id),
        receivePackCardIds: selectedMarket.map(c => c.id),
      });

      // Update local balance from backend-authoritative value
      if (result.refund > 0.01 && stats) {
        await updateBalance(result.newBalance);
      }

      setRefundAmount(result.refund);
      setWonCards(result.addedCards);
      setExchangeSuccess(true);

      // Refresh inventory
      await loadInventory();
      setOfferIds(new Set());
      setReceiveCards(new Set());
    } catch (err: any) {
      setExchangeError(err?.message || 'Exchange failed. Please try again.');
    } finally {
      setExchanging(false);
    }
  };

  // ── Receive cards total (for live diff display) ───────────────────────────
  const [receiveTotal, setReceiveTotal] = useState(0);
  useEffect(() => {
    const total = marketCards
      .filter(c => receiveCards.has(c.id))
      .reduce((s, c) => s + c.value, 0);
    setReceiveTotal(total);
  }, [receiveCards, marketCards]);

  const diff = offerTotal - receiveTotal;
  const isValueValid = receiveTotal <= offerTotal;
  const canExchange = user && offerCards.length > 0 && receiveCards.size > 0 && offerTotal > 0 && isValueValid;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-[#0a0b0f] px-4 py-10"
    >
      <div className="max-w-[1400px] mx-auto">
        <ExchangerHeader />

        {/* ── 3-column layout ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px_1fr] gap-5">
          {/* ──────── LEFT: Player Inventory ──────────────────────────────── */}
          <InventoryPanel
            user={user}
            inventory={inventory}
            loading={invLoading}
            search={invSearch}
            setSearch={setInvSearch}
            sort={invSort}
            setSort={setInvSort}
            category={invCategory}
            setCategory={setInvCategory}
            page={invPage}
            setPage={setInvPage}
            pageSize={PAGE_SIZE}
            offerIds={offerIds}
            toggleOffer={toggleOffer}
            clearSelection={() => { setOfferIds(new Set()); setReceiveCards(new Set()); }}
            maxOffer={MAX_OFFER}
          />

          {/* ──────── CENTER: Exchange Summary ────────────────────────────── */}
          <ExchangeSummary
            user={user}
            offerCards={offerCards}
            receiveCards={receiveCards}
            marketCards={marketCards}
            offerTotal={offerTotal}
            receiveTotal={receiveTotal}
            diff={diff}
            exchanging={exchanging}
            exchangeError={exchangeError}
            canExchange={canExchange}
            handleExchange={handleExchange}
            toggleOffer={toggleOffer}
            setReceiveCards={setReceiveCards}
            maxOffer={MAX_OFFER}
            maxReceive={MAX_RECEIVE}
          />

          {/* ──────── RIGHT: Market Panel ──────────────────────────────────── */}
          <div className="glass-card p-5 flex flex-col gap-3 min-h-[600px]">
            {marketLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={28} className="text-[#00c8ff] animate-spin" />
              </div>
            ) : (
              <MarketPanel
                marketCards={marketCards}
                maxValue={offerTotal}
                selectedIds={receiveCards}
                onToggle={toggleReceive}
                maxSelectable={MAX_RECEIVE}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Success overlay ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {exchangeSuccess && (
          <ExchangeSuccessOverlay
            wonCards={wonCards}
            refund={refundAmount}
            onDismiss={() => { setExchangeSuccess(false); setRefundAmount(0); setWonCards([]); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
