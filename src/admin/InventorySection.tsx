import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Image as ImageIcon, Search } from 'lucide-react';
import { blink } from '../lib/blink';
import { InventoryRow, UserRow, RARITY_COLOR, RARITY_LABEL } from './types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface InventorySectionProps {
  user: UserRow;
  showToast: (m: string, ok?: boolean) => void;
  onPreviewCard: (card: InventoryRow) => void;
}

export function InventorySection({ user, showToast, onPreviewCard }: InventorySectionProps) {
  const qc = useQueryClient();
  const [addingCard, setAddingCard] = useState(false);
  const [cardSearch, setCardSearch] = useState('');
  const [showCardPicker, setShowCardPicker] = useState(false);

  const { data: inventory = [] } = useQuery<InventoryRow[]>({
    queryKey: ['admin-inventory', user.id],
    queryFn: async () => {
      const rows = await blink.db.inventory.list({
        where: { userId: user.id },
        orderBy: { value: 'desc' },
        limit: 200,
      });
      return rows.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        cardName: r.cardName,
        rarity: r.rarity,
        value: Number(r.value) || 0,
        createdAt: r.createdAt || '',
        cardImageUrl: r.cardImageUrl || null,
        packName: r.packName || null,
      }));
    },
    staleTime: 10_000,
  });

  const totalValue = useMemo(() => inventory.reduce((sum, c) => sum + c.value, 0), [inventory]);

  // ── Card database (packCards + packsCatalog) ──────────────────────────────
  const { data: packCards = [] } = useQuery<any[]>({
    queryKey: ['admin-all-pack-cards'],
    queryFn: async () => {
      const cards = await blink.db.packCards.list({ limit: 2000 });
      return cards || [];
    },
    staleTime: 60_000,
    enabled: showCardPicker,
  });

  const { data: packs = [] } = useQuery<any[]>({
    queryKey: ['admin-all-packs-catalog'],
    queryFn: async () => {
      const pc = await blink.db.packsCatalog.list({ limit: 200 });
      return pc || [];
    },
    staleTime: 60_000,
    enabled: showCardPicker,
  });

  const getPackName = (packId: string) => {
    const p = packs.find((p: any) => p.id === packId);
    return p?.name || packId;
  };

  const filteredCards = useMemo(() => {
    if (!cardSearch.trim()) return packCards.slice(0, 50);
    const q = cardSearch.toLowerCase();
    return packCards.filter((c: any) => c.cardName.toLowerCase().includes(q)).slice(0, 50);
  }, [packCards, cardSearch]);

  const handleAddCardFromDB = async (card: any) => {
    setAddingCard(true);
    try {
      await blink.db.inventory.create({
        id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId: user.id,
        cardId: card.id,
        cardName: card.cardName,
        rarity: card.rarity,
        value: Number(card.estimatedValue) || 0,
        emoji: '🃏',
        isFavorite: 0,
        cardImageUrl: card.cardImageUrl || null,
        packName: getPackName(card.packId),
      });
      qc.invalidateQueries({ queryKey: ['admin-inventory', user.id] });
      showToast(`"${card.cardName}" added to inventory.`);
      setShowCardPicker(false);
      setCardSearch('');
    } catch {
      showToast('Add card failed.', false);
    }
    setAddingCard(false);
  };

  const handleRemoveCard = async (cardId: string, cardName: string) => {
    if (!window.confirm(`Remove "${cardName}" from inventory?`)) return;
    try {
      await blink.db.inventory.delete(cardId);
      qc.invalidateQueries({ queryKey: ['admin-inventory', user.id] });
      showToast(`"${cardName}" removed.`);
    } catch {
      showToast('Remove failed.', false);
    }
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-display">
          Inventory · {inventory.length} cards
        </h4>
        <span className="text-[10px] font-bold font-display text-green-400/80 tracking-wider">
          Total: ${totalValue.toFixed(2)}
        </span>
      </div>

      {/* Add card button */}
      <div className="mb-3">
        {!showCardPicker ? (
          <button
            onClick={() => setShowCardPicker(true)}
            className="px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 w-full justify-center"
            style={{ background: 'rgba(155,92,255,0.1)', border: '1px solid rgba(155,92,255,0.2)', color: '#9b5cff' }}
          >
            <Plus size={12} /> Add Card from Database
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
                <input
                  value={cardSearch}
                  onChange={e => setCardSearch(e.target.value)}
                  placeholder="Search cards..."
                  className="admin-input text-[11px] w-full pl-7"
                  autoFocus
                />
              </div>
              <button
                onClick={() => { setShowCardPicker(false); setCardSearch(''); }}
                className="text-[10px] text-white/30 hover:text-white/60 px-2"
              >
                Cancel
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-white/5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              {filteredCards.length === 0 ? (
                <p className="text-[10px] text-white/20 text-center py-3">No cards found.</p>
              ) : (
                filteredCards.map((card: any) => (
                  <button
                    key={card.id}
                    onClick={() => handleAddCardFromDB(card)}
                    disabled={addingCard}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors disabled:opacity-40 border-b border-white/5 last:border-b-0"
                  >
                    <div className="w-6 h-8 rounded bg-black/40 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {card.cardImageUrl ? (
                        <img src={card.cardImageUrl} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <ImageIcon size={8} className="text-white/10" />
                      )}
                    </div>
                    <span className="text-[10px] text-white/80 truncate flex-1">{card.cardName}</span>
                    <span className="text-[9px] font-bold uppercase shrink-0" style={{ color: RARITY_COLOR[card.rarity] || '#888' }}>
                      {RARITY_LABEL[card.rarity] ?? card.rarity}
                    </span>
                    <span className="text-[9px] text-white/50 font-display shrink-0 w-12 text-right">
                      ${Number(card.estimatedValue || 0).toFixed(2)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card list */}
      <div
        className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        {inventory.length === 0 ? (
          <p className="text-[11px] text-white/20 text-center py-4">No cards in inventory.</p>
        ) : (
          inventory.map((card) => (
            <div
              key={card.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg group"
              style={{ background: RARITY_COLOR[card.rarity] + '0e', border: `1px solid ${RARITY_COLOR[card.rarity]}20` }}
            >
              <div
                className="w-8 h-10 rounded bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer hover:border-white/20 transition-all"
                onClick={() => onPreviewCard(card)}
              >
                {card.cardImageUrl ? (
                  <img src={card.cardImageUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon size={12} className="text-white/10" />
                )}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPreviewCard(card)}>
                <p className="text-[11px] text-white truncate">{card.cardName}</p>
                <p className="text-[9px] font-bold uppercase" style={{ color: RARITY_COLOR[card.rarity] }}>
                  {RARITY_LABEL[card.rarity] ?? card.rarity}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/80 font-bold font-display">${card.value.toFixed(2)}</p>
              </div>
              <button
                onClick={() => handleRemoveCard(card.id, card.cardName)}
                className="text-red-400/30 hover:text-red-400 transition-colors shrink-0 p-1"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
